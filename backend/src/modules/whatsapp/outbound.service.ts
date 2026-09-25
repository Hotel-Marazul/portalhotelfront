import { randomUUID } from "node:crypto";
import { env } from "../../config/env.js";
import { pool, query } from "../../db/client.js";
import { EvolutionError, createEvolutionClient } from "./evolution-client.js";

export class OutboundError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
  }
}

export interface SendMessageInput {
  conversationId: string;
  userId: string;
  text: string;
  clientRequestId: string;
  suggestionId?: string | null;
  lastSeenMessageId?: string | null;
  force?: boolean;
}

interface MessageRow {
  id: string;
  conversation_id: string;
  direction: "inbound" | "outbound";
  origin: string;
  body: string;
  status: string;
  failure_reason: string | null;
  sent_at: string;
  sent_by: string | null;
  client_request_id: string | null;
}

function normalizeText(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function messageDto(row: MessageRow) {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    direction: row.direction,
    origin: row.origin,
    body: row.body,
    status: row.status,
    failureReason: row.failure_reason,
    sentAt: row.sent_at,
    sentBy: row.sent_by
  };
}

function failureMessage(error: unknown): string {
  if (!(error instanceof EvolutionError)) return "Falha temporária ao enviar.";
  switch (error.reason) {
    case "timeout": return "Tempo esgotado";
    case "evolution_4xx": return "Número inválido";
    case "evolution_5xx": return "Evolution respondeu 500";
    default: return "Falha temporária ao enviar";
  }
}

async function loadMessage(id: string): Promise<MessageRow | null> {
  const rows = await query<MessageRow>(
    `SELECT m.id, m.conversation_id, m.direction, m.origin, m.body, m.status,
            m.failure_reason, m.sent_at::text, u.name AS sent_by, m.client_request_id
     FROM whatsapp_messages m
     LEFT JOIN users u ON u.id = m.sent_by_user_id
     WHERE m.id = $1
     LIMIT 1`,
    [id]
  );
  return rows[0] ?? null;
}

async function markFailed(id: string, reason: string): Promise<void> {
  await pool.query(
    `UPDATE whatsapp_messages
     SET status = 'failed', failure_reason = $2
     WHERE id = $1 AND status = 'sending'`,
    [id, reason]
  );
}

