import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { env } from "../../config/env.js";
import { pool } from "../../db/client.js";
import { phoneFromJid, phoneVariants } from "./phone.js";
import { parseEvolutionEvent, type DeliveryStatus, type ParsedEvolutionEvent } from "./evolution-parser.js";
import { scoreConversation } from "./scoring.js";

interface ConversationRow {
  id: string;
  last_message_at: Date | null;
  awaiting_since: Date | null;
  unread_count: number;
  current_episode_id: string | null;
  base_score: number | null;
}

const statusRank: Record<DeliveryStatus, number> = {
  sent: 1,
  delivered: 2,
  read: 3,
  failed: 0
};

function fallbackScore(isSupplier: boolean, hasClient: boolean, awaitingSince: Date | null) {
  return scoreConversation(
    {
      intent: "desconhecida",
      has_dates: false,
      has_guest_count: false,
      is_returning_guest: false,
      is_in_house: false,
      arrives_today: false,
      high_demand: false,
      no_availability: false,
      is_supplier: isSupplier,
      unknown_contact: !hasClient
    },
    [],
    { awaitingSince }
  );
}

async function ensureContact(client: PoolClient, event: Extract<ParsedEvolutionEvent, { kind: "message" }>) {
  const phone = phoneFromJid(event.remoteJid);
  if (!phone) throw new Error("invalid_phone");

  const contactId = randomUUID();
  const result = await client.query<{
    id: string;
    client_id: string | null;
    kind: "guest" | "supplier";
    auto_link_blocked: boolean;
  }>(
    `INSERT INTO whatsapp_contacts
       (id, remote_jid, phone_e164, push_name)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (remote_jid) DO UPDATE
       SET push_name = CASE WHEN $4 <> '' THEN $4 ELSE whatsapp_contacts.push_name END,
           updated_at = NOW()
     RETURNING id, client_id, kind, auto_link_blocked`,
    [contactId, event.remoteJid, phone, event.fromMe ? "" : event.pushName.trim().slice(0, 100)]
  );
  const contact = result.rows[0];
  if (!contact) throw new Error("contact_not_created");

  if (!contact.client_id && !contact.auto_link_blocked) {
    await client.query(
      `UPDATE whatsapp_contacts
       SET client_id = candidate.id, linked_at = NOW(), linked_by_user_id = NULL, updated_at = NOW()
       FROM (
         SELECT c.id
         FROM clients c
         WHERE c.fone_e164 = ANY($1::text[])
         LIMIT 2
       ) AS candidate
       WHERE whatsapp_contacts.id = $2
         AND (SELECT COUNT(*) FROM clients c WHERE c.fone_e164 = ANY($1::text[])) = 1`,
      [phoneVariants(phone), contact.id]
    );
  }

  const current = await client.query<{
    client_id: string | null;
    kind: "guest" | "supplier";
  }>("SELECT client_id, kind FROM whatsapp_contacts WHERE id = $1", [contact.id]);
  return { ...contact, ...(current.rows[0] ?? { client_id: contact.client_id, kind: contact.kind }) };
}

async function ensureConversation(client: PoolClient, contactId: string): Promise<ConversationRow> {
  await client.query(
    `INSERT INTO whatsapp_conversations (id, contact_id)
     VALUES ($1, $2)
     ON CONFLICT (contact_id) DO NOTHING`,
    [randomUUID(), contactId]
  );
  const result = await client.query<ConversationRow>(
    `SELECT id, last_message_at, awaiting_since, unread_count, current_episode_id, base_score
     FROM whatsapp_conversations
     WHERE contact_id = $1
     FOR UPDATE`,
    [contactId]
  );
  if (!result.rows[0]) throw new Error("conversation_not_created");
  return result.rows[0];
}

