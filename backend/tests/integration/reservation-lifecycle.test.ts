import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { createApp } from "../../src/app.js";
import { pool } from "../../src/db/client.js";
import { initializeDatabase } from "../../src/db/init.js";
import { signAccessToken } from "../../src/utils/jwt.js";

test("o cancelamento lógico preserva hóspedes, pagamentos e registra evento", async () => {
  await initializeDatabase();
  const categoryId = randomUUID();
  const roomId = randomUUID();
  const clientId = randomUUID();
  const reservationId = randomUUID();
  const guestId = randomUUID();
  const paymentId = randomUUID();
  const categoryName = `Categoria integração ${categoryId}`;
  const email = `integration-${clientId}@example.test`;
  const roomNumber = Number(String(Date.now()).slice(-8));
  const user = await pool.query<{ id: string; email: string; role: "admin" | "receptionist" }>(
    `SELECT id, email, role FROM users ORDER BY created_at ASC LIMIT 1`
  );
  assert.ok(user.rows[0], "o banco de integração precisa de um usuário de operação");

  const app = createApp();
  const server = await new Promise<import("node:http").Server>((resolve) => {
    const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
  });
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const token = signAccessToken(user.rows[0]);

  try {
    await pool.query(`INSERT INTO categories (id, name, price, single_price, couple_price) VALUES ($1, $2, 100, 100, 100)`, [categoryId, categoryName]);
    await pool.query(`INSERT INTO rooms (id, number, type, capacity, daily_price, status, category_id) VALUES ($1, $2, 'Teste', 2, 100, 'Disponível', $3)`, [roomId, roomNumber, categoryId]);
    await pool.query(`INSERT INTO clients (id, full_name, cpf, email, fone) VALUES ($1, 'Cliente Integração', $2, $3, '00000000000')`, [clientId, String(Date.now()).slice(-11).padStart(11, "0"), email]);
    await pool.query(`INSERT INTO reservations (id, room_id, client_id, check_in_date, check_out_date, status, total_price) VALUES ($1, $2, $3, '2035-03-01T17:00:00Z', '2035-03-02T15:00:00Z', 'Pendente', 100)`, [reservationId, roomId, clientId]);
    await pool.query(`INSERT INTO reservation_guests (id, reservation_id, name, age) VALUES ($1, $2, 'Acompanhante', 30)`, [guestId, reservationId]);
    await pool.query(`INSERT INTO reservation_payments (id, reservation_id, stage, method, amount, note, entry_type) VALUES ($1, $2, 'Confirmacao', 'Pix', 20, '', 'payment')`, [paymentId, reservationId]);

    const update = await fetch(`http://127.0.0.1:${address.port}/api/reservations/${reservationId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        roomId,
        clientId,
        checkInDate: "2035-03-01",
        checkOutDate: "2035-03-02",
        version: 1,
        idempotencyKey: randomUUID()
      })
    });
    assert.equal(update.status, 200);
    const updatedBody = await update.json() as { version: number; guests: unknown[] };
    assert.equal(updatedBody.version, 2);
    assert.equal(updatedBody.guests.length, 1);

    const response = await fetch(`http://127.0.0.1:${address.port}/api/reservations/${reservationId}/cancel`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ version: 2, reason: "Teste de cancelamento lógico" })
    });
    assert.equal(response.status, 200);
    const body = await response.json() as { status: string; version: number; payments: unknown[]; totalPaid: number; balanceDue: number };
    assert.equal(body.status, "Cancelada");
    assert.equal(body.version, 3);
    assert.equal(body.payments.length, 1);
    assert.equal(body.totalPaid, 20);
    assert.equal(body.balanceDue, 80);

    const preserved = await pool.query<{ guests: number; payments: number; events: number }>(
      `SELECT
        (SELECT COUNT(*)::int FROM reservation_guests WHERE reservation_id = $1) AS guests,
        (SELECT COUNT(*)::int FROM reservation_payments WHERE reservation_id = $1) AS payments,
        (SELECT COUNT(*)::int FROM reservation_events WHERE reservation_id = $1) AS events`,
      [reservationId]
    );
    assert.deepEqual(preserved.rows[0], { guests: 1, payments: 1, events: 2 });
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    // O trigger append-only permanece ativo em produção; o cleanup do fixture usa bypass explícito.
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
