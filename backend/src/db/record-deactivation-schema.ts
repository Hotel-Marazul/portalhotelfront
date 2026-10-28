import { pool } from "./client.js";

/**
 * Hóspede, quarto e categoria não são apagados: ficam desativados, com quem e quando,
 * para que reservas antigas e relatórios continuem resolvendo os nomes.
 */
export async function migrateRecordDeactivationSchema() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const table of ["clients", "rooms", "categories"]) {
      await client.query(`
        ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT TRUE;
        ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMPTZ NULL;
        ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS deactivated_by UUID NULL
          REFERENCES users(id) ON DELETE SET NULL;
      `);
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
