import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { createApp } from "../../src/app.js";
import { pool } from "../../src/db/client.js";
import { initializeDatabase } from "../../src/db/init.js";
import { signAccessToken } from "../../src/utils/jwt.js";

test("pagamento é idempotente, limitado ao saldo e não muda o status", async () => {
  await initializeDatabase();
  const categoryId = randomUUID(), roomId = randomUUID(), clientId = randomUUID(), reservationId = randomUUID();
  const user = await pool.query<{ id: string; email: string; role: "admin" | "manager" }>(`SELECT id, email, role FROM users ORDER BY (role = 'manager') DESC, created_at LIMIT 1`);
  assert.ok(user.rows[0]);
  let insertedManagerId: string | undefined;
  if (user.rows[0].role !== "manager") {
    insertedManagerId = randomUUID();
    await pool.query(
      `INSERT INTO users (id, name, email, password_hash, role) VALUES ($1, 'Test manager', $2, 'test-only', 'manager')`,
      [insertedManagerId, `manager-${insertedManagerId}@example.test`]
    );
  }
  const actingManager = user.rows[0].role === "manager"
    ? user.rows[0]
    : { id: insertedManagerId!, email: `manager-${insertedManagerId}@example.test`, role: "manager" as const };
  const app = createApp();
  const server = await new Promise<import("node:http").Server>((resolve) => { const item = app.listen(0, "127.0.0.1", () => resolve(item)); });
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${signAccessToken(actingManager)}` };
  try {
    await pool.query(`INSERT INTO categories (id, name, price, single_price, couple_price) VALUES ($1, $2, 100, 100, 100)`, [categoryId, `Pagamento ${categoryId}`]);
    await pool.query(`INSERT INTO rooms (id, number, type, capacity, daily_price, status, category_id) VALUES ($1, $2, 'Teste', 2, 100, 'Disponível', $3)`, [roomId, Number(String(Date.now()).slice(-8)), categoryId]);
    await pool.query(`INSERT INTO clients (id, full_name, cpf, email, fone) VALUES ($1, 'Cliente Pagamento', $2, $3, '00000000000')`, [clientId, String(Date.now()).slice(-11).padStart(11, "0"), `payment-${clientId}@example.test`]);
    await pool.query(`INSERT INTO reservations (id, room_id, client_id, check_in_date, check_out_date, status, total_price) VALUES ($1, $2, $3, '2035-04-01T17:00:00Z', '2035-04-02T15:00:00Z', 'Pendente', 100)`, [reservationId, roomId, clientId]);
    const key = randomUUID();
    const request = () => fetch(`http://127.0.0.1:${address.port}/api/reservations/${reservationId}/payments`, {
      method: "POST", headers,
      body: JSON.stringify({ stage: "Confirmacao", method: "Pix", amount: 40, idempotencyKey: key })
    });
    const first = await request();
    assert.equal(first.status, 201);
    const firstBody = await first.json() as { reservation: { payments: Array<{ id: string; amount: number }> } };
    const originalPayment = firstBody.reservation.payments.find((payment) => payment.amount === 40);
    assert.ok(originalPayment);
    const duplicate = await request();
    assert.equal(duplicate.status, 200);
    const duplicateBody = await duplicate.json() as { reservation: { status: string; totalPaid: number; balanceDue: number } };
    assert.equal(duplicateBody.reservation.status, "Pendente");
    assert.equal(duplicateBody.reservation.totalPaid, 40);
    assert.equal(duplicateBody.reservation.balanceDue, 60);
    const checkInPayment = await fetch(`http://127.0.0.1:${address.port}/api/reservations/${reservationId}/payments`, {
      method: "POST", headers,
      body: JSON.stringify({ stage: "CheckIn", method: "Pix", amount: 10, idempotencyKey: randomUUID() })
    });
    assert.equal(checkInPayment.status, 201);
    const checkInBody = await checkInPayment.json() as { reservation: { status: string; totalPaid: number; balanceDue: number } };
    assert.equal(checkInBody.reservation.status, "Pendente");
    assert.equal(checkInBody.reservation.totalPaid, 50);
    assert.equal(checkInBody.reservation.balanceDue, 50);

    const excessive = await fetch(`http://127.0.0.1:${address.port}/api/reservations/${reservationId}/payments`, {
      method: "POST", headers,
      body: JSON.stringify({ stage: "CheckIn", method: "Pix", amount: 51, idempotencyKey: randomUUID() })
    });
    assert.equal(excessive.status, 409);

    const reversal = await fetch(`http://127.0.0.1:${address.port}/api/reservations/${reservationId}/payments/${originalPayment.id}/reverse`, {
      method: "POST", headers,
      body: JSON.stringify({ amount: 20, reason: "Correção de lançamento", idempotencyKey: randomUUID() })
    });
    assert.equal(reversal.status, 201);
    const reversalBody = await reversal.json() as { reservation: { totalPaid: number; balanceDue: number; payments: Array<{ entryType: string; amount: number }> } };
    assert.equal(reversalBody.reservation.totalPaid, 30);
    assert.equal(reversalBody.reservation.balanceDue, 70);
    assert.ok(reversalBody.reservation.payments.some((payment) => payment.entryType === "reversal" && payment.amount === -20));

    const excessiveReversal = await fetch(`http://127.0.0.1:${address.port}/api/reservations/${reservationId}/payments/${originalPayment.id}/reverse`, {
      method: "POST", headers,
      body: JSON.stringify({ amount: 21, reason: "Estorno acima do restante", idempotencyKey: randomUUID() })
    });
    assert.equal(excessiveReversal.status, 409);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await pool.query(`ALTER TABLE reservation_events DISABLE TRIGGER reservation_events_append_only`);
    await pool.query(`DELETE FROM reservation_events WHERE reservation_id = $1`, [reservationId]);
    await pool.query(`ALTER TABLE reservation_events ENABLE TRIGGER reservation_events_append_only`);
    await pool.query(`DELETE FROM reservation_payments WHERE reservation_id = $1`, [reservationId]);
    await pool.query(`DELETE FROM reservations WHERE id = $1`, [reservationId]);
    await pool.query(`DELETE FROM rooms WHERE id = $1`, [roomId]);
    await pool.query(`DELETE FROM clients WHERE id = $1`, [clientId]);
    await pool.query(`DELETE FROM categories WHERE id = $1`, [categoryId]);
    if (insertedManagerId) await pool.query(`DELETE FROM users WHERE id = $1`, [insertedManagerId]);
    await pool.end();
  }
});
