import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { env } from "../../src/config/env.js";
import { pool } from "../../src/db/client.js";
import { initializeDatabase } from "../../src/db/init.js";
import { runWhatsappRetention } from "../../src/modules/whatsapp/retention.job.js";

test("retenção remove mensagens, atendimentos fechados e eventos processados sem remover regras", async () => {
  await initializeDatabase();
  const previousMonths = env.WHATSAPP_RETENTION_MONTHS;
  env.WHATSAPP_RETENTION_MONTHS = 1;
  const contactId = randomUUID();
  const conversationId = randomUUID();
  const episodeId = randomUUID();
  const messageId = randomUUID();
  const webhookId = randomUUID();
  const old = new Date("2020-01-01T00:00:00Z");
  const phone = `+5548${String(Number((BigInt(`0x${randomUUID().replaceAll("-", "")}`) % 90_000_000n) + 10_000_000n)).slice(-8)}`;

  await pool.query(
    `INSERT INTO whatsapp_contacts (id, remote_jid, phone_e164, push_name)
     VALUES ($1, $2, $3, 'Retenção Fixture')`,
    [contactId, `${phone.slice(1)}@s.whatsapp.net`, phone]
  );
  await pool.query("INSERT INTO whatsapp_conversations (id, contact_id) VALUES ($1, $2)", [conversationId, contactId]);
  await pool.query(
    `INSERT INTO whatsapp_episodes (id, conversation_id, started_at, closed_at, close_reason)
     VALUES ($1, $2, $3, $3, 'idle')`,
    [episodeId, conversationId, old]
  );
  await pool.query("UPDATE whatsapp_conversations SET current_episode_id = $2 WHERE id = $1", [conversationId, episodeId]);
  await pool.query(
    `INSERT INTO whatsapp_messages (id, conversation_id, episode_id, direction, origin, body, status, sent_at, created_at)
     VALUES ($1, $2, $3, 'inbound', 'guest', 'antiga', 'received', $4, $4)`,
    [messageId, conversationId, episodeId, old]
  );
  await pool.query(
    `INSERT INTO whatsapp_webhook_events
     (id, instance_name, event_type, payload, received_at, processed_at)
     VALUES ($1, 'fixture', 'messages.upsert', '{}'::jsonb, $2, $2)`,
    [webhookId, old]
  );

  try {
    const result = await runWhatsappRetention();
    assert.equal(result.messages, 1);
    assert.equal(result.episodes, 1);
    assert.equal(result.events, 1);
    assert.equal((await pool.query("SELECT id FROM whatsapp_messages WHERE id = $1", [messageId])).rows.length, 0);
    assert.equal((await pool.query("SELECT id FROM whatsapp_episodes WHERE id = $1", [episodeId])).rows.length, 0);
    assert.equal((await pool.query("SELECT id FROM whatsapp_webhook_events WHERE id = $1", [webhookId])).rows.length, 0);
  } finally {
    await pool.query("DELETE FROM whatsapp_contacts WHERE id = $1", [contactId]);
    env.WHATSAPP_RETENTION_MONTHS = previousMonths;
    await pool.end();
  }
});
