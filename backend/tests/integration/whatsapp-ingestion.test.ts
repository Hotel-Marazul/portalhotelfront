import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { pool } from "../../src/db/client.js";
import { initializeDatabase } from "../../src/db/init.js";
import { ingestWebhookPayload } from "../../src/modules/whatsapp/ingestion.service.js";

const inbound = JSON.parse(readFileSync("tests/fixtures/whatsapp/messages-upsert-inbound-text.json", "utf8"));
const outbound = JSON.parse(readFileSync("tests/fixtures/whatsapp/messages-upsert-outbound-text.json", "utf8"));
const delivery = JSON.parse(readFileSync("tests/fixtures/whatsapp/messages-update-delivery.json", "utf8"));
const read = JSON.parse(readFileSync("tests/fixtures/whatsapp/messages-update-read.json", "utf8"));
const connectionClose = JSON.parse(readFileSync("tests/fixtures/whatsapp/connection-update-close.json", "utf8"));

test("ingestão é idempotente, acumula não lidas e respeita ordem temporal", async () => {
  await initializeDatabase();
  const phone = `55119999${String(Math.floor(Math.random() * 10000)).padStart(4, "0")}`;
  const remoteJid = `${phone}@s.whatsapp.net`;
  const firstInboundId = `fixture-in-${randomUUID()}`;
  const secondInboundId = `fixture-in-${randomUUID()}`;
  const oldInboundId = `fixture-in-${randomUUID()}`;
  const outboundId = `fixture-out-${randomUUID()}`;
  const firstTimestamp = Number(inbound.data.messageTimestamp);

  const makeInbound = (id: string, messageTimestamp: number) => ({
    ...inbound,
    instance: "Marazul",
    data: {
      ...inbound.data,
      key: { ...inbound.data.key, remoteJid, id },
      messageTimestamp,
      pushName: "Pessoa Fixture"
    }
  });

  try {
    await pool.query("DELETE FROM whatsapp_contacts WHERE remote_jid = $1", [remoteJid]);

    await ingestWebhookPayload(makeInbound(firstInboundId, firstTimestamp), "Marazul");
    await ingestWebhookPayload(makeInbound(firstInboundId, firstTimestamp), "Marazul");

    const conversation = await pool.query<{
      id: string;
      unread_count: number;
      awaiting_since: string | null;
      base_score: number | null;
    }>(
      `SELECT conversation.id, conversation.unread_count, conversation.awaiting_since::text,
              conversation.base_score
       FROM whatsapp_conversations conversation
       JOIN whatsapp_contacts contact ON contact.id = conversation.contact_id
       WHERE contact.remote_jid = $1`,
      [remoteJid]
    );
    assert.equal(conversation.rows.length, 1);
    assert.equal(conversation.rows[0]?.unread_count, 1);
    assert.ok(conversation.rows[0]?.awaiting_since);
    assert.equal(typeof conversation.rows[0]?.base_score, "number");
    const firstAwaitingSince = conversation.rows[0]?.awaiting_since;
    const firstMessage = await pool.query<{ id: string }>(
      "SELECT id FROM whatsapp_messages WHERE conversation_id = $1 ORDER BY created_at LIMIT 1",
      [conversation.rows[0]?.id]
    );
    const suggestionId = randomUUID();
    await pool.query(
      `INSERT INTO whatsapp_reply_suggestions
       (id, conversation_id, reply_to_message_id, parts, text, basis, model)
       VALUES ($1, $2, $3, $4::jsonb, $5, $6, 'fixture')`,
      [suggestionId, conversation.rows[0]?.id, firstMessage.rows[0]?.id,
        JSON.stringify([{ text: "Resposta fixture", gap: false }]), "Resposta fixture", ["fixture"]]
    );

    await ingestWebhookPayload(makeInbound(secondInboundId, firstTimestamp + 1), "Marazul");
    const afterSecondInbound = await pool.query<{
      unread_count: number;
      awaiting_since: string | null;
      triage_status: string;
    }>(
      `SELECT unread_count, awaiting_since::text, triage_status
       FROM whatsapp_conversations WHERE id = $1`,
      [conversation.rows[0]?.id]
    );
    assert.equal(afterSecondInbound.rows[0]?.unread_count, 2);
    assert.equal(afterSecondInbound.rows[0]?.awaiting_since, firstAwaitingSince);
    assert.equal(afterSecondInbound.rows[0]?.triage_status, "pending");
    const superseded = await pool.query<{ status: string }>(
      "SELECT status FROM whatsapp_reply_suggestions WHERE id = $1",
      [suggestionId]
    );
    assert.equal(superseded.rows[0]?.status, "superseded");

    await ingestWebhookPayload(makeInbound(oldInboundId, firstTimestamp - 60), "Marazul");
    const afterOutOfOrder = await pool.query<{
      unread_count: number;
      awaiting_since: string | null;
    }>(
      `SELECT unread_count, awaiting_since::text
       FROM whatsapp_conversations WHERE id = $1`,
      [conversation.rows[0]?.id]
    );
    assert.equal(afterOutOfOrder.rows[0]?.unread_count, 2);
    assert.equal(afterOutOfOrder.rows[0]?.awaiting_since, firstAwaitingSince);

    const messagesBeforeReply = await pool.query<{ count: number }>(
      `SELECT COUNT(*)::int AS count
       FROM whatsapp_messages WHERE conversation_id = $1`,
      [conversation.rows[0]?.id]
    );
    assert.equal(messagesBeforeReply.rows[0]?.count, 3);

    const outgoing = {
      ...outbound,
      instance: "Marazul",
      data: {
        ...outbound.data,
        key: { ...outbound.data.key, remoteJid, id: outboundId },
        messageTimestamp: firstTimestamp + 2
      }
    };
    await ingestWebhookPayload(outgoing, "Marazul");

    const afterReply = await pool.query<{
      unread_count: number;
      awaiting_since: string | null;
    }>(
      `SELECT unread_count, awaiting_since::text
       FROM whatsapp_conversations WHERE id = $1`,
      [conversation.rows[0]?.id]
    );
    assert.equal(afterReply.rows[0]?.unread_count, 0);
    assert.equal(afterReply.rows[0]?.awaiting_since, null);

    const episode = await pool.query<{ first_response_at: string | null }>(
      `SELECT episode.first_response_at::text
       FROM whatsapp_episodes episode
       WHERE episode.conversation_id = $1`,
      [conversation.rows[0]?.id]
    );
    assert.ok(episode.rows[0]?.first_response_at);

    const pendingId = randomUUID();
    const claimedProviderId = `fixture-claimed-${randomUUID()}`;
    const failedPendingId = randomUUID();
    const failedProviderId = `fixture-failed-${randomUUID()}`;
    await pool.query(
      `INSERT INTO whatsapp_messages
       (id, conversation_id, episode_id, direction, origin, body, status, sent_at)
       VALUES ($1, $2, $3, 'outbound', 'portal_manual', $4, 'sending', NOW())`,
      [pendingId, conversation.rows[0]?.id, null, "mensagem pendente"]
    );
    await ingestWebhookPayload({
      ...outbound,
      instance: "Marazul",
      data: {
        ...outbound.data,
        key: { ...outbound.data.key, remoteJid, id: claimedProviderId },
        message: { conversation: "mensagem pendente" },
        messageTimestamp: firstTimestamp + 3
      }
    }, "Marazul");
    const claimed = await pool.query<{ id: string; origin: string; status: string }>(
      "SELECT id, origin, status FROM whatsapp_messages WHERE provider_message_id = $1",
      [claimedProviderId]
    );
    assert.deepEqual(claimed.rows[0], { id: pendingId, origin: "portal_manual", status: "sent" });

    await pool.query(
      `INSERT INTO whatsapp_messages
       (id, conversation_id, episode_id, direction, origin, body, status, sent_at)
       VALUES ($1, $2, $3, 'outbound', 'portal_manual', $4, 'failed', NOW())`,
      [failedPendingId, conversation.rows[0]?.id, null, "mensagem falha pendente"]
    );
    await ingestWebhookPayload({
      ...outbound,
      instance: "Marazul",
      data: {
        ...outbound.data,
        key: { ...outbound.data.key, remoteJid, id: failedProviderId },
        message: { conversation: "mensagem falha pendente" },
        messageTimestamp: firstTimestamp + 4
      }
    }, "Marazul");
    const claimedFailed = await pool.query<{ id: string; status: string }>(
      "SELECT id, status FROM whatsapp_messages WHERE provider_message_id = $1",
      [failedProviderId]
    );
    assert.deepEqual(claimedFailed.rows[0], { id: failedPendingId, status: "sent" });

    const origins = await pool.query<{ origin: string }>(
      "SELECT origin FROM whatsapp_messages WHERE conversation_id = $1 ORDER BY created_at",
      [conversation.rows[0]?.id]
    );
    assert.deepEqual(origins.rows.map((row) => row.origin), ["guest", "guest", "guest", "phone", "portal_manual", "portal_manual"]);

    await ingestWebhookPayload({
      ...delivery,
      instance: "Marazul",
      data: { ...delivery.data, remoteJid, messageId: outboundId }
    }, "Marazul");
    await ingestWebhookPayload({
      ...read,
      instance: "Marazul",
      data: { ...read.data, remoteJid, messageId: outboundId }
    }, "Marazul");
    const deliveryStatus = await pool.query<{ status: string }>(
      "SELECT status FROM whatsapp_messages WHERE provider_message_id = $1",
      [outboundId]
    );
    assert.equal(deliveryStatus.rows[0]?.status, "read");

    await ingestWebhookPayload(connectionClose, "Marazul");
    const connection = await pool.query<{ connection_state: string }>(
      "SELECT connection_state FROM whatsapp_instances WHERE name = $1",
      ["Marazul"]
    );
    assert.equal(connection.rows[0]?.connection_state, "close");
  } finally {
    await pool.query("DELETE FROM whatsapp_contacts WHERE remote_jid = $1", [remoteJid]);
    await pool.end();
  }
});
