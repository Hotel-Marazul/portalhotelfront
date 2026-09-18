import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { createApp } from "../../src/app.js";
import { pool } from "../../src/db/client.js";
import { initializeDatabase } from "../../src/db/init.js";
import { signAccessToken } from "../../src/utils/jwt.js";

test("sessão e resumo financeiro respeitam o papel", async () => {
  await initializeDatabase();
  const users = await pool.query<{ id: string; email: string; role: "admin" | "receptionist" }>(
    "SELECT id, email, role FROM users WHERE role IN ('admin', 'receptionist') ORDER BY role, created_at"
  );
  const admin = users.rows.find((user) => user.role === "admin");
  let receptionist = users.rows.find((user) => user.role === "receptionist");
  let insertedReceptionistId: string | undefined;
  if (!receptionist && admin) {
    insertedReceptionistId = randomUUID();
    receptionist = { id: insertedReceptionistId, email: `receptionist-${insertedReceptionistId}@example.test`, role: "receptionist" };
    await pool.query(
      `INSERT INTO users (id, name, email, password_hash, role) VALUES ($1, 'Test receptionist', $2, 'test-only', 'receptionist')`,
      [receptionist.id, receptionist.email]
    );
  }
  assert.ok(admin);
  assert.ok(receptionist);

  const app = createApp();
  const server = await new Promise<import("node:http").Server>((resolve) => {
    const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
  });
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const endpoint = `http://127.0.0.1:${address.port}`;
  const request = (path: string, user?: typeof admin) => fetch(`${endpoint}${path}`, {
    headers: user ? { Authorization: `Bearer ${signAccessToken(user)}` } : undefined
  });

  try {
    const unauthenticated = await request("/api/User/me");
    assert.equal(unauthenticated.status, 401);

    const adminSession = await request("/api/User/me", admin);
    assert.equal(adminSession.status, 200);
    assert.deepEqual(Object.keys(await adminSession.json()).sort(), ["email", "id", "role"]);

    const receptionistSession = await request("/api/User/me", receptionist);
    assert.equal(receptionistSession.status, 200);
    assert.deepEqual(await receptionistSession.json(), {
      id: receptionist.id,
      email: receptionist.email,
      role: "receptionist"
    });

    const adminRevenue = await request("/api/reservations/revenue-summary", admin);
    assert.equal(adminRevenue.status, 200);

    const receptionistRevenue = await request("/api/reservations/revenue-summary", receptionist);
    assert.equal(receptionistRevenue.status, 403);
    assert.doesNotMatch(await receptionistRevenue.text(), /receita|recebida|total/i);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    if (insertedReceptionistId) await pool.query(`DELETE FROM users WHERE id = $1`, [insertedReceptionistId]);
    await pool.end();
  }
});
