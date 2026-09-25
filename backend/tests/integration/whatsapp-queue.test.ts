import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { Server } from "node:http";
import test from "node:test";
import { createApp } from "../../src/app.js";
import { env } from "../../src/config/env.js";
import { pool } from "../../src/db/client.js";
import { initializeDatabase } from "../../src/db/init.js";
import { signAccessToken } from "../../src/utils/jwt.js";

test("fila ordena espera, limita fornecedor, filtra leads e busca fora da fila", async () => {
  await initializeDatabase();
  await pool.query(
    "DELETE FROM whatsapp_contacts WHERE push_name IN ('Pessoa Fixture', 'Worker Fixture', 'Episódio Fixture')"
  );
  const previousWhatsappEnabled = env.WHATSAPP_ENABLED;
  const previousAiEnabled = env.WHATSAPP_AI_ENABLED;
  env.WHATSAPP_ENABLED = true;
  env.WHATSAPP_AI_ENABLED = false;

  const leadOldId = randomUUID();
  const leadNewId = randomUUID();
  const supplierId = randomUUID();
  const answeredId = randomUUID();
  const contacts = [leadOldId, leadNewId, supplierId, answeredId];
  const conversations = contacts.map(() => randomUUID());
  const messages = contacts.map(() => randomUUID());
  const readings = contacts.slice(0, 2).map(() => randomUUID());
  const phones = ["+5548999991001", "+5548999991002", "+5548999991003", "+5548988412207"];

  const admin = await pool.query<{ id: string; email: string; role: "admin" | "receptionist" }>(
    "SELECT id, email, role FROM users WHERE role = 'admin' ORDER BY created_at ASC LIMIT 1"
  );
  assert.ok(admin.rows[0]);
  const app = createApp();
  const server = await new Promise<Server>((resolve) => {
    const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
  });
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const authorization = `Bearer ${signAccessToken(admin.rows[0])}`;
  const request = (path: string) => fetch(`http://127.0.0.1:${address.port}${path}`, {
    headers: { Authorization: authorization }
  });

  try {
    await pool.query(
      `INSERT INTO whatsapp_contacts (id, remote_jid, phone_e164, push_name, kind)
       VALUES
         ($1, $5, $6, 'Lead Antigo', 'guest'),
         ($2, $7, $8, 'Lead Novo', 'guest'),
         ($3, $9, $10, 'Fornecedor Fixture', 'supplier'),
         ($4, $11, $12, 'Respondido Fixture', 'guest')`,
      [
        ...contacts,
        `${phones[0]?.slice(1)}@s.whatsapp.net`, phones[0],
        `${phones[1]?.slice(1)}@s.whatsapp.net`, phones[1],
        `${phones[2]?.slice(1)}@s.whatsapp.net`, phones[2],
        `${phones[3]?.slice(1)}@s.whatsapp.net`, phones[3]
      ]
    );
    await pool.query(
      `INSERT INTO whatsapp_conversations
       (id, contact_id, awaiting_since, last_message_at, unread_count, base_score, score_reasons, triage_status)
       VALUES
         ($1, $5, NOW() - (15 * INTERVAL '1 minute'), NOW() - (15 * INTERVAL '1 minute'), 2, 45, '[]', 'done'),
         ($2, $6, NOW() - (25 * INTERVAL '1 minute'), NOW() - (25 * INTERVAL '1 minute'), 1, 35, '[]', 'done'),
         ($3, $7, NOW() - (25 * INTERVAL '1 minute'), NOW() - (25 * INTERVAL '1 minute'), 1, 95, '[]', 'done'),
         ($4, $8, NULL, NOW() - (1 * INTERVAL '1 hour'), 0, 20, '[]', 'done')`,
      [...conversations, ...contacts]
    );
    await pool.query(
      `INSERT INTO whatsapp_messages
       (id, conversation_id, direction, origin, body, status, sent_at)
       VALUES
         ($1, $5, 'inbound', 'guest', 'pedido antigo', 'received', NOW() - (15 * INTERVAL '1 minute')),
         ($2, $6, 'inbound', 'guest', 'pedido novo', 'received', NOW() - (25 * INTERVAL '1 minute')),
         ($3, $7, 'inbound', 'guest', 'nota fiscal', 'received', NOW() - (25 * INTERVAL '1 minute')),
         ($4, $8, 'outbound', 'phone', 'resposta enviada', 'sent', NOW() - (1 * INTERVAL '1 hour'))`,
      [...messages, ...conversations]
    );
    await pool.query(
      `INSERT INTO whatsapp_ai_readings
       (id, conversation_id, last_message_id, intent, headline, marker_text,
        signals, facts, base_score, level, reasons, model)
       VALUES
         ($1, $3, $5, 'reserva_nova', 'Pedido antigo', 'IA leu: pedido antigo', '{}', '{}', 45, 'hoje', '[]', 'fixture'),
         ($2, $4, $6, 'preco', 'Pedido novo', 'IA leu: pedido novo', '{}', '{}', 35, 'hoje', '[]', 'fixture')`,
      [readings[0], readings[1], conversations[0], conversations[1], messages[0], messages[1]]
    );
    await pool.query(
      `UPDATE whatsapp_conversations SET current_reading_id = CASE id
         WHEN $1 THEN $3::uuid
         WHEN $2 THEN $4::uuid
       END
       WHERE id IN ($1, $2)`,
      [conversations[0], conversations[1], readings[0], readings[1]]
    );

    const queueResponse = await request("/api/whatsapp/queue?filter=todas");
    assert.equal(queueResponse.status, 200);
    const queue = await queueResponse.json() as {
      waiting: Array<{ conversationId: string; score: number | null; group: string }>;
      answered: Array<{ conversationId: string }>;
      counts: { todas: number; lead: number; reserva: number; outros: number };
    };
    assert.equal(queue.waiting.length, 3);
    assert.equal(queue.waiting[0]?.conversationId, conversations[1]);
    assert.equal(queue.waiting[1]?.conversationId, conversations[0]);
    assert.equal(queue.waiting[2]?.conversationId, conversations[2]);
    assert.equal(queue.waiting[2]?.score, 39);
    assert.equal(queue.waiting[0]?.group, "lead");
    assert.equal(queue.waiting[1]?.group, "lead");
    assert.equal(queue.waiting[2]?.group, "outros");
    assert.equal(queue.counts.todas, 3);
    assert.equal(queue.counts.lead, 2);
    assert.equal(queue.counts.outros, 1);
    assert.ok(queue.answered.some((item) => item.conversationId === conversations[3]));

    const leadResponse = await request("/api/whatsapp/queue?filter=lead");
    assert.equal(leadResponse.status, 200);
    const leadQueue = await leadResponse.json() as { waiting: Array<{ conversationId: string }> };
    assert.deepEqual(leadQueue.waiting.map((item) => item.conversationId), [conversations[1], conversations[0]]);

    const searchResponse = await request("/api/whatsapp/conversations?search=98841");
    assert.equal(searchResponse.status, 200);
    const search = await searchResponse.json() as { items: Array<{ conversationId: string }> };
    assert.deepEqual(search.items.map((item) => item.conversationId), [conversations[3]]);

    const countResponse = await request("/api/whatsapp/queue/count");
    assert.equal(countResponse.status, 200);
    assert.deepEqual(await countResponse.json(), { waiting: 3 });

    const statusResponse = await request("/api/whatsapp/status");
    assert.equal(statusResponse.status, 200);
    const status = await statusResponse.json() as {
      enabled: boolean;
      connectionState: string;
      ai: { available: boolean; reason: string | null };
    };
    assert.equal(status.enabled, true);
    assert.equal(status.connectionState, "unknown");
    assert.equal(status.ai.available, false);
    assert.equal(status.ai.reason, "disabled");

    const previousAgentsUrl = env.AGENTS_API_URL;
    const previousAgentsKey = env.AGENTS_API_KEY;
    const previousDailyLimit = env.WHATSAPP_AI_DAILY_LIMIT;
    const existingUsage = await pool.query<{ usage_date: string; calls: number }>(
      "SELECT usage_date::text, calls FROM whatsapp_ai_daily_usage WHERE usage_date = (NOW() AT TIME ZONE $1)::date",
      [env.HOTEL_TIMEZONE]
    );
    try {
      env.WHATSAPP_AI_ENABLED = true;
      env.AGENTS_API_URL = undefined;
      env.AGENTS_API_KEY = undefined;
      const notConfiguredResponse = await request("/api/whatsapp/status");
      const notConfigured = await notConfiguredResponse.json() as { ai: { available: boolean; reason: string | null } };
      assert.equal(notConfigured.ai.available, false);
      assert.equal(notConfigured.ai.reason, "not_configured");

      env.AGENTS_API_URL = "http://agents.fixture";
      env.AGENTS_API_KEY = "a".repeat(32);
      env.WHATSAPP_AI_DAILY_LIMIT = 1;
      await pool.query(
        `INSERT INTO whatsapp_ai_daily_usage (usage_date, calls)
         VALUES ((NOW() AT TIME ZONE $1)::date, 1)
         ON CONFLICT (usage_date) DO UPDATE SET calls = 1`,
        [env.HOTEL_TIMEZONE]
      );
      const limitedResponse = await request("/api/whatsapp/status");
      const limited = await limitedResponse.json() as { ai: { available: boolean; reason: string | null } };
      assert.equal(limited.ai.available, false);
      assert.equal(limited.ai.reason, "daily_limit");
    } finally {
      if (existingUsage.rows[0]) {
        await pool.query(
          "UPDATE whatsapp_ai_daily_usage SET calls = $1 WHERE usage_date = $2::date",
          [existingUsage.rows[0].calls, existingUsage.rows[0].usage_date]
        );
      } else {
        await pool.query("DELETE FROM whatsapp_ai_daily_usage WHERE usage_date = (NOW() AT TIME ZONE $1)::date", [env.HOTEL_TIMEZONE]);
      }
      env.AGENTS_API_URL = previousAgentsUrl;
      env.AGENTS_API_KEY = previousAgentsKey;
      env.WHATSAPP_AI_DAILY_LIMIT = previousDailyLimit;
      env.WHATSAPP_AI_ENABLED = previousAiEnabled;
    }
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await pool.query("DELETE FROM whatsapp_contacts WHERE id = ANY($1::uuid[])", [contacts]);
    env.WHATSAPP_ENABLED = previousWhatsappEnabled;
    env.WHATSAPP_AI_ENABLED = previousAiEnabled;
    await pool.end();
  }
});
