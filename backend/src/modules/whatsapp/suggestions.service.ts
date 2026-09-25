import { randomUUID } from "node:crypto";
import { pool, query } from "../../db/client.js";
import { aiAvailability, suggestReplyWithAgents } from "./agents-client.js";
import { buildConversationFacts } from "./facts.service.js";
import type { TriageAgentMessage } from "./agents-client.js";

export class SuggestionError extends Error {
  constructor(public readonly code: "invalid_price" | "invalid_parts") {
    super(code);
  }
}

interface SuggestionPart {
  text: string;
  gap: boolean;
}

function priceValue(value: string): number {
  const normalized = value.replace(/R\$\s*/gi, "").replace(/\./g, "").replace(",", ".");
  return Number(normalized);
}

export function validateSuggestionParts(parts: SuggestionPart[], facts: { prices?: Array<{ total?: string }> }) {
  if (parts.length === 0 || parts.length > 20) throw new SuggestionError("invalid_parts");
  const text = parts.map((part) => part.text).join("");
  if (text.length > 600) throw new SuggestionError("invalid_parts");
  for (const part of parts) {
    if (!part.text || part.text.length > 600) throw new SuggestionError("invalid_parts");
    if (part.gap && (part.text.length > 60 || !/^\[[^\]\n]+\]$/.test(part.text))) {
      throw new SuggestionError("invalid_parts");
    }
  }
  const prices = new Set((facts.prices ?? []).map((item) => Number(item.total).toFixed(2)));
  for (const match of text.matchAll(/R\$\s?[\d.]+,\d{2}/gi)) {
    if (!prices.has(priceValue(match[0]).toFixed(2))) throw new SuggestionError("invalid_price");
  }
  return { text };
}

function mapSuggestion(row: {
  id: string;
  parts: SuggestionPart[];
  text: string;
  basis: string[];
  reply_to_message_id: string;
}) {
  return {
    id: row.id,
    parts: row.parts,
    text: row.text,
    basis: row.basis,
    replyToMessageId: row.reply_to_message_id
  };
}

async function loadMessages(conversationId: string): Promise<TriageAgentMessage[]> {
  const rows = await query<TriageAgentMessage>(
    `SELECT direction, body AS text,
            to_char(sent_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "sentAt",
            CASE WHEN media_type = 'text' THEN NULL ELSE media_type END AS media
     FROM whatsapp_messages WHERE conversation_id = $1
     ORDER BY sent_at DESC, id DESC LIMIT 20`,
    [conversationId]
  );
  return rows.reverse();
}

export async function getOrCreateSuggestion(conversationId: string) {
  const availability = await aiAvailability();
  if (!availability.available) return null;
  const db = await pool.connect();
  try {
    await db.query("BEGIN");
    await db.query("SELECT pg_advisory_xact_lock(hashtext($1))", [conversationId]);
    const context = await db.query<{
      current_reading_id: string | null;
      contact_id: string;
      contact_name: string;
      first_name: string | null;
      reading: Record<string, unknown> | null;
      reading_facts: Record<string, unknown> | null;
      reading_intent: string | null;
      reading_check_in: string | null;
      reading_check_out: string | null;
      reading_adults: number | null;
      reading_children_ages: number[] | null;
      reading_requests: string[] | null;
      last_inbound_id: string | null;
    }>(
      `SELECT conversation.current_reading_id, contact.id AS contact_id,
              contact.push_name AS contact_name,
              split_part(client.full_name, ' ', 1) AS first_name,
              reading.facts AS reading_facts,
              reading.intent AS reading_intent,
              reading.check_in::text AS reading_check_in,
              reading.check_out::text AS reading_check_out,
              reading.adults AS reading_adults,
              reading.children_ages AS reading_children_ages,
              reading.requests AS reading_requests,
              last_inbound.id AS last_inbound_id
       FROM whatsapp_conversations conversation
       JOIN whatsapp_contacts contact ON contact.id = conversation.contact_id
       LEFT JOIN clients client ON client.id = contact.client_id
       LEFT JOIN whatsapp_ai_readings reading ON reading.id = conversation.current_reading_id
       LEFT JOIN LATERAL (
         SELECT id FROM whatsapp_messages
         WHERE conversation_id = conversation.id AND direction = 'inbound'
         ORDER BY sent_at DESC, id DESC LIMIT 1
       ) last_inbound ON TRUE
       WHERE conversation.id = $1 AND conversation.awaiting_since IS NOT NULL
       LIMIT 1`,
      [conversationId]
    );
    const row = context.rows[0];
    if (!row || !row.current_reading_id || !row.last_inbound_id || !row.reading_intent) {
      await db.query("ROLLBACK");
      return null;
    }
    const live = await db.query<{
      id: string; parts: SuggestionPart[]; text: string; basis: string[]; reply_to_message_id: string;
      status: "shown" | "used" | "dismissed" | "superseded";
    }>(
      `SELECT id, parts, text, basis, reply_to_message_id, status
       FROM whatsapp_reply_suggestions
       WHERE conversation_id = $1 AND reply_to_message_id = $2 AND status <> 'superseded'
       LIMIT 1`,
      [conversationId, row.last_inbound_id]
    );
    if (live.rows[0]) {
      await db.query("COMMIT");
      return live.rows[0].status === "shown" ? mapSuggestion(live.rows[0]) : null;
    }

    const reading = {
      intent: row.reading_intent,
      checkIn: row.reading_check_in,
      checkOut: row.reading_check_out,
      adults: row.reading_adults,
      childrenAges: row.reading_children_ages ?? [],
      requests: row.reading_requests ?? []
    };
    const facts = row.reading_facts ?? await buildConversationFacts(conversationId, {
      checkIn: row.reading_check_in,
      checkOut: row.reading_check_out,
      adults: row.reading_adults,
      childrenAges: row.reading_children_ages ?? []
    });
    const rules = await db.query<{ instruction: string }>(
      "SELECT instruction FROM whatsapp_ai_rules WHERE kind = 'reply' AND status = 'active' ORDER BY proposed_at"
    );
    const messages = await loadMessages(conversationId);
    const response = await suggestReplyWithAgents({
      hotelName: "Hotel Marazul",
      guestFirstName: row.first_name ?? row.contact_name ?? null,
      reading,
      facts,
      replyRules: rules.rows.map((rule) => rule.instruction),
      isFirstOutbound: false,
      messages
    });
    const validated = validateSuggestionParts(response.parts, facts as { prices?: Array<{ total?: string }> });
    const id = randomUUID();
    await db.query(
      `INSERT INTO whatsapp_reply_suggestions
       (id, conversation_id, reply_to_message_id, parts, text, basis, model)
       VALUES ($1, $2, $3, $4::jsonb, $5, $6, 'agents')`,
      [id, conversationId, row.last_inbound_id, JSON.stringify(response.parts), validated.text, response.basis]
    );
    await db.query("COMMIT");
    return mapSuggestion({ id, parts: response.parts, text: validated.text, basis: response.basis, reply_to_message_id: row.last_inbound_id });
  } catch (error) {
    await db.query("ROLLBACK");
    if (error instanceof SuggestionError) return null;
    throw error;
  } finally {
    db.release();
  }
}

export async function dismissSuggestion(id: string, userId: string): Promise<boolean> {
  const rows = await query<{ id: string }>(
    `UPDATE whatsapp_reply_suggestions
     SET status = 'dismissed', status_changed_by_user_id = $2, status_changed_at = NOW()
     WHERE id = $1 AND status = 'shown'
     RETURNING id`,
    [id, userId]
  );
  return rows.length > 0;
}