async function completeSend(input: SendMessageInput, sendingId: string, providerMessageId: string) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const conversation = await client.query<{ id: string; current_episode_id: string | null }>(
      `SELECT id, current_episode_id FROM whatsapp_conversations WHERE id = $1 FOR UPDATE`,
      [input.conversationId]
    );
    if (!conversation.rows[0]) throw new OutboundError(404, "conversation_not_found", "Conversa não encontrada.");

    const provider = await client.query<{ id: string }>(
      `SELECT id FROM whatsapp_messages
       WHERE provider_message_id = $1
       FOR UPDATE`,
      [providerMessageId]
    );
    if (provider.rows[0] && provider.rows[0].id !== sendingId) {
      await client.query(
        `UPDATE whatsapp_messages
         SET origin = sending.origin,
             sent_by_user_id = sending.sent_by_user_id,
             client_request_id = sending.client_request_id,
             suggestion_id = sending.suggestion_id,
             status = 'sent', failure_reason = NULL
         FROM whatsapp_messages sending
         WHERE whatsapp_messages.id = $1 AND sending.id = $2`,
        [provider.rows[0].id, sendingId]
      );
      await client.query("DELETE FROM whatsapp_messages WHERE id = $1", [sendingId]);
    } else {
      await client.query(
        `UPDATE whatsapp_messages
         SET provider_message_id = $1, status = 'sent', failure_reason = NULL
         WHERE id = $2`,
        [providerMessageId, sendingId]
      );
    }

    await client.query(
      `UPDATE whatsapp_conversations
       SET awaiting_since = NULL, unread_count = 0, last_message_at = GREATEST(COALESCE(last_message_at, NOW()), NOW())
       WHERE id = $1`,
      [input.conversationId]
    );
    if (conversation.rows[0].current_episode_id) {
      await client.query(
        `UPDATE whatsapp_episodes SET first_response_at = COALESCE(first_response_at, NOW()) WHERE id = $1`,
        [conversation.rows[0].current_episode_id]
      );
    }
    if (input.suggestionId) {
      await client.query(
        `UPDATE whatsapp_reply_suggestions
         SET status = 'used', status_changed_by_user_id = $1, status_changed_at = NOW()
         WHERE id = $2 AND conversation_id = $3`,
        [input.userId, input.suggestionId, input.conversationId]
      );
    }
    const rows = await client.query<MessageRow>(
      `SELECT m.id, m.conversation_id, m.direction, m.origin, m.body, m.status,
              m.failure_reason, m.sent_at::text, u.name AS sent_by, m.client_request_id
       FROM whatsapp_messages m
       LEFT JOIN users u ON u.id = m.sent_by_user_id
       WHERE m.provider_message_id = $1 OR m.id = $2
       ORDER BY CASE WHEN m.provider_message_id = $1 THEN 0 ELSE 1 END
       LIMIT 1`,
      [providerMessageId, sendingId]
    );
    await client.query("COMMIT");
    return rows.rows[0] ? messageDto(rows.rows[0]) : null;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function sendMessage(input: SendMessageInput) {
  const text = input.text.trim();
  if (!text || text.length > 4096) {
    throw new OutboundError(400, "invalid_text", "A mensagem deve ter de 1 a 4.096 caracteres.");
  }

  const state = await query<{ connection_state: string }>(
    "SELECT connection_state FROM whatsapp_instances WHERE name = $1 LIMIT 1",
    [env.EVOLUTION_INSTANCE]
  );
  if (state[0]?.connection_state !== "open") {
    throw new OutboundError(409, "whatsapp_disconnected", "O número do WhatsApp está desconectado.");
  }

  const db = await pool.connect();
  let sendingId = "";
  try {
    await db.query("BEGIN");
    const existing = await db.query<MessageRow>(
      `SELECT m.id, m.conversation_id, m.direction, m.origin, m.body, m.status,
              m.failure_reason, m.sent_at::text, u.name AS sent_by, m.client_request_id
       FROM whatsapp_messages m
       LEFT JOIN users u ON u.id = m.sent_by_user_id
       WHERE m.client_request_id = $1
       LIMIT 1`,
      [input.clientRequestId]
    );
    if (existing.rows[0]) {
      await db.query("ROLLBACK");
      if (existing.rows[0].conversation_id !== input.conversationId) {
        throw new OutboundError(409, "idempotency_conflict", "Este envio pertence a outra conversa.");
      }
      return { statusCode: 200, message: messageDto(existing.rows[0]) };
    }

    const conversation = await db.query<{ id: string; contact_id: string; current_episode_id: string | null }>(
      `SELECT id, contact_id, current_episode_id
       FROM whatsapp_conversations WHERE id = $1 FOR UPDATE`,
      [input.conversationId]
    );
    if (!conversation.rows[0]) throw new OutboundError(404, "conversation_not_found", "Conversa não encontrada.");

    if (!input.force && input.lastSeenMessageId) {
      const newer = await db.query<MessageRow>(
        `SELECT m.id, m.conversation_id, m.direction, m.origin, m.body, m.status,
                m.failure_reason, m.sent_at::text, u.name AS sent_by, m.client_request_id
         FROM whatsapp_messages m
         LEFT JOIN users u ON u.id = m.sent_by_user_id
         WHERE m.conversation_id = $1 AND m.direction = 'outbound'
           AND m.sent_at > COALESCE((SELECT sent_at FROM whatsapp_messages WHERE id = $2), '-infinity'::timestamptz)
         ORDER BY m.sent_at DESC, m.id DESC
         LIMIT 1`,
        [input.conversationId, input.lastSeenMessageId]
      );
      if (newer.rows[0]) {
        throw new OutboundError(409, "conversation_changed", "Alguém respondeu enquanto você escrevia.", {
          latest: messageDto(newer.rows[0])
        });
      }
    }

    let origin = "portal_manual";
    if (input.suggestionId) {
      const suggestions = await db.query<{ text: string; parts: Array<{ text: string; gap?: boolean }> }>(
        `SELECT text, parts FROM whatsapp_reply_suggestions
         WHERE id = $1 AND conversation_id = $2 LIMIT 1`,
        [input.suggestionId, input.conversationId]
      );
      const suggestion = suggestions.rows[0];
      if (!suggestion) throw new OutboundError(404, "suggestion_not_found", "Sugestão não encontrada.");
      const gap = (Array.isArray(suggestion.parts) ? suggestion.parts : []).find((part) => part.gap && text.includes(part.text));
      if (gap) throw new OutboundError(422, "unfilled_gap", "Complete os trechos marcados antes de enviar.");
      origin = normalizeText(text) === normalizeText(suggestion.text)
        ? "portal_suggestion"
        : "portal_suggestion_edited";
    }

    sendingId = randomUUID();
    await db.query(
      `INSERT INTO whatsapp_messages
         (id, conversation_id, episode_id, direction, origin, body, status, sent_at,
          sent_by_user_id, client_request_id, suggestion_id)
       VALUES ($1, $2, $3, 'outbound', $4, $5, 'sending', NOW(), $6, $7, $8)`,
      [sendingId, input.conversationId, conversation.rows[0].current_episode_id, origin, text,
        input.userId, input.clientRequestId, input.suggestionId ?? null]
    );
    await db.query("COMMIT");
  } catch (error) {
    await db.query("ROLLBACK");
    throw error;
  } finally {
    db.release();
  }

  try {
    const contact = await query<{ phone_e164: string }>(
      `SELECT contact.phone_e164
       FROM whatsapp_conversations conversation
       JOIN whatsapp_contacts contact ON contact.id = conversation.contact_id
       WHERE conversation.id = $1`,
      [input.conversationId]
    );
    if (!contact[0]) throw new OutboundError(404, "conversation_not_found", "Conversa não encontrada.");
    const result = await createEvolutionClient().sendText(contact[0].phone_e164, text);
    const message = await completeSend(input, sendingId, result.providerMessageId);
    return { statusCode: 201, message };
  } catch (error) {
    const reason = failureMessage(error);
    await markFailed(sendingId, reason);
    if (error instanceof OutboundError) throw error;
    throw new OutboundError(502, "whatsapp_send_failed", reason, {
      timeout: error instanceof EvolutionError && error.reason === "timeout"
    });
  }
}

export async function retryMessage(messageId: string, userId: string) {
  const message = await loadMessage(messageId);
  if (!message || message.direction !== "outbound" || !message.origin.startsWith("portal_") || message.status !== "failed") {
    throw new OutboundError(409, "message_not_retryable", "Mensagem não pode ser reenviada.");
  }
  return sendMessage({
    conversationId: message.conversation_id,
    userId,
    text: message.body,
    clientRequestId: randomUUID(),
    suggestionId: null,
    force: true
  });
}
