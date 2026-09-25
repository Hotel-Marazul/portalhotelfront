import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { env } from "../../src/config/env.js";
import { pool } from "../../src/db/client.js";
import { initializeDatabase } from "../../src/db/init.js";
import { getOrCreateSuggestion } from "../../src/modules/whatsapp/suggestions.service.js";

function listen(server: Server): Promise<Server> {
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(server)));
}

test("sugestão viva é reutilizada e conversa respondida não gera nova chamada", async () => {
  await initializeDatabase();
  const previous = {
    enabled: env.WHATSAPP_AI_ENABLED,
    url: env.AGENTS_API_URL,
    key: env.AGENTS_API_KEY,
    limit: env.WHATSAPP_AI_DAILY_LIMIT
  };
  const contactId = randomUUID();
  const conversationId = randomUUID();
  const episodeId = randomUUID();
  const readingId = randomUUID();
  const messageId = randomUUID();
  let calls = 0;
  const agent = await listen(createServer((_req, res) => {
    calls += 1;
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({
      parts: [{ text: "Olá!", gap: false }, { text: "[confirmar data]", gap: true }],
      basis: ["contexto", "política"]
    }));
  }));
  const address = agent.address();
  assert.ok(address && typeof address !== "string");
  env.WHATSAPP_AI_ENABLED = true;
  env.AGENTS_API_URL = `http://127.0.0.1:${address.port}`;
  env.AGENTS_API_KEY = "s".repeat(32);
  env.WHATSAPP_AI_DAILY_LIMIT = 100;
  const phone = `+5548${String(Number((BigInt(`0x${randomUUID().replaceAll("-", "")}`) % 90_000_000n) + 10_000_000n)).slice(-8)}`;

  await pool.query(
    `INSERT INTO whatsapp_contacts (id, remote_jid, phone_e164, push_name)
     VALUES ($1, $2, $3, 'Sugestão Fixture')`,
    [contactId, `${phone.slice(1)}@s.whatsapp.net`, phone]
  );
  await pool.query("INSERT INTO whatsapp_conversations (id, contact_id, awaiting_since, last_message_at) VALUES ($1, $2, NOW(), NOW())", [conversationId, contactId]);
  await pool.query("INSERT INTO whatsapp_episodes (id, conversation_id, started_at, is_lead) VALUES ($1, $2, NOW(), TRUE)", [episodeId, conversationId]);
  await pool.query(
    `INSERT INTO whatsapp_messages (id, conversation_id, episode_id, direction, origin, body, status, sent_at)
     VALUES ($1, $2, $3, 'inbound', 'guest', 'Quero reservar', 'received', NOW())`,
    [messageId, conversationId, episodeId]
  );
  await pool.query(
    `INSERT INTO whatsapp_ai_readings
     (id, conversation_id, episode_id, last_message_id, intent, children_ages, requests, missing_fields,
      headline, marker_text, signals, facts, base_score, level, reasons, model)
     VALUES ($1, $2, $3, $4, 'reserva_nova', '{}', '{}', '{dates}', 'Pedido', 'IA leu: pedido',
             '{}'::jsonb, '{}'::jsonb, 40, 'hoje', '[]'::jsonb, 'fixture')`,
    [readingId, conversationId, episodeId, messageId]
  );
  await pool.query("UPDATE whatsapp_conversations SET current_episode_id = $2, current_reading_id = $3 WHERE id = $1", [conversationId, episodeId, readingId]);

  try {
    await pool.query("DELETE FROM whatsapp_ai_daily_usage WHERE usage_date >= (NOW() AT TIME ZONE $1)::date", [env.HOTEL_TIMEZONE]);
    const first = await getOrCreateSuggestion(conversationId);
    const second = await getOrCreateSuggestion(conversationId);
    assert.ok(first);
    assert.equal(second?.id, first?.id);
    assert.equal(calls, 1);

    await pool.query("UPDATE whatsapp_conversations SET awaiting_since = NULL WHERE id = $1", [conversationId]);
    assert.equal(await getOrCreateSuggestion(conversationId), null);
    assert.equal(calls, 1);
  } finally {
    await new Promise<void>((resolve) => agent.close(() => resolve()));
    await pool.query("DELETE FROM whatsapp_contacts WHERE id = $1", [contactId]);
    env.WHATSAPP_AI_ENABLED = previous.enabled;
    env.AGENTS_API_URL = previous.url;
    env.AGENTS_API_KEY = previous.key;
    env.WHATSAPP_AI_DAILY_LIMIT = previous.limit;
    await pool.end();
  }
});