async function ensureEpisode(client: PoolClient, conversationId: string, startedAt: Date): Promise<string> {
  const existing = await client.query<{ id: string }>(
    `SELECT id FROM whatsapp_episodes
     WHERE conversation_id = $1 AND closed_at IS NULL
     ORDER BY started_at DESC
     LIMIT 1
     FOR UPDATE`,
    [conversationId]
  );
  if (existing.rows[0]) {
    await client.query(
      "UPDATE whatsapp_conversations SET current_episode_id = $1 WHERE id = $2",
      [existing.rows[0].id, conversationId]
    );
    return existing.rows[0].id;
  }

  const id = randomUUID();
  await client.query(
    `INSERT INTO whatsapp_episodes (id, conversation_id, started_at)
     VALUES ($1, $2, $3)`,
    [id, conversationId, startedAt]
  );
  await client.query(
    "UPDATE whatsapp_conversations SET current_episode_id = $1 WHERE id = $2",
    [id, conversationId]
  );
  return id;
}

async function supersedeSuggestions(client: PoolClient, conversationId: string, userId: string | null = null) {
  await client.query(
    `UPDATE whatsapp_reply_suggestions
     SET status = 'superseded', status_changed_by_user_id = $1, status_changed_at = NOW()
     WHERE conversation_id = $2 AND status = 'shown'`,
    [userId, conversationId]
  );
}

async function ingestInbound(
  client: PoolClient,
  event: Extract<ParsedEvolutionEvent, { kind: "message" }>,
  conversation: ConversationRow,
  episodeId: string,
  contact: { client_id: string | null; kind: "guest" | "supplier" }
) {
  const inserted = await client.query<{ id: string }>(
    `INSERT INTO whatsapp_messages
       (id, conversation_id, episode_id, provider_message_id, direction, origin,
        media_type, body, status, sent_at)
     VALUES ($1, $2, $3, $4, 'inbound', 'guest', $5, $6, 'received', $7)
     ON CONFLICT (provider_message_id) WHERE provider_message_id IS NOT NULL DO NOTHING
     RETURNING id`,
    [randomUUID(), conversation.id, episodeId, event.providerMessageId, event.mediaType, event.body, event.sentAt]
  );
  if (!inserted.rows[0]) return;

  const isOutOfOrder = conversation.last_message_at !== null && event.sentAt < conversation.last_message_at;
  const score = fallbackScore(contact.kind === "supplier", Boolean(contact.client_id), isOutOfOrder ? null : event.sentAt);
  if (!isOutOfOrder) {
    await client.query(
      `UPDATE whatsapp_conversations
       SET last_message_at = CASE WHEN last_message_at IS NULL OR last_message_at < $1 THEN $1 ELSE last_message_at END,
           last_inbound_at = CASE WHEN last_inbound_at IS NULL OR last_inbound_at < $1 THEN $1 ELSE last_inbound_at END,
           awaiting_since = COALESCE(awaiting_since, $1),
           unread_count = unread_count + 1,
           triage_status = 'pending',
           triage_requested_at = NOW(),
           base_score = COALESCE(base_score, $2),
           score_reasons = CASE WHEN base_score IS NULL THEN $3::jsonb ELSE score_reasons END
       WHERE id = $4`,
      [event.sentAt, score.baseScore, JSON.stringify(score.reasons), conversation.id]
    );
    await client.query(
      `UPDATE whatsapp_episodes
       SET first_level = COALESCE(first_level, $1),
           is_lead = is_lead OR FALSE
       WHERE id = $2`,
      [score.level, episodeId]
    );
    await supersedeSuggestions(client, conversation.id);
  }
}

async function setMessageStatus(client: PoolClient, messageId: string, nextStatus: DeliveryStatus) {
  const current = await client.query<{ status: string }>(
    "SELECT status FROM whatsapp_messages WHERE id = $1 FOR UPDATE",
    [messageId]
  );
  const status = current.rows[0]?.status;
  if (!status) return;

  if (nextStatus === "failed") {
    if (status !== "sending" && status !== "sent") return;
    await client.query(
      "UPDATE whatsapp_messages SET status = 'failed', failure_reason = 'provider_failed' WHERE id = $1",
      [messageId]
    );
    return;
  }

  if ((status === "sent" || status === "delivered" || status === "read") &&
      statusRank[nextStatus] <= (statusRank[status as keyof typeof statusRank] ?? 0)) return;
  if (status !== "sent" && status !== "delivered" && status !== "read") return;
  await client.query("UPDATE whatsapp_messages SET status = $1, failure_reason = NULL WHERE id = $2", [nextStatus, messageId]);
}

