import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { Server } from "node:http";
import test from "node:test";
import { createApp } from "../../src/app.js";
import { env } from "../../src/config/env.js";
import { pool } from "../../src/db/client.js";
import { initializeDatabase } from "../../src/db/init.js";
import { getConversationDetail } from "../../src/modules/whatsapp/queue.service.js";
import { signAccessToken } from "../../src/utils/jwt.js";

test("nome e telefone permitem cadastrar, reservar e completar os dados depois", async () => {
  assert.match(env.DB_NAME, /test/, "Execute somente em banco de testes.");
  await initializeDatabase();
  const categoryId = randomUUID();
  const roomId = randomUUID();
  const contactId = randomUUID();
  const conversationId = randomUUID();
  const userId = randomUUID();
  const clientIds: string[] = [];
  const fullName = `Cadastro inicial ${randomUUID()}`;
  const fone = "(48) 99999-8877";
  await pool.query(`INSERT INTO users (id, name, email, password_hash, role)
    VALUES ($1, 'Recepção Teste', $2, 'fixture', 'receptionist')`, [userId, `${userId}@example.test`]);
  const server = await new Promise<Server>((resolve) => {
    const listener = createApp().listen(0, "127.0.0.1", () => resolve(listener));
  });
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${signAccessToken({ id: userId, email: `${userId}@example.test`, role: "receptionist" })}`,
  };
  const request = (path: string, method = "GET", body?: unknown) =>
    fetch(`http://127.0.0.1:${address.port}/api${path}`, {
      method, headers, body: body === undefined ? undefined : JSON.stringify(body),
    });

  try {
    for (const optionalFields of [{}, { cpf: "", email: "" }]) {
      const response = await request("/client/create", "POST", { fullName, fone, ...optionalFields });
      assert.equal(response.status, 201);
      const created = await response.json() as { id: string; cpf: string; email: string };
      clientIds.push(created.id);
      assert.equal(created.cpf, "");
      assert.equal(created.email, "");
    }
    const stored = await pool.query(`SELECT cpf FROM clients WHERE id = ANY($1::uuid[])`, [clientIds]);
    assert.equal(stored.rows.length, 2);
    assert.ok(stored.rows.every((row) => row.cpf === null));
    const listed = await request(`/client?search=${encodeURIComponent(fullName)}`);
    const list = await listed.json() as { items: Array<{ cpf: string }> };
    assert.equal(list.items.length, 2);
    assert.ok(list.items.every((client) => client.cpf === ""));
    const detail = await request(`/client/${clientIds[0]}`);
    assert.equal((await detail.json() as { cpf: string }).cpf, "");

    await pool.query(`INSERT INTO categories (id, name, price, single_price, couple_price)
      VALUES ($1, $2, 100, 100, 100)`, [categoryId, `Cadastro inicial ${categoryId}`]);
    await pool.query(`INSERT INTO rooms (id, number, type, capacity, daily_price, status, category_id)
      VALUES ($1, $2, 'Teste', 2, 100, 'Disponível', $3)`,
    [roomId, Number(BigInt(`0x${roomId.replaceAll("-", "")}`) % 90_000_000n) + 10_000_000, categoryId]);
    const reservation = await request("/reservations", "POST", {
      clientId: clientIds[0], roomId, checkInDate: "2039-01-10", checkOutDate: "2039-01-12",
      guests: [], idempotencyKey: randomUUID(),
    });
    assert.equal(reservation.status, 201);
    const booking = await reservation.json() as { status: string; clientId: string; totalPrice: number };
    assert.equal(booking.status, "Pendente");
    assert.equal(booking.clientId, clientIds[0]);
    assert.equal(booking.totalPrice, 200);

    await pool.query(`INSERT INTO whatsapp_contacts (id, remote_jid, phone_e164, client_id)
      VALUES ($1, $2, '+5548999998877', $3)`, [contactId, `${contactId}@s.whatsapp.net`, clientIds[0]]);
    await pool.query(`INSERT INTO whatsapp_conversations (id, contact_id) VALUES ($1, $2)`, [conversationId, contactId]);
    const conversation = await getConversationDetail(conversationId, userId);
    assert.equal(conversation.guest?.maskedCpf, "");

    const completed = await request(`/client/${clientIds[0]}`, "PUT", {
      fullName, fone, cpf: "11144477735", email: "hospede@example.test",
    });
    assert.equal(completed.status, 200);
    assert.equal((await completed.json() as { cpf: string }).cpf, "***.***.***-35");
    for (const optionalCpf of [{}, { cpf: "" }]) {
      const edited = await request(`/client/${clientIds[0]}`, "PUT", {
        fullName, fone, email: "hospede@example.test", ...optionalCpf,
      });
      assert.equal(edited.status, 200);
    }
    const saved = await pool.query(`SELECT cpf, email FROM clients WHERE id = $1`, [clientIds[0]]);
    assert.equal(saved.rows[0].cpf, "11144477735");
    assert.equal(saved.rows[0].email, "hospede@example.test");
    const duplicate = await request(`/client/${clientIds[1]}`, "PUT", { fullName, fone, cpf: "11144477735" });
    assert.equal(duplicate.status, 409);
    const invalid = await request("/client/create", "POST", { fullName, fone, cpf: "11111111111" });
    assert.equal(invalid.status, 400);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await pool.query(`DELETE FROM whatsapp_contacts WHERE id = $1`, [contactId]);
    await pool.query(`ALTER TABLE reservation_events DISABLE TRIGGER reservation_events_append_only`);
    try {
      await pool.query(`DELETE FROM reservation_events WHERE reservation_id IN (SELECT id FROM reservations WHERE room_id = $1)`, [roomId]);
    } finally {
      await pool.query(`ALTER TABLE reservation_events ENABLE TRIGGER reservation_events_append_only`);
    }
    await pool.query(`DELETE FROM reservations WHERE room_id = $1`, [roomId]);
    await pool.query(`DELETE FROM rooms WHERE id = $1`, [roomId]);
    await pool.query(`DELETE FROM categories WHERE id = $1`, [categoryId]);
    await pool.query(`DELETE FROM clients WHERE id = ANY($1::uuid[])`, [clientIds]);
    await pool.query(`DELETE FROM users WHERE id = $1`, [userId]);
    await pool.end();
  }
});
