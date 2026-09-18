import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { pool } from "../../src/db/client.js";
import { initializeDatabase } from "../../src/db/init.js";

const insertUser = `INSERT INTO users (id, name, email, password_hash, role) VALUES ($1, 'Legado', $2, 'test-only', $3)`;

test("usuário gravado como manager vira receptionist e o banco passa a recusar manager", async () => {
  await initializeDatabase();

  const legacyId = randomUUID();
  const client = await pool.connect();
  try {
    // Recria o estado anterior à migração: a restrição ainda aceita `manager`.
    await client.query("BEGIN");
    await client.query("ALTER TABLE users DROP CONSTRAINT users_role_check");
    await client.query(
      "ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('admin', 'manager', 'receptionist'))"
    );
    await client.query(insertUser, [legacyId, `legacy-${legacyId}@example.test`, "manager"]);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  try {
    await initializeDatabase();

    const migrated = await pool.query<{ role: string }>("SELECT role FROM users WHERE id = $1", [legacyId]);
    assert.equal(migrated.rows[0]?.role, "receptionist");

    const rejectedId = randomUUID();
    await assert.rejects(
      pool.query(insertUser, [rejectedId, `legacy-${rejectedId}@example.test`, "manager"]),
      /users_role_check/
    );

    // Rodar de novo não deve mexer em nada.
    await initializeDatabase();
    const again = await pool.query<{ role: string }>("SELECT role FROM users WHERE id = $1", [legacyId]);
    assert.equal(again.rows[0]?.role, "receptionist");
  } finally {
    await pool.query("DELETE FROM users WHERE id = $1", [legacyId]);
    await pool.end();
  }
});
