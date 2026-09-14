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

async function setupFixture(suffix: string) {
  const categoryId = randomUUID();
  const roomId = randomUUID();
  const clientId = randomUUID();
  await pool.query(
    `INSERT INTO categories (id, name, price, single_price, couple_price) VALUES ($1, $2, 100, 100, 100)`,
    [categoryId, `Concorrência ${suffix} ${categoryId}`]
  );
  await pool.query(
    `INSERT INTO rooms (id, number, type, capacity, daily_price, status, category_id) VALUES ($1, $2, 'Teste', 2, 100, 'Disponível', $3)`,
    [roomId, roomNumber(), categoryId]
  );
  await pool.query(
    `INSERT INTO clients (id, full_name, cpf, email, fone) VALUES ($1, $2, $3, $4, '00000000000')`,
    [clientId, `Cliente ${suffix}`, `9${roomNumber()}${String(roomNumber()).slice(-2)}`.slice(0, 11), `${suffix}-${clientId}@example.test`]
  );
  return { categoryId, roomId, clientId };
}

async function cleanupFixture(fixture: { categoryId: string; roomId: string; clientId: string }) {
  await pool.query(`ALTER TABLE reservation_events DISABLE TRIGGER reservation_events_append_only`);
  await pool.query(
    `DELETE FROM reservation_events WHERE reservation_id IN (SELECT id FROM reservations WHERE room_id = $1 OR client_id = $2)`,
    [fixture.roomId, fixture.clientId]
  );
  await pool.query(`ALTER TABLE reservation_events ENABLE TRIGGER reservation_events_append_only`);
  await pool.query(
    `DELETE FROM reservation_payments WHERE reservation_id IN (SELECT id FROM reservations WHERE room_id = $1 OR client_id = $2)`,
    [fixture.roomId, fixture.clientId]
  );
  await pool.query(`DELETE FROM reservation_guests WHERE reservation_id IN (SELECT id FROM reservations WHERE room_id = $1 OR client_id = $2)`, [fixture.roomId, fixture.clientId]);
  await pool.query(`DELETE FROM reservations WHERE room_id = $1 OR client_id = $2`, [fixture.roomId, fixture.clientId]);
  await pool.query(`DELETE FROM rooms WHERE id = $1`, [fixture.roomId]);
  await pool.query(`DELETE FROM clients WHERE id = $1`, [fixture.clientId]);
  await pool.query(`DELETE FROM categories WHERE id = $1`, [fixture.categoryId]);
}

test("serializa criação, edição e pagamento concorrentes com duas conexões reais", async () => {
  await initializeDatabase();
  const fixture = await setupFixture("corrida");
  const user = await pool.query<{ id: string; email: string; role: "admin" | "manager" }>(
    `SELECT id, email, role FROM users ORDER BY created_at ASC LIMIT 1`
  );
  assert.ok(user.rows[0]);
  const app = createApp();
  const server = await new Promise<import("node:http").Server>((resolve) => {
    const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
  });
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${signAccessToken(user.rows[0])}` };
  const endpoint = `http://127.0.0.1:${address.port}`;
  const connectionA = await pool.connect();
  const connectionB = await pool.connect();
  try {
    const backendPids = await Promise.all([
      connectionA.query<{ pid: number }>("SELECT pg_backend_pid() AS pid"),
      connectionB.query<{ pid: number }>("SELECT pg_backend_pid() AS pid")
    ]);
    assert.notEqual(backendPids[0].rows[0]?.pid, backendPids[1].rows[0]?.pid);
  } finally {
    connectionA.release();
    connectionB.release();
  }

  try {
    const create = (key: string) => fetch(`${endpoint}/api/reservations`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        roomId: fixture.roomId,
        clientId: fixture.clientId,
        checkInDate: "2038-01-01",
        checkOutDate: "2038-01-03",
        guests: [],
        idempotencyKey: key
      })
    });
    const createResponses = await Promise.all([create(randomUUID()), create(randomUUID())]);
    assert.deepEqual(createResponses.map((response) => response.status).sort(), [201, 409]);

    const created = await pool.query<{ id: string; version: number }>(
      `SELECT id, version FROM reservations WHERE room_id = $1`,
      [fixture.roomId]
    );
    assert.equal(created.rows.length, 1);
    const reservation = created.rows[0];

    const update = (checkInDate: string, key: string) => fetch(`${endpoint}/api/reservations/${reservation.id}`, {
      method: "PUT",
      headers,
      body: JSON.stringify({
        roomId: fixture.roomId,
        clientId: fixture.clientId,
        checkInDate,
        checkOutDate: "2038-01-03",
        guests: [],
        version: reservation.version,
        idempotencyKey: key
      })
    });
    // Use the same one-night target so the subsequent payment race has a deterministic balance.
    const updateResponses = await Promise.all([update("2038-01-02", randomUUID()), update("2038-01-02", randomUUID())]);
    assert.deepEqual(updateResponses.map((response) => response.status).sort(), [200, 409]);

    const payment = (key: string) => fetch(`${endpoint}/api/reservations/${reservation.id}/payments`, {
      method: "POST",
      headers,
      body: JSON.stringify({ stage: "Confirmacao", method: "Pix", amount: 60, idempotencyKey: key })
    });
    const paymentResponses = await Promise.all([payment(randomUUID()), payment(randomUUID())]);
    assert.deepEqual(paymentResponses.map((response) => response.status).sort(), [201, 409]);

    const finalState = await pool.query<{ version: number; total_paid: string }>(
      `SELECT r.version, COALESCE(SUM(p.amount), 0)::text AS total_paid
       FROM reservations r LEFT JOIN reservation_payments p ON p.reservation_id = r.id
       WHERE r.id = $1 GROUP BY r.id`,
      [reservation.id]
    );
    assert.equal(finalState.rows[0]?.version, 2);
    assert.equal(finalState.rows[0]?.total_paid, "60.00");
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await cleanupFixture(fixture);
    await pool.end();
  }
});
