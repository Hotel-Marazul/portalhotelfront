import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { createApp } from "../../src/app.js";
import { env } from "../../src/config/env.js";
import { pool } from "../../src/db/client.js";
import { initializeDatabase } from "../../src/db/init.js";
import {
  AgentsClientError,
  aiAvailability,
  triageWithAgents
} from "../../src/modules/whatsapp/agents-client.js";
import { buildConversationFacts } from "../../src/modules/whatsapp/facts.service.js";
import { signAccessToken } from "../../src/utils/jwt.js";

function listen(server: Server): Promise<Server> {
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(server)));
}

function triagePayload() {
  return {
    hotelToday: "2040-01-01",
    timezone: env.HOTEL_TIMEZONE,
    guestFirstName: null,
    knownContext: { isSupplier: false, reservations: [] },
    messages: [{ direction: "inbound" as const, text: "Quero reservar", sentAt: "2040-01-01T12:00:00Z", media: null }]
  };
}

test("cliente de IA respeita o limite diário e libera no dia seguinte", { concurrency: false }, async () => {
  await initializeDatabase();
  const previous = {
    enabled: env.WHATSAPP_AI_ENABLED,
    limit: env.WHATSAPP_AI_DAILY_LIMIT,
    url: env.AGENTS_API_URL,
    key: env.AGENTS_API_KEY
  };
  let calls = 0;
  const agent = await listen(createServer((_req, res) => {
    calls += 1;
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({
      intent: "reserva_nova",
      checkIn: null,
      checkOut: null,
      adults: null,
      childrenAges: [],
      requests: [],
      missingFields: ["dates", "guests"],
      headline: "Pedido de reserva",
      markerText: "IA leu: pedido de reserva"
    }));
  }));
  const address = agent.address();
  assert.ok(address && typeof address !== "string");
  env.WHATSAPP_AI_ENABLED = true;
  env.WHATSAPP_AI_DAILY_LIMIT = 1;
  env.AGENTS_API_URL = `http://127.0.0.1:${address.port}`;
  env.AGENTS_API_KEY = "a".repeat(32);

  try {
    await pool.query("DELETE FROM whatsapp_ai_daily_usage WHERE usage_date >= (NOW() AT TIME ZONE $1)::date", [env.HOTEL_TIMEZONE]);
    const first = await triageWithAgents(triagePayload());
    assert.equal(first.intent, "reserva_nova");
    assert.equal(calls, 1);
    await assert.rejects(
      triageWithAgents(triagePayload()),
      (error: unknown) => error instanceof AgentsClientError && error.reason === "daily_limit"
    );
    assert.deepEqual(await aiAvailability(), { available: false, reason: "daily_limit" });

    await pool.query("DELETE FROM whatsapp_ai_daily_usage WHERE usage_date >= (NOW() AT TIME ZONE $1)::date", [env.HOTEL_TIMEZONE]);
    await pool.query(
      `INSERT INTO whatsapp_ai_daily_usage (usage_date, calls)
       VALUES ((NOW() AT TIME ZONE $1)::date - 1, 1)
       ON CONFLICT (usage_date) DO UPDATE SET calls = EXCLUDED.calls`,
      [env.HOTEL_TIMEZONE]
    );
    assert.deepEqual(await aiAvailability(), { available: true, reason: null });
    await triageWithAgents(triagePayload());
    assert.equal(calls, 2);
  } finally {
    await new Promise<void>((resolve) => agent.close(() => resolve()));
    await pool.query("DELETE FROM whatsapp_ai_daily_usage WHERE usage_date >= (NOW() AT TIME ZONE $1)::date", [env.HOTEL_TIMEZONE]);
    env.WHATSAPP_AI_ENABLED = previous.enabled;
    env.WHATSAPP_AI_DAILY_LIMIT = previous.limit;
    env.AGENTS_API_URL = previous.url;
    env.AGENTS_API_KEY = previous.key;
  }
});

test("fatos da conversa não expõem PII e reutilizam o preço da cotação", { concurrency: false }, async () => {
  await initializeDatabase();
  const categoryId = randomUUID();
  const roomId = randomUUID();
  const clientId = randomUUID();
  const contactId = randomUUID();
  const conversationId = randomUUID();
  const admin = await pool.query<{ id: string; email: string; role: "admin" | "receptionist" }>(
    "SELECT id, email, role FROM users WHERE role = 'admin' ORDER BY created_at ASC LIMIT 1"
  );
  assert.ok(admin.rows[0]);
  const category = `Fatos ${categoryId}`;
  const secretPhone = "+5548998765432";
  const secretCpf = "98765432100";
  const secretEmail = `facts-${clientId}@example.test`;
  await pool.query(
    `INSERT INTO categories (id, name, price, single_price, couple_price)
     VALUES ($1, $2, 123, 123, 180)`,
    [categoryId, category]
  );
  await pool.query(
    `INSERT INTO rooms (id, number, type, capacity, daily_price, status, category_id)
     VALUES ($1, $2, 'Fatos', 2, 123, 'Disponível', $3)`,
    [roomId, Number(`7${Date.now()}`.slice(-7)), categoryId]
  );
  await pool.query(
    `INSERT INTO clients (id, full_name, cpf, email, fone)
     VALUES ($1, 'Nome Sobrenome Secreto', $2, $3, $4)`,
    [clientId, secretCpf, secretEmail, secretPhone]
  );
  await pool.query(
    `INSERT INTO whatsapp_contacts (id, remote_jid, phone_e164, push_name, client_id)
     VALUES ($1, $2, $3, 'Nome Sobrenome Secreto', $4)`,
    [contactId, `${secretPhone.slice(1)}@s.whatsapp.net`, secretPhone, clientId]
  );
  await pool.query("INSERT INTO whatsapp_conversations (id, contact_id) VALUES ($1, $2)", [conversationId, contactId]);

  const app = createApp();
  const server = await listen(app.listen(0, "127.0.0.1"));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const headers = { Authorization: `Bearer ${signAccessToken(admin.rows[0])}`, "Content-Type": "application/json" };
  const endpoint = `http://127.0.0.1:${address.port}`;

  try {
    const facts = await buildConversationFacts(conversationId, {
      checkIn: "2040-01-10",
      checkOut: "2040-01-12",
      adults: 1,
      childrenAges: []
    });
    const serialized = JSON.stringify(facts);
    assert.doesNotMatch(serialized, new RegExp(secretCpf));
    assert.doesNotMatch(serialized, new RegExp(secretPhone.replace("+", "\\+")));
    assert.doesNotMatch(serialized, new RegExp(secretEmail));
    assert.doesNotMatch(serialized, /Sobrenome/);
    assert.doesNotMatch(serialized, /payment|pagamento/i);

    const quote = await fetch(`${endpoint}/api/reservations/quote`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        roomId,
        clientId,
        checkInDate: "2040-01-10",
        checkOutDate: "2040-01-12",
        guests: []
      })
    });
    assert.equal(quote.status, 200);
    const quoteBody = await quote.json() as { pricing: { totalPrice: number } };
    const categoryPrice = facts.prices.find((price) => price.category === category);
    assert.equal(categoryPrice?.total, quoteBody.pricing.totalPrice.toFixed(2));
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await pool.query("DELETE FROM whatsapp_contacts WHERE id = $1", [contactId]);
    await pool.query("DELETE FROM clients WHERE id = $1", [clientId]);
    await pool.query("DELETE FROM rooms WHERE id = $1", [roomId]);
    await pool.query("DELETE FROM categories WHERE id = $1", [categoryId]);
    await pool.end();
  }
});
