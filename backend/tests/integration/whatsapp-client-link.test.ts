import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { Server } from "node:http";
import test from "node:test";
import { createApp } from "../../src/app.js";
import { pool } from "../../src/db/client.js";
import { initializeDatabase } from "../../src/db/init.js";
import { signAccessToken } from "../../src/utils/jwt.js";

test("criar cliente com telefone vincula contato WhatsApp sem vínculo", async () => {
  await initializeDatabase();
  const contactId = randomUUID();
  const phone = "+5548999998888";
  await pool.query(
    `INSERT INTO whatsapp_contacts (id, remote_jid, phone_e164)
     VALUES ($1, $2, $3)`,
    [contactId, `${phone.slice(1)}@s.whatsapp.net`, phone]
  );

  const admin = await pool.query<{ id: string; email: string; role: "admin" | "receptionist" }>(
    "SELECT id, email, role FROM users WHERE role = 'admin' ORDER BY created_at ASC LIMIT 1"
  );
  assert.ok(admin.rows[0]);

  const app = createApp();
  const server = await new Promise<Server>((resolve) => {
    const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
  });
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const clientEmail = `whatsapp-link-${randomUUID()}@example.com`;
  const authorization = `Bearer ${signAccessToken(admin.rows[0])}`;
  let clientId: string | undefined;

  try {
    const response = await fetch(`http://127.0.0.1:${address.port}/api/client/create`, {
      method: "POST",
      headers: {
        Authorization: authorization,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        fullName: "Contato WhatsApp Fixture",
        cpf: "11144477735",
        email: clientEmail,
        fone: "(48) 99999-8888"
      })
    });
    assert.equal(response.status, 201);
    const body = (await response.json()) as { id: string };
    clientId = body.id;

    const linked = await pool.query<{ client_id: string | null; linked_by_user_id: string | null }>(
      "SELECT client_id, linked_by_user_id FROM whatsapp_contacts WHERE id = $1",
      [contactId]
    );
    assert.equal(linked.rows[0]?.client_id, clientId);
    assert.equal(linked.rows[0]?.linked_by_user_id, null);

    const stored = await pool.query<{ fone_e164: string | null }>(
      "SELECT fone_e164 FROM clients WHERE id = $1",
      [clientId]
    );
    assert.equal(stored.rows[0]?.fone_e164, phone);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await pool.query("DELETE FROM whatsapp_contacts WHERE id = $1", [contactId]);
    if (clientId) await pool.query("DELETE FROM clients WHERE id = $1", [clientId]);
    await pool.end();
  }
});
