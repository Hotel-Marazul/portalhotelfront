import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { createApp } from "../../src/app.js";
import { pool } from "../../src/db/client.js";
import { initializeDatabase } from "../../src/db/init.js";
import { signAccessToken } from "../../src/utils/jwt.js";
import { buildConversationFacts } from "../../src/modules/whatsapp/facts.service.js";

test("tarifas sazonais: cotação, gravação, replay, snapshot e WhatsApp no PostgreSQL", async () => {
  assert.ok(process.env.DB_NAME?.endsWith("_test"), "Executar somente em banco descartável terminado em _test.");
  await initializeDatabase();
  const code = `test-${randomUUID()}`;
  const user = (await pool.query("SELECT id,email,role FROM users WHERE role='admin' LIMIT 1")).rows[0];
  assert.ok(user);
  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${signAccessToken(user)}` };
  const server = createApp().listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const url = `http://127.0.0.1:${address.port}/api`;
  async function request(path: string, body?: unknown, method = "POST") {
    const response = await fetch(`${url}${path}`, { headers, method, ...(body ? { body: JSON.stringify(body) } : {}) });
    const result = await response.json();
    return { status: response.status, body: result };
  }
  const clientId = randomUUID();
  try {
    await pool.query("INSERT INTO clients (id,full_name,cpf,email,fone) VALUES ($1,'Fixture Tarifas','00000000000',$2,'00000000000')", [clientId, `${clientId}@example.invalid`]);
    for (const [min, max, amount, basis] of [[0, 2, 0, "per_daily"], [3, 5, 100, "per_stay"], [6, 11, 120, "per_daily"], [12, 120, 200, "per_daily"]] as const) {
      await pool.query("INSERT INTO pricing_rules (id,name,description,min_age,max_age,price,billing_basis,catalog_code) VALUES ($1,$2,'Fixture',$3,$4,$5,$6,$7)", [randomUUID(), `${code}-${min}`, min, max, amount, basis, code]);
    }
    const categories: Array<{ id: string; roomId: string; breakfast: number; halfBoard: number; name: string }> = [];
    let number = 8000000;
    for (const [name, breakfast, halfBoard] of [["Super Luxo", 528, 638], ["Luxo", 495, 605], ["Standard", 473, 583], ["Simples", 440, 550]] as const) {
      const id = randomUUID(), roomId = randomUUID();
      const fixtureName = `${name} ${code}`;
      await pool.query(`INSERT INTO categories (id,name,price,couple_price,half_board_price,rate_valid_from,rate_valid_until,tariff_catalog_code)
        VALUES ($1,$2,$3,$3,$4,'2026-12-01','2027-03-01',$5)`, [id, fixtureName, breakfast, halfBoard, code]);
      await pool.query("INSERT INTO rooms (id,number,type,capacity,daily_price,status,category_id) VALUES ($1,$2,$3,8,$4,'Disponível',$5)", [roomId, ++number, fixtureName, breakfast, id]);
      categories.push({ id, roomId, breakfast, halfBoard, name: fixtureName });
    }
    const guests = [{ name: "Acompanhante", age: 35 }, { name: "Criança", age: 4 }];
    const payload = (roomId: string) => ({ roomId, clientId, checkInDate: "2026-12-20", checkOutDate: "2026-12-25", guests });
    for (const category of categories) {
      for (const mealPlan of ["breakfast", "half_board"] as const) {
        const quote = await request("/reservations/quote", { ...payload(category.roomId), mealPlan });
        assert.equal(quote.status, 200, JSON.stringify(quote.body));
        assert.equal(quote.body.pricing.totalPrice, (mealPlan === "breakfast" ? category.breakfast : category.halfBoard) * 5 + 100);
        assert.equal(quote.body.pricing.additionalStayTotal, 100);
        assert.equal(quote.body.pricing.additionalDailyTotal, 0);
      }
    }
    const standard = categories[2];
    const body = { ...payload(standard.roomId), idempotencyKey: randomUUID() };
    const created = await request("/reservations", body);
    assert.equal(created.status, 201, JSON.stringify(created.body));
    assert.equal(created.body.totalPrice, 2465);
    assert.equal(created.body.pricing.additionalStayTotal, 100);
    const id = created.body.id;
    assert.equal((await request("/reservations", body)).status, 200);
    assert.equal((await request("/reservations", { ...body, mealPlan: "half_board" })).status, 409);

    await pool.query("UPDATE categories SET price=999,couple_price=999 WHERE id=$1", [standard.id]);
    const savedQuote = await request("/reservations/quote", { ...payload(standard.roomId), reservationId: id });
    assert.equal(savedQuote.status, 200);
    assert.equal(savedQuote.body.pricing.totalPrice, 2465, "O catálogo alterado não muda o snapshot.");
    const updated = await request(`/reservations/${id}`, { ...payload(standard.roomId), version: 1 }, "PUT");
    assert.equal(updated.status, 200, JSON.stringify(updated.body));
    assert.equal(updated.body.totalPrice, 2465);
    const changedMeal = await request(`/reservations/${id}`, { ...payload(standard.roomId), version: 2, mealPlan: "half_board" }, "PUT");
    assert.equal(changedMeal.status, 200, JSON.stringify(changedMeal.body));
    assert.equal(changedMeal.body.totalPrice, 3015);
    assert.equal(changedMeal.body.pricing.mealPlan, "half_board");
    const read = await request(`/reservations/${id}`, undefined, "GET");
    assert.equal(read.body.pricing.additionalStayTotal, 100);
    const listed = await request("/reservations?pageSize=100", undefined, "GET");
    assert.equal(listed.body.items.find((item: { id: string }) => item.id === id).pricing.mealPlan, "half_board");

    const outside = await request("/reservations/quote", { ...payload(categories[0].roomId), checkInDate: "2027-03-01", checkOutDate: "2027-03-06" });
    // Fora da validade a reserva continua liberada, pela diária atual da categoria.
    assert.equal(outside.status, 200, JSON.stringify(outside.body));
    assert.equal(outside.body.pricing.totalPrice, categories[0].breakfast * 5 + 100);
    const tooMany = await request("/reservations/quote", { ...payload(categories[0].roomId), guests: Array.from({ length: 8 }, () => ({ name: "Extra", age: 18 })) });
    assert.equal(tooMany.status, 400);

    const facts = await buildConversationFacts(randomUUID(), { checkIn: "2026-12-26", checkOut: "2026-12-31", adults: 2, childrenAges: [4] });
    assert.ok(facts.prices.some((price) => price.category === `${categories[0].name} — só café` && price.total === "2740.00"));
    assert.ok(facts.prices.some((price) => price.category === `${categories[0].name} — meia pensão` && price.total === "3290.00"));
    // A IA também cota fora da validade, pela diária atual (2027-03-01..06 = 5 noites só café + criança de 4 anos).
    const outsideFacts = await buildConversationFacts(randomUUID(), { checkIn: "2027-03-01", checkOut: "2027-03-06", adults: 2, childrenAges: [4] });
    assert.ok(outsideFacts.prices.some((price) => price.category === `${categories[0].name} — só café` && price.total === (categories[0].breakfast * 5 + 100).toFixed(2)), JSON.stringify(outsideFacts.prices));
    const available = await request("/rooms/availability?checkIn=2026-12-26&checkOut=2026-12-31&guestCount=2", undefined, "GET");
    assert.equal(available.status, 200);
    const quoted = available.body.find((room: { id: string }) => room.id === categories[0].roomId);
    assert.equal(quoted.pricingQuotes.half_board.totalPrice, 3190);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    await pool.end();
  }
});
