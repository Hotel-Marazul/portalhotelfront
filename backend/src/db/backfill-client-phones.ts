import { initializeDatabase } from "./init.js";
import { pool } from "./client.js";
import { autoLinkContactsForClient } from "../modules/whatsapp/contact-link.service.js";
import { normalizePhone } from "../modules/whatsapp/phone.js";

interface ClientPhoneRow {
  id: string;
  fone: string;
  fone_e164: string | null;
}

async function backfill() {
  const apply = process.argv.includes("--apply");
  await initializeDatabase();
  const db = await pool.connect();
  let transactionStarted = false;

  try {
    const result = await db.query<ClientPhoneRow>(
      "SELECT id, fone, fone_e164 FROM clients ORDER BY id"
    );
    const rows = result.rows.map((row) => ({ ...row, normalized: normalizePhone(row.fone) }));
    const invalidIds = rows.filter((row) => !row.normalized).map((row) => row.id);
    const validRows = rows.filter((row): row is typeof row & { normalized: string } => Boolean(row.normalized));

    if (apply) {
      await db.query("BEGIN");
      transactionStarted = true;
      for (const row of rows) {
        await db.query("UPDATE clients SET fone_e164 = $1 WHERE id = $2", [row.normalized, row.id]);
        if (row.normalized) await autoLinkContactsForClient(db, row.id, row.normalized);
      }
      await db.query("COMMIT");
    }

    console.log(JSON.stringify({
      apply,
      total: rows.length,
      normalized: validRows.length,
      invalidIds
    }));
  } catch (error) {
    if (transactionStarted) await db.query("ROLLBACK");
    throw error;
  } finally {
    db.release();
    await pool.end();
  }
}

backfill().catch((error) => {
  console.error("WhatsApp phone backfill failed:", error instanceof Error ? error.message : "unknown_error");
  process.exitCode = 1;
});
