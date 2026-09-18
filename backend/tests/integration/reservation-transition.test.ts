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

test("transição de reserva usa versão, idempotência e autenticação", async () => {
  await initializeDatabase();
  const categoryId = randomUUID();
  const roomId = randomUUID();
  const clientId = randomUUID();
  const reservationId = randomUUID();
  const user = await pool.query<{ id: string; email: string; role: "admin" | "receptionist" }>(
    "SELECT id, email, role FROM users ORDER BY created_at ASC LIMIT 1"
  );
  assert.ok(user.rows[0]);
  await pool.query(
    `INSERT INTO categories (id, name, price, single_price, couple_price)
     VALUES ($1, $2, 100, 100, 100)`,
    [categoryId, `Transição ${categoryId}`]
  );
  await pool.query(
    `INSERT INTO rooms (id, number, type, capacity, daily_price, status, category_id)
     VALUES ($1, $2, 'Teste', 2, 100, 'Disponível', $3)`,
    [roomId, roomNumber(), categoryId]
  );
  await pool.query(
    `INSERT INTO clients (id, full_name, cpf, email, fone)
     VALUES ($1, 'Cliente transição', '12345678901', $2, '00000000000')`,
    [clientId, `transicao-${clientId}@example.test`]
  );
  await pool.query(
    `INSERT INTO reservations (id, room_id, client_id, check_in_date, check_out_date, status, total_price)
     VALUES ($1, $2, $3, '2042-04-10T17:00:00Z', '2042-04-12T15:00:00Z', 'Pendente', 200)`,
    [reservationId, roomId, clientId]
  );

  const app = createApp();
  const server = await new Promise<import("node:http").Server>((resolve) => {
    const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
  });
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const endpoint = `http://127.0.0.1:${address.port}`;
  const authHeaders = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${signAccessToken(user.rows[0])}`
  };

  try {
    const unauthenticated = await fetch(`${endpoint}/api/reservations/${reservationId}/transitions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetStatus: "Confirmada", version: 1 })
    });
    assert.equal(unauthenticated.status, 401);

    const invalid = await fetch(`${endpoint}/api/reservations/${reservationId}/transitions`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ targetStatus: "inexistente", version: 1 })
    });
    assert.equal(invalid.status, 400);

    const idempotencyKey = randomUUID();
    const transition = () => fetch(`${endpoint}/api/reservations/${reservationId}/transitions`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ targetStatus: "Confirmada", version: 1, idempotencyKey })
    });
    const first = await transition();
    assert.equal(first.status, 200);
    const firstBody = await first.json() as { status: string; version: number; audit?: { action: string } };
    assert.equal(firstBody.status, "Confirmada");
    assert.equal(firstBody.version, 2);
    assert.equal(firstBody.audit?.action, "status_transition");

    const replay = await transition();
    assert.equal(replay.status, 200);
    const replayBody = await replay.json() as { status: string; version: number; idempotent?: boolean };
    assert.equal(replayBody.version, 2);
    assert.equal(replayBody.idempotent, true);

    const changedKeyPayload = await fetch(`${endpoint}/api/reservations/${reservationId}/transitions`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ targetStatus: "Pendente", version: 2, idempotencyKey })
    });
    assert.equal(changedKeyPayload.status, 409);

    const invalidTransition = await fetch(`${endpoint}/api/reservations/${reservationId}/transitions`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ targetStatus: "Pendente", version: 2, idempotencyKey: randomUUID() })
    });
    assert.equal(invalidTransition.status, 409);

    const staleVersion = await fetch(`${endpoint}/api/reservations/${reservationId}/transitions`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ targetStatus: "EmAndamento", version: 1, idempotencyKey: randomUUID() })
    });
    assert.equal(staleVersion.status, 409);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await pool.query(`ALTER TABLE reservation_events DISABLE TRIGGER reservation_events_append_only`);
    await pool.query(`DELETE FROM reservation_events WHERE reservation_id = $1`, [reservationId]);
    await pool.query(`ALTER TABLE reservation_events ENABLE TRIGGER reservation_events_append_only`);
    await pool.query(`DELETE FROM reservation_payments WHERE reservation_id = $1`, [reservationId]);
    await pool.query(`DELETE FROM reservation_guests WHERE reservation_id = $1`, [reservationId]);
    await pool.query(`DELETE FROM reservations WHERE id = $1`, [reservationId]);
    await pool.query(`DELETE FROM rooms WHERE id = $1`, [roomId]);
    await pool.query(`DELETE FROM clients WHERE id = $1`, [clientId]);
    await pool.query(`DELETE FROM categories WHERE id = $1`, [categoryId]);
    await pool.end();
  }
});
