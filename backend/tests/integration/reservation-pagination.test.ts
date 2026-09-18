import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { createApp } from "../../src/app.js";
import { pool } from "../../src/db/client.js";
import { initializeDatabase } from "../../src/db/init.js";
import { signAccessToken } from "../../src/utils/jwt.js";

function roomNumber() {
  return Number((BigInt(`0x${randomUUID().replaceAll("-", "")}`) % 90_000_000n + 10_000_000n).toString());
}

test("paginação de clientes e reservas é server-side e determinística", async () => {
  await initializeDatabase();
  const categoryId = randomUUID();
  const roomId = randomUUID();
  const clientIds = Array.from({ length: 105 }, () => randomUUID());
  const reservationIds = Array.from({ length: 105 }, () => randomUUID());
  const suffix = randomUUID();
  const user = await pool.query<{ id: string; email: string; role: "admin" | "receptionist" }>(
    "SELECT id, email, role FROM users WHERE role = 'admin' ORDER BY created_at ASC LIMIT 1"
  );
  assert.ok(user.rows[0]);

  const clientValues: string[] = [];
  const clientParams: string[] = [];
  clientIds.forEach((id, index) => {
    const base = clientParams.length;
    clientValues.push(`($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5})`);
    clientParams.push(
      id,
      `Pagination Client ${String(index).padStart(3, "0")} ${suffix}`,
      String(10_000_000_000 + index),
      `pagination-${index}-${suffix}@example.test`,
      `5199999${String(index).padStart(3, "0")}`
    );
  });

  const reservationValues: string[] = [];
  const reservationParams: string[] = [];
  reservationIds.forEach((id, index) => {
    const base = reservationParams.length;
    reservationValues.push(`($${base + 1}, $${base + 2}, $${base + 3}, '2044-01-01T17:00:00Z', '2044-01-02T15:00:00Z', 'Cancelada', 0, NOW())`);
    reservationParams.push(id, roomId, clientIds[0]);
    assert.equal(index, reservationParams.length / 3 - 1);
  });

  await pool.query(
    `INSERT INTO categories (id, name, price, single_price, couple_price) VALUES ($1, $2, 100, 100, 100)`,
    [categoryId, `Paginação ${suffix}`]
  );
  await pool.query(
    `INSERT INTO rooms (id, number, type, capacity, daily_price, status, category_id) VALUES ($1, $2, 'Teste', 2, 100, 'Disponível', $3)`,
    [roomId, roomNumber(), categoryId]
  );
  await pool.query(
    `INSERT INTO clients (id, full_name, cpf, email, fone) VALUES ${clientValues.join(",")}`,
    clientParams
  );
  await pool.query(
    `INSERT INTO reservations (id, room_id, client_id, check_in_date, check_out_date, status, total_price, created_at)
     VALUES ${reservationValues.join(",")}`,
    reservationParams
  );

  const app = createApp();
  const server = await new Promise<import("node:http").Server>((resolve) => {
    const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
  });
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const endpoint = `http://127.0.0.1:${address.port}`;
  const headers = { Authorization: `Bearer ${signAccessToken(user.rows[0])}` };

  try {
    const clientsPage = await fetch(`${endpoint}/api/client?search=${encodeURIComponent(suffix)}&page=2&pageSize=100`, { headers });
    assert.equal(clientsPage.status, 200);
    const clientsPageBody = await clientsPage.json() as { items: Array<{ id: string }>; total: number; page: number; pageSize: number };
    assert.ok(clientsPageBody.total >= 105);
    assert.equal(clientsPageBody.page, 2);
    assert.equal(clientsPageBody.pageSize, 100);
    assert.equal(clientsPageBody.items.length, 5);
    assert.ok(clientsPageBody.items.some((item) => item.id === clientIds[104]));

    const searchTarget = `Pagination Client 104 ${suffix}`;
    const search = await fetch(`${endpoint}/api/client?search=${encodeURIComponent(searchTarget)}&page=1&pageSize=20`, { headers });
    assert.equal(search.status, 200);
    const searchBody = await search.json() as { items: Array<{ id: string; cpf: string }>; total: number };
    assert.equal(searchBody.total, 1);
    assert.equal(searchBody.items[0]?.id, clientIds[104]);
    assert.doesNotMatch(searchBody.items[0]?.cpf ?? "", /^\d{11}$/);

    const reservationPage = async () => {
      const response = await fetch(`${endpoint}/api/reservations?search=${encodeURIComponent(suffix)}&page=2&pageSize=100`, { headers });
      assert.equal(response.status, 200);
      return await response.json() as { items: Array<{ id: string }>; total: number; page: number; pageSize: number };
    };
    const [reservationsA, reservationsB] = await Promise.all([reservationPage(), reservationPage()]);
    assert.ok(reservationsA.total >= 105);
    assert.equal(reservationsA.page, 2);
    assert.equal(reservationsA.pageSize, 100);
    assert.equal(reservationsA.items.length, 5);
    assert.deepEqual(reservationsA.items.map((item) => item.id), reservationsB.items.map((item) => item.id));
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await pool.query(`ALTER TABLE reservation_events DISABLE TRIGGER reservation_events_append_only`);
    await pool.query(`DELETE FROM reservation_events WHERE reservation_id = ANY($1::uuid[])`, [reservationIds]);
    await pool.query(`ALTER TABLE reservation_events ENABLE TRIGGER reservation_events_append_only`);
    await pool.query(`DELETE FROM reservation_payments WHERE reservation_id = ANY($1::uuid[])`, [reservationIds]);
    await pool.query(`DELETE FROM reservation_guests WHERE reservation_id = ANY($1::uuid[])`, [reservationIds]);
    await pool.query(`DELETE FROM reservations WHERE id = ANY($1::uuid[])`, [reservationIds]);
    await pool.query(`DELETE FROM clients WHERE id = ANY($1::uuid[])`, [clientIds]);
    await pool.query(`DELETE FROM rooms WHERE id = $1`, [roomId]);
    await pool.query(`DELETE FROM categories WHERE id = $1`, [categoryId]);
    await pool.end();
  }
});
