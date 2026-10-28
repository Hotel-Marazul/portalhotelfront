import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { createApp } from "../../src/app.js";
import { pool } from "../../src/db/client.js";
import { initializeDatabase } from "../../src/db/init.js";
import { signAccessToken } from "../../src/utils/jwt.js";
import { formatHotelDate } from "../../src/utils/reservation.js";

test("reserva sem nomes mantém ocupação, preço e replay; identificação é completada antes do check-in", async () => {
  assert.ok(process.env.DB_NAME?.endsWith("_test"), "Execute somente em banco descartável terminado em _test.");
  await initializeDatabase();
  const userId = randomUUID(), clientId = randomUUID(), roomId = randomUUID(), categoryId = randomUUID(), ruleId = randomUUID();
  await pool.query("INSERT INTO users (id,name,email,password_hash,role) VALUES ($1,'Teste',$2,'fixture','admin')", [userId, `${userId}@example.test`]);
  await pool.query("INSERT INTO clients (id,full_name,cpf,email,fone) VALUES ($1,'Titular Teste',NULL,'','48999998877')", [clientId]);
  await pool.query("INSERT INTO categories (id,name,price,single_price,couple_price) VALUES ($1,$2,100,60,100)", [categoryId, `Nomes ${categoryId}`]);
  const roomNumber = Number(BigInt(`0x${roomId.replaceAll("-", "")}`) % 90_000_000n) + 10_000_000;
  await pool.query("INSERT INTO rooms (id,number,type,capacity,daily_price,status,category_id) VALUES ($1,$2,'Teste',3,100,'Disponível',$3)", [roomId, roomNumber, categoryId]);
  await pool.query("INSERT INTO pricing_rules (id,name,description,min_age,max_age,price) VALUES ($1,$2,'Teste',6,11,10)", [ruleId, `Nomes ${ruleId}`]);
  const server = createApp().listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${signAccessToken({ id: userId, email: `${userId}@example.test`, role: "admin" })}` };
  async function request(path: string, body?: unknown, method = "POST") {
    const response = await fetch(`http://127.0.0.1:${address.port}/api${path}`, { method, headers, ...(body ? { body: JSON.stringify(body) } : {}) });
    return { status: response.status, body: await response.json() };
  }
  const today = new Date();
  const checkInDate = formatHotelDate(new Date(today.getTime() - 86_400_000));
  const checkOutDate = formatHotelDate(new Date(today.getTime() + 2 * 86_400_000));
  const guests = [{ age: 18 }, { age: 8, pricingRuleId: ruleId }];
  const payload = { clientId, roomId, checkInDate, checkOutDate, guests };
  try {
    const quote = await request("/reservations/quote", payload);
    assert.equal(quote.status, 200, JSON.stringify(quote.body));
    assert.equal(quote.body.pricing.totalPrice, 330);
    const createBody = { ...payload, status: "Confirmada", statusReason: "Depósito confirmado no atendimento", idempotencyKey: randomUUID() };
    const created = await request("/reservations", createBody);
    assert.equal(created.status, 201, JSON.stringify(created.body));
    const id = created.body.id;
    assert.equal(created.body.guests.length, 2);
    assert.ok(created.body.guests.every((g: { name: string }) => g.name === ""));
    assert.equal(created.body.totalPrice, 330);
    assert.equal((await request("/reservations", createBody)).body.id, id);
    const capacity = await request("/reservations/quote", { ...payload, reservationId: id, guests: [...guests, { age: 8, pricingRuleId: ruleId }] });
    assert.equal(capacity.status, 400);
    const overlap = await request("/reservations", { ...createBody, idempotencyKey: randomUUID() });
    assert.equal(overlap.status, 409);
    const blocked = await request(`/reservations/${id}/transitions`, { targetStatus: "EmAndamento", version: 1 });
    assert.equal(blocked.status, 409);
    assert.match(blocked.body.message, /nome.*acompanhante.*check-in/i);
    assert.equal((await request(`/reservations/${id}`, undefined, "GET")).body.status, "Confirmada");

    // Completar nomes não pode aplicar um catálogo mais caro ao acordo já salvo.
    await pool.query("UPDATE categories SET price=999,couple_price=999 WHERE id=$1", [categoryId]);
    const completedGuests = [{ name: "Adulto Identificado", age: 18 }, { name: "Criança Identificada", age: 8, pricingRuleId: ruleId }];
    const updated = await request(`/reservations/${id}`, { ...payload, guests: completedGuests, version: 1 }, "PUT");
    assert.equal(updated.status, 200, JSON.stringify(updated.body));
    assert.equal(updated.body.totalPrice, 330);
    assert.deepEqual(updated.body.guests.map((g: { name: string }) => g.name), completedGuests.map(g => g.name));
    const checkedIn = await request(`/reservations/${id}/transitions`, { targetStatus: "EmAndamento", version: 2, idempotencyKey: randomUUID() });
    assert.equal(checkedIn.status, 200, JSON.stringify(checkedIn.body));
    assert.equal(checkedIn.body.status, "EmAndamento");
    const eraseNames = await request(`/reservations/${id}`, { ...payload, version: 3 }, "PUT");
    assert.equal(eraseNames.status, 409);
    assert.match(eraseNames.body.message, /nome.*acompanhante/i);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await pool.end();
  }
});
