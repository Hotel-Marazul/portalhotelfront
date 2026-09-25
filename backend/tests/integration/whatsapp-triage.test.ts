import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { env } from "../../src/config/env.js";
import { pool } from "../../src/db/client.js";
import { initializeDatabase } from "../../src/db/init.js";
import { runTriageOnce } from "../../src/modules/whatsapp/triage.worker.js";

function roomNumber() {
  return Number((BigInt(`0x${randomUUID().replaceAll("-", "")}`) % 90_000_000n + 10_000_000n).toString());
}

test("worker agrupa por 20 segundos, recupera travadas e grava leitura fallback", async () => {
  await initializeDatabase();
  const previous = {
    enabled: env.WHATSAPP_AI_ENABLED,
    agentsUrl: env.AGENTS_API_URL,
    agentsKey: env.AGENTS_API_KEY
  };
  env.WHATSAPP_AI_ENABLED = false;
  env.AGENTS_API_URL = undefined;
  env.AGENTS_API_KEY = undefined;
  const contactId = randomUUID();
  const conversationId = randomUUID();
  const messageId = randomUUID();
  const phone = `+5548${String(roomNumber()).slice(-8)}`;

  await pool.query(
    `INSERT INTO whatsapp_contacts (id, remote_jid, phone_e164, push_name)
     VALUES ($1, $2, $3, 'Triagem Fixture')`,
    [contactId, `${phone.slice(1)}@s.whatsapp.net`, phone]
  );
  await pool.query(
    `INSERT INTO whatsapp_conversations
     (id, contact_id, awaiting_since, last_message_at, triage_status, triage_requested_at)
     VALUES ($1, $2, NOW(), NOW(), 'pending', NOW() - INTERVAL '10 seconds')`,
    [conversationId, contactId]
  );
  await pool.query(
    `INSERT INTO whatsapp_messages
     (id, conversation_id, direction, origin, body, media_type, status, sent_at)
     VALUES ($1, $2, 'inbound', 'guest', 'Quero uma reserva', 'text', 'received', NOW())`,
    [messageId, conversationId]
  );

  try {
    await runTriageOnce(100);
    let state = await pool.query<{ triage_status: string; current_reading_id: string | null }>(
      "SELECT triage_status, current_reading_id FROM whatsapp_conversations WHERE id = $1",
      [conversationId]
    );
    assert.equal(state.rows[0]?.triage_status, "pending");
    assert.equal(state.rows[0]?.current_reading_id, null);

    await pool.query(
      "UPDATE whatsapp_conversations SET triage_requested_at = NOW() - INTERVAL '1 minute' WHERE id = $1",
      [conversationId]
    );
    await runTriageOnce(100);
    state = await pool.query<{ triage_status: string; current_reading_id: string | null }>(
      "SELECT triage_status, current_reading_id FROM whatsapp_conversations WHERE id = $1",
      [conversationId]
    );
    assert.equal(state.rows[0]?.triage_status, "skipped");
    assert.ok(state.rows[0]?.current_reading_id);
    const reading = await pool.query<{ model: string; intent: string; headline: string }>(
      "SELECT model, intent, headline FROM whatsapp_ai_readings WHERE id = $1",
      [state.rows[0]?.current_reading_id]
    );
    assert.deepEqual(reading.rows[0], { model: "fallback", intent: "desconhecida", headline: "Sem leitura da IA" });

    await pool.query(
      `UPDATE whatsapp_conversations
       SET triage_status = 'running', triage_started_at = NOW() - INTERVAL '3 minutes',
           triage_requested_at = NOW() - INTERVAL '1 minute'
       WHERE id = $1`,
      [conversationId]
    );
    await runTriageOnce(100);
    state = await pool.query<{ triage_status: string }>(
      "SELECT triage_status FROM whatsapp_conversations WHERE id = $1",
      [conversationId]
    );
    assert.equal(state.rows[0]?.triage_status, "skipped");
  } finally {
    await pool.query("DELETE FROM whatsapp_contacts WHERE id = $1", [contactId]);
    env.WHATSAPP_AI_ENABLED = previous.enabled;
    env.AGENTS_API_URL = previous.agentsUrl;
    env.AGENTS_API_KEY = previous.agentsKey;
    await pool.end();
  }
});
