import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { createApp } from "../../src/app.js";
import { pool } from "../../src/db/client.js";
import { initializeDatabase } from "../../src/db/init.js";
import { signAccessToken } from "../../src/utils/jwt.js";

test("sessão e resumo financeiro respeitam o papel", async () => {
  await initializeDatabase();
  const users = await pool.query<{ id: string; email: string; role: "admin" | "manager" }>(
    "SELECT id, email, role FROM users WHERE role IN ('admin', 'manager') ORDER BY role, created_at"
  );
  const admin = users.rows.find((user) => user.role === "admin");
  let manager = users.rows.find((user) => user.role === "manager");
  let insertedManagerId: string | undefined;
  if (!manager && admin) {
    insertedManagerId = randomUUID();
    manager = { id: insertedManagerId, email: `manager-${insertedManagerId}@example.test`, role: "manager" };
    await pool.query(
      `INSERT INTO users (id, name, email, password_hash, role) VALUES ($1, 'Test manager', $2, 'test-only', 'manager')`,
      [manager.id, manager.email]
    );
  }
  assert.ok(admin);
  assert.ok(manager);

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

    const managerSession = await request("/api/User/me", manager);
    assert.equal(managerSession.status, 200);
    assert.deepEqual(await managerSession.json(), {
      id: manager.id,
      email: manager.email,
      role: "manager"
    });

    const adminRevenue = await request("/api/reservations/revenue-summary", admin);
    assert.equal(adminRevenue.status, 200);

    const managerRevenue = await request("/api/reservations/revenue-summary", manager);
    assert.equal(managerRevenue.status, 403);
    assert.doesNotMatch(await managerRevenue.text(), /receita|recebida|total/i);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    if (insertedManagerId) await pool.query(`DELETE FROM users WHERE id = $1`, [insertedManagerId]);
    await pool.end();
  }
});
