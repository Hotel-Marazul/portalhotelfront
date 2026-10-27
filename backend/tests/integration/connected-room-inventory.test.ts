import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { initializeDatabase } from "../../src/db/init.js";
import { pool } from "../../src/db/client.js";
import { createApp } from "../../src/app.js";
import { signAccessToken } from "../../src/utils/jwt.js";

test("unidade conjugada aceita casal ou cinco pessoas e bloqueia seus dois números físicos", async () => {
  assert.ok(process.env.DB_NAME?.endsWith("_test"), "Usar banco descartável terminado em _test.");
  await initializeDatabase();
  const categoryId = randomUUID(), roomId = randomUUID(), clientId = randomUUID();
  const suffix = randomUUID();
  const number = 115, connected = 116;
  const user = (await pool.query("SELECT id,email,role FROM users WHERE role='admin' LIMIT 1")).rows[0];
  assert.ok(user);
  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${signAccessToken(user)}` };
  const server = createApp().listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const url = `http://127.0.0.1:${address.port}/api`;
  try {
    await pool.query("INSERT INTO categories(id,name,price,couple_price) VALUES ($1,$2,440,440)", [categoryId, `Conjugado ${suffix}`]);
    await pool.query("INSERT INTO rooms(id,number,type,capacity,daily_price,status,category_id,connected_room_number) VALUES ($1,$2,'Simples',5,440,'Disponível',$3,$4)", [roomId, number, categoryId, connected]);
    assert.deepEqual((await pool.query("SELECT number FROM room_inventory_numbers WHERE room_id=$1 ORDER BY number", [roomId])).rows.map((row) => row.number), [115,116]);
    // Both sequential creation and a separate connection hit the database guard.
    const duplicate = await fetch(`${url}/Rooms`, { method: "POST", headers, body: JSON.stringify({ roomNumber: 116, categoryId, capacity: 2, status: "Disponível" }) });
    assert.equal(duplicate.status, 409);
    assert.equal((await pool.query("SELECT count(*)::int AS n FROM rooms WHERE number=116")).rows[0].n, 0);
    const simultaneous = await Promise.allSettled([910011,910012].map((primary) => pool.query(
      "INSERT INTO rooms(id,number,type,capacity,daily_price,status,category_id,connected_room_number) VALUES ($1,$2,'Simples',5,440,'Disponível',$3,910013)",
      [randomUUID(), primary, categoryId]
    )));
    assert.equal(simultaneous.filter((result) => result.status === "fulfilled").length, 1);
    assert.equal(simultaneous.filter((result) => result.status === "rejected").length, 1);
    assert.equal((await pool.query("SELECT count(*)::int AS n FROM room_inventory_numbers WHERE number=910013")).rows[0].n, 1);
    const edited = await fetch(`${url}/Rooms/update/${roomId}`, { method: "PUT", headers, body: JSON.stringify({ status: "Disponível" }) });
    assert.equal(edited.status, 200);
    assert.equal((await edited.json() as { displayNumber: string }).displayNumber, "115/116");
    await pool.query("INSERT INTO clients(id,full_name,cpf,email,fone) VALUES ($1,'Fixture Conjugado','11111111111',$2,'00000000000')", [clientId, `${clientId}@example.invalid`]);
    const body = { roomId, clientId, checkInDate: "2038-12-20", checkOutDate: "2038-12-25", guests: [{ name: "Acompanhante", age: 35 }], idempotencyKey: randomUUID() };
    const created = await fetch(`${url}/reservations`, { method: "POST", headers, body: JSON.stringify(body) });
    assert.equal(created.status, 201, await created.clone().text());
    const detail = await created.json() as { room: { displayNumber: string }; totalPrice: number };
    assert.equal(detail.room.displayNumber, "115/116");
    assert.equal(detail.totalPrice, 2200);
    const overlaps = await fetch(`${url}/reservations`, { method: "POST", headers, body: JSON.stringify({ ...body, idempotencyKey: randomUUID() }) });
    assert.equal(overlaps.status, 409);
    const availability = await fetch(`${url}/rooms/availability?checkIn=2038-12-20&checkOut=2038-12-25&guestCount=2`, { headers });
    assert.ok(!(await availability.json() as Array<{ id: string }>).some((room) => room.id === roomId));
    const nextStay = await fetch(`${url}/rooms/availability?checkIn=2038-12-25&checkOut=2038-12-26&guestCount=5`, { headers });
    assert.ok((await nextStay.json() as Array<{ id: string }>).some((room) => room.id === roomId));
    const tooMany = await fetch(`${url}/rooms/availability?checkIn=2038-12-25&checkOut=2038-12-26&guestCount=6`, { headers });
    assert.ok(!(await tooMany.json() as Array<{ id: string }>).some((room) => room.id === roomId));
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    await pool.end();
  }
});