async function ingestOutbound(
  client: PoolClient,
  event: Extract<ParsedEvolutionEvent, { kind: "message" }>,
  conversation: ConversationRow,
  episodeId: string
) {
  const existing = await client.query<{ id: string }>(
    `SELECT id FROM whatsapp_messages
     WHERE provider_message_id = $1
     FOR UPDATE`,
    [event.providerMessageId]
  );

  if (existing.rows[0]) {
    await setMessageStatus(client, existing.rows[0].id, "sent");
  } else {
    const pending = await client.query<{ id: string }>(
      `SELECT id FROM whatsapp_messages
       WHERE conversation_id = $1 AND direction = 'outbound'
         AND provider_message_id IS NULL AND status IN ('sending', 'failed')
         AND body = $2 AND created_at >= NOW() - INTERVAL '2 minutes'
       ORDER BY created_at DESC
       LIMIT 1
       FOR UPDATE`,
      [conversation.id, event.body]
    );
    if (pending.rows[0]) {
      await client.query(
        `UPDATE whatsapp_messages
         SET provider_message_id = $1, status = 'sent', failure_reason = NULL, sent_at = $2
         WHERE id = $3`,
        [event.providerMessageId, event.sentAt, pending.rows[0].id]
      );
    } else {
      await client.query(
        `INSERT INTO whatsapp_messages
           (id, conversation_id, episode_id, provider_message_id, direction, origin,
            media_type, body, status, sent_at)
         VALUES ($1, $2, $3, $4, 'outbound', 'phone', $5, $6, 'sent', $7)`,
        [randomUUID(), conversation.id, episodeId, event.providerMessageId, event.mediaType, event.body, event.sentAt]
      );
    }
  }

  const isOutOfOrder = conversation.last_message_at !== null && event.sentAt < conversation.last_message_at;
  if (!isOutOfOrder) {
    await client.query(
      `UPDATE whatsapp_conversations
       SET last_message_at = CASE WHEN last_message_at IS NULL OR last_message_at < $1 THEN $1 ELSE last_message_at END,
           awaiting_since = NULL,
           unread_count = 0
       WHERE id = $2`,
      [event.sentAt, conversation.id]
    );
    await client.query(
      `UPDATE whatsapp_episodes
       SET first_response_at = COALESCE(first_response_at, NOW())
       WHERE id = $1`,
      [episodeId]
    );
  }
}

async function ingestStatus(client: PoolClient, event: Extract<ParsedEvolutionEvent, { kind: "status" }>) {
  const message = await client.query<{ id: string }>(
    "SELECT id FROM whatsapp_messages WHERE provider_message_id = $1 FOR UPDATE",
    [event.providerMessageId]
  );
  if (message.rows[0]) await setMessageStatus(client, message.rows[0].id, event.status);
}

async function ingestConnection(client: PoolClient, event: Extract<ParsedEvolutionEvent, { kind: "connection" }>) {
  await client.query(
    `INSERT INTO whatsapp_instances (id, name, connection_state, state_changed_at)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (name) DO UPDATE
       SET connection_state = EXCLUDED.connection_state, state_changed_at = NOW()`,
    [randomUUID(), event.instanceName, event.state]
  );
}

export async function ingestParsedEvent(client: PoolClient, event: ParsedEvolutionEvent): Promise<void> {
  if (event.kind === "ignored") return;
  if (event.kind === "connection") {
    await ingestConnection(client, event);
    return;
  }
  if (event.kind === "status") {
    await ingestStatus(client, event);
    return;
  }

  const contact = await ensureContact(client, event);
  const conversation = await ensureConversation(client, contact.id);
  const episodeId = await ensureEpisode(client, conversation.id, event.sentAt);
  if (event.fromMe) {
    await ingestOutbound(client, event, conversation, episodeId);
  } else {
    await ingestInbound(client, event, conversation, episodeId, contact);
  }
}

export async function ingestWebhookPayload(payload: unknown, expectedInstance = env.EVOLUTION_INSTANCE) {
  const event = parseEvolutionEvent(payload, expectedInstance);
  if (event.kind === "ignored") return event;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await ingestParsedEvent(client, event);
    await client.query("COMMIT");
    return event;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
