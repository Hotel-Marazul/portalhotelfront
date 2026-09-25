import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { pool } from "../../src/db/client.js";
import { initializeDatabase } from "../../src/db/init.js";
import { env } from "../../src/config/env.js";
import { processPendingWebhookEvents } from "../../src/modules/whatsapp/webhook.worker.js";

const inbound = JSON.parse(readFileSync("tests/fixtures/whatsapp/messages-upsert-inbound-text.json", "utf8"));

test("worker isola falhas e reprocessa o evento corrigido sem duplicar", async () => {
  await initializeDatabase();
  const badId = randomUUID();
  const goodId = randomUUID();
  const exhaustedId = randomUUID();
  const previousInstance = env.EVOLUTION_INSTANCE;
  const instance = `worker-${randomUUID()}`;
  env.EVOLUTION_INSTANCE = instance;
  const phone = `55118888${String(Math.floor(Math.random() * 10000)).padStart(4, "0")}`;
  const remoteJid = `${phone}@s.whatsapp.net`;
  const providerMessageId = `worker-${randomUUID()}`;
  const validPayload = {
    ...inbound,
    instance,
    data: {
      ...inbound.data,
      key: { ...inbound.data.key, remoteJid, id: providerMessageId },
      pushName: "Worker Fixture"
    }
  };
  const invalidPayload = {
    ...validPayload,
    data: {
      ...validPayload.data,
      key: { ...validPayload.data.key, remoteJid: "not-a-phone@s.whatsapp.net" }
    }
  };

  try {
    await pool.query(
      `INSERT INTO whatsapp_webhook_events (id, instance_name, event_type, payload)
       VALUES ($1, $6, 'messages.upsert', $2::jsonb),
              ($3, $6, 'messages.upsert', $4::jsonb),
              ($5, $6, 'messages.upsert', $2::jsonb)`,
      [badId, JSON.stringify(invalidPayload), goodId, JSON.stringify(validPayload), exhaustedId, instance]
    );

    const processed = await processPendingWebhookEvents(100, true);
    assert.ok(processed >= 1);

    const firstAttempt = await pool.query<{
      processed_at: string | null;
      attempts: number;
      process_error: string | null;
    }>(
      "SELECT processed_at::text, attempts, process_error FROM whatsapp_webhook_events WHERE id = $1",
      [badId]
    );
    assert.equal(firstAttempt.rows[0]?.processed_at, null);
    assert.equal(firstAttempt.rows[0]?.attempts, 1);
    assert.equal(firstAttempt.rows[0]?.process_error, "invalid_phone");

    const secondAttempt = await pool.query<{ processed_at: string | null; process_error: string | null }>(
      "SELECT processed_at::text, process_error FROM whatsapp_webhook_events WHERE id = $1",
      [goodId]
    );
    assert.ok(secondAttempt.rows[0]?.processed_at);
    assert.equal(secondAttempt.rows[0]?.process_error, null);

    for (let attempt = 0; attempt < 4; attempt += 1) {
      await processPendingWebhookEvents(100, true);
    }
    const exhausted = await pool.query<{ attempts: number; processed_at: string | null }>(
      "SELECT attempts, processed_at::text FROM whatsapp_webhook_events WHERE id = $1",
      [exhaustedId]
    );
    assert.equal(exhausted.rows[0]?.attempts, 5);
    assert.equal(exhausted.rows[0]?.processed_at, null);
    assert.equal(await processPendingWebhookEvents(100, true), 0);

    await pool.query(
      `UPDATE whatsapp_webhook_events
       SET payload = $2::jsonb, attempts = 0, process_error = NULL
       WHERE id = $1`,
      [badId, JSON.stringify(validPayload)]
    );
    const reprocessed = await processPendingWebhookEvents(100, true);
    assert.ok(reprocessed >= 1);

    const messages = await pool.query<{ count: number }>(
      `SELECT COUNT(*)::int AS count
       FROM whatsapp_messages message
       JOIN whatsapp_conversations conversation ON conversation.id = message.conversation_id
       JOIN whatsapp_contacts contact ON contact.id = conversation.contact_id
       WHERE contact.remote_jid = $1`,
      [remoteJid]
    );
    assert.equal(messages.rows[0]?.count, 1);
  } finally {
    await pool.query("DELETE FROM whatsapp_contacts WHERE remote_jid = $1", [remoteJid]);
    await pool.query("DELETE FROM whatsapp_webhook_events WHERE id = ANY($1::uuid[])", [[badId, goodId, exhaustedId]]);
    env.EVOLUTION_INSTANCE = previousInstance;
    await pool.end();
  }
});
