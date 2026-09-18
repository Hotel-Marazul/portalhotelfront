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

test("contratos validam filtros, capacidade, último dia e agregados", async () => {
  await initializeDatabase();
  const categoryId = randomUUID();
  const smallRoomId = randomUUID();
  const largeRoomId = randomUUID();
  const clientId = randomUUID();
  const user = await pool.query<{ id: string; email: string; role: "admin" | "receptionist" }>(
    `SELECT id, email, role FROM users WHERE role = 'admin' ORDER BY created_at ASC LIMIT 1`
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

  try {
    await pool.query(`INSERT INTO categories (id, name, price, single_price, couple_price) VALUES ($1, $2, 100, 100, 100)`, [categoryId, `Contratos ${categoryId}`]);
    await pool.query(`INSERT INTO rooms (id, number, type, capacity, daily_price, status, category_id) VALUES ($1, $2, 'Pequeno', 1, 100, 'Disponível', $3), ($4, $5, 'Grande', 3, 100, 'Disponível', $3)`, [smallRoomId, roomNumber(), categoryId, largeRoomId, roomNumber()]);
    const clientName = `Cliente Contrato ${clientId}`;
    await pool.query(`INSERT INTO clients (id, full_name, cpf, email, fone) VALUES ($1, $2, $3, $4, '00000000000')`, [clientId, clientName, `8${roomNumber()}${String(roomNumber()).slice(-2)}`.slice(0, 11), `contract-${clientId}@example.test`]);

    const clientSearch = await fetch(`${endpoint}/api/client?search=${encodeURIComponent(clientName)}&page=1&pageSize=10`, { headers });
    assert.equal(clientSearch.status, 200);
    const clientSearchBody = await clientSearch.json() as { items: Array<{ id: string; cpf: string }>; total: number };
    assert.equal(clientSearchBody.total, 1);
    assert.equal(clientSearchBody.items[0]?.id, clientId);
    assert.doesNotMatch(clientSearchBody.items[0]?.cpf ?? "", /^\d{11}$/);

    const created = await fetch(`${endpoint}/api/reservations`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        roomId: smallRoomId,
        clientId,
        checkInDate: "2039-01-31",
        checkOutDate: "2039-02-01",
        guests: [],
        idempotencyKey: randomUUID()
      })
    });
    assert.equal(created.status, 201);
    const createdBody = await created.json() as { id: string; version: number; audit?: { action: string }; totalPaid?: number; balanceDue?: number };
    assert.match(createdBody.id, /^[0-9a-f-]{36}$/i);
    assert.equal(createdBody.version, 1);
    assert.equal(createdBody.audit?.action, "created");
    assert.equal(createdBody.totalPaid, 0);
    assert.equal(createdBody.balanceDue, 100);

    const availability = await fetch(`${endpoint}/api/rooms/availability?checkIn=2039-01-31&checkOut=2039-02-01&guestCount=2`, { headers });
    assert.equal(availability.status, 200);
    const availableRooms = await availability.json() as Array<{ id: string }>;
    assert.ok(!availableRooms.some((room) => room.id === smallRoomId));
    assert.ok(availableRooms.some((room) => room.id === largeRoomId));

    const tooManyGuests = await fetch(`${endpoint}/api/rooms/availability?checkIn=2039-01-31&checkOut=2039-02-01&guestCount=4`, { headers });
    assert.equal(tooManyGuests.status, 200);
    assert.deepEqual(await tooManyGuests.json(), []);

    const lastDay = await fetch(`${endpoint}/api/reservations?checkInFrom=2039-01-31&checkInTo=2039-01-31&page=1&pageSize=100`, { headers });
    assert.equal(lastDay.status, 200);
    const lastDayBody = await lastDay.json() as { items: Array<{ id: string }>; total: number };
    assert.equal(lastDayBody.total, 1);
    assert.equal(lastDayBody.items[0]?.id, createdBody.id);

    const invalidPage = await fetch(`${endpoint}/api/reservations?page=0`, { headers });
    assert.equal(invalidPage.status, 400);
    const invalidPageBody = await invalidPage.json() as { message: string; issues?: unknown };
    assert.equal(invalidPageBody.message, "Dados inválidos.");
    assert.ok(invalidPageBody.issues);

    const invalidRange = await fetch(`${endpoint}/api/reservations?checkInFrom=2039-02-02&checkInTo=2039-02-01`, { headers });
    assert.equal(invalidRange.status, 400);

    const countersBefore = await fetch(`${endpoint}/api/reservations/counter-summary`, { headers });
    assert.equal(countersBefore.status, 200);
    const countersBeforeBody = await countersBefore.json() as { reservasAtivas: number; pendenciasVencidas: number };
    await pool.query(
      `INSERT INTO reservations (id, room_id, client_id, check_in_date, check_out_date, status, total_price)
       VALUES ($1, $2, $3, '2020-01-01T17:00:00Z', '2020-01-02T15:00:00Z', 'Pendente', 100)`,
      [randomUUID(), largeRoomId, clientId]
    );
    const countersAfter = await fetch(`${endpoint}/api/reservations/counter-summary`, { headers });
    assert.equal(countersAfter.status, 200);
    const countersAfterBody = await countersAfter.json() as { reservasAtivas: number; pendenciasVencidas: number };
    assert.equal(countersAfterBody.reservasAtivas, countersBeforeBody.reservasAtivas);
    assert.equal(countersAfterBody.pendenciasVencidas, countersBeforeBody.pendenciasVencidas + 1);
    const revenue = await fetch(`${endpoint}/api/reservations/revenue-summary`, { headers });
    assert.equal(revenue.status, 200);
  } catch (error) {
    // Keep the assertion below useful without hiding the actual HTTP response.
    throw error;
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await pool.query(`ALTER TABLE reservation_events DISABLE TRIGGER reservation_events_append_only`);
    await pool.query(`DELETE FROM reservation_events WHERE reservation_id IN (SELECT id FROM reservations WHERE room_id IN ($1, $2) OR client_id = $3)`, [smallRoomId, largeRoomId, clientId]);
    await pool.query(`ALTER TABLE reservation_events ENABLE TRIGGER reservation_events_append_only`);
    await pool.query(`DELETE FROM reservation_payments WHERE reservation_id IN (SELECT id FROM reservations WHERE room_id IN ($1, $2) OR client_id = $3)`, [smallRoomId, largeRoomId, clientId]);
    await pool.query(`DELETE FROM reservation_guests WHERE reservation_id IN (SELECT id FROM reservations WHERE room_id IN ($1, $2) OR client_id = $3)`, [smallRoomId, largeRoomId, clientId]);
    await pool.query(`DELETE FROM reservations WHERE room_id IN ($1, $2) OR client_id = $3`, [smallRoomId, largeRoomId, clientId]);
    await pool.query(`DELETE FROM rooms WHERE id IN ($1, $2)`, [smallRoomId, largeRoomId]);
    await pool.query(`DELETE FROM clients WHERE id = $1`, [clientId]);
    await pool.query(`DELETE FROM categories WHERE id = $1`, [categoryId]);
    await pool.end();
  }
});
