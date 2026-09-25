import { randomUUID } from "node:crypto";
import { formatHotelDate } from "../../utils/reservation.js";
import { pool, query } from "../../db/client.js";
import { env } from "../../config/env.js";
import { AgentsClientError, aiAvailability, triageWithAgents, type TriageAgentMessage, type TriageAgentResponse } from "./agents-client.js";
import { buildConversationFacts } from "./facts.service.js";
import { buildQueueSignals } from "./signals.js";
import { scoreConversation, type QueueRule } from "./scoring.js";

interface Claim {
  id: string;
  requested_at: string;
  attempts: number;
}

interface ReadingRow {
  id: string;
  last_message_id: string;
  episode_id: string | null;
  contact_id: string;
  kind: "guest" | "supplier";
  client_id: string | null;
  guest_first_name: string | null;
  requested_at: string;
  current_attempts: number;
}

function fallbackReading(lastMessageId: string): TriageAgentResponse {
  return {
    intent: "desconhecida",
    checkIn: null,
    checkOut: null,
    adults: null,
    childrenAges: [],
    requests: [],
    missingFields: [],
    headline: "Sem leitura da IA",
    markerText: "IA leu: sem leitura da IA"
  };
}

function activeRules(rows: Array<{ condition: Record<string, unknown>; weight: number; title: string }>): QueueRule[] {
  return rows.map((row) => ({
    condition: row.condition,
    weight: row.weight === -10 ? -10 : 10,
    title: row.title,
    status: "active"
  }));
}

async function claimConversations(limit: number): Promise<Claim[]> {
  await pool.query(
    `UPDATE whatsapp_conversations
     SET triage_status = 'pending', triage_started_at = NULL
     WHERE triage_status = 'running' AND triage_started_at < NOW() - INTERVAL '2 minutes'`
  );
  const result = await pool.query<Claim>(
    `WITH picked AS (
       SELECT id
       FROM whatsapp_conversations
       WHERE triage_status = 'pending'
         AND triage_requested_at <= NOW() - INTERVAL '20 seconds'
       ORDER BY triage_requested_at, id
       LIMIT $1
       FOR UPDATE SKIP LOCKED
     )
     UPDATE whatsapp_conversations conversation
     SET triage_status = 'running', triage_started_at = NOW()
     FROM picked
     WHERE conversation.id = picked.id
     RETURNING conversation.id, conversation.triage_requested_at::text AS requested_at, conversation.triage_attempts AS attempts`,
    [limit]
  );
  return result.rows;
}

async function loadConversation(id: string): Promise<ReadingRow | null> {
  const rows = await query<ReadingRow>(
    `SELECT conversation.id, conversation.current_episode_id AS episode_id,
            conversation.triage_requested_at::text AS requested_at,
            conversation.triage_attempts AS current_attempts,
            contact.id AS contact_id, contact.kind, contact.client_id,
            split_part(client.full_name, ' ', 1) AS guest_first_name,
            last_message.id AS last_message_id
     FROM whatsapp_conversations conversation
     JOIN whatsapp_contacts contact ON contact.id = conversation.contact_id
     LEFT JOIN clients client ON client.id = contact.client_id
     JOIN LATERAL (
       SELECT id FROM whatsapp_messages
       WHERE conversation_id = conversation.id
       ORDER BY sent_at DESC, id DESC LIMIT 1
     ) last_message ON TRUE
     WHERE conversation.id = $1
     LIMIT 1`,
    [id]
  );
  return rows[0] ?? null;
}

async function loadMessages(conversationId: string): Promise<TriageAgentMessage[]> {
  const rows = await query<TriageAgentMessage>(
    `SELECT direction, body AS text,
            to_char(sent_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "sentAt",
            CASE WHEN media_type = 'text' THEN NULL ELSE media_type END AS media
     FROM whatsapp_messages
     WHERE conversation_id = $1
     ORDER BY sent_at DESC, id DESC
     LIMIT 20`,
    [conversationId]
  );
  const messages = rows.reverse();
  let total = 0;
  const selected: TriageAgentMessage[] = [];
  for (const message of messages.reverse()) {
    const text = message.text ?? "";
    if (total + text.length > 8_000 && selected.length > 0) continue;
    total += text.length;
    selected.push({ ...message, text });
  }
  return selected.reverse();
}

async function writeReading(
  conversation: ReadingRow,
  reading: TriageAgentResponse,
  model: string,
  facts: Record<string, unknown>,
  signals: Parameters<typeof scoreConversation>[0],
  status: "done" | "skipped" | "failed"
): Promise<void> {
  const rules = await query<{ condition: Record<string, unknown>; weight: number; title: string }>(
    `SELECT condition, weight, title FROM whatsapp_ai_rules WHERE kind = 'queue' AND status = 'active'`
  );
  const score = scoreConversation(signals, activeRules(rules), { awaitingSince: new Date() });
  const db = await pool.connect();
  const readingId = randomUUID();
  try {
    await db.query("BEGIN");
    await db.query(
      `INSERT INTO whatsapp_ai_readings
       (id, conversation_id, episode_id, last_message_id, intent, check_in, check_out, adults,
        children_ages, requests, missing_fields, headline, marker_text, signals, facts,
        base_score, level, reasons, model)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13,
               $14::jsonb, $15::jsonb, $16, $17, $18::jsonb, $19)`,
      [
        readingId, conversation.id, conversation.episode_id, conversation.last_message_id,
        reading.intent, reading.checkIn ?? null, reading.checkOut ?? null, reading.adults ?? null,
        reading.childrenAges, reading.requests, reading.missingFields, reading.headline, reading.markerText,
        JSON.stringify(signals), JSON.stringify(facts), score.baseScore, score.level,
        JSON.stringify(score.reasons), model
      ]
    );
    await db.query(
      `UPDATE whatsapp_conversations
       SET current_reading_id = $1,
           base_score = $2,
           score_reasons = $3::jsonb,
           triage_status = CASE WHEN triage_requested_at > $4 THEN 'pending' ELSE $5 END,
           triage_started_at = NULL,
           triage_attempts = 0
       WHERE id = $6`,
      [readingId, score.baseScore, JSON.stringify(score.reasons), conversation.requested_at, status, conversation.id]
    );
    if (conversation.episode_id) {
      await db.query(
        `UPDATE whatsapp_episodes
         SET is_lead = is_lead OR $1,
             first_level = COALESCE(first_level, $2)
         WHERE id = $3`,
        [reading.intent === "reserva_nova" || reading.intent === "preco", score.level, conversation.episode_id]
      );
    }
    await db.query("COMMIT");
  } catch (error) {
    await db.query("ROLLBACK");
    throw error;
  } finally {
    db.release();
  }
}

async function failTriage(conversation: ReadingRow): Promise<void> {
  const attempts = conversation.current_attempts + 1;
  if (attempts >= 3) {
    const reading = fallbackReading(conversation.last_message_id);
    const facts = {};
    const signals = await buildQueueSignals(conversation.id, reading, formatHotelDate(new Date()), facts);
    await writeReading(conversation, reading, "fallback", facts, signals, "failed");
    return;
  }
  await pool.query(
    `UPDATE whatsapp_conversations
     SET triage_status = 'pending', triage_started_at = NULL,
         triage_attempts = $2::int,
         triage_requested_at = NOW() + ($2::int * INTERVAL '30 seconds')
     WHERE id = $1`,
    [conversation.id, attempts]
  );
}

export async function runTriageOnce(limit = 3): Promise<number> {
  const claims = await claimConversations(limit);
  let completed = 0;
  const availability = await aiAvailability();
  for (const claim of claims) {
    const conversation = await loadConversation(claim.id);
    if (!conversation) continue;
    conversation.requested_at = claim.requested_at;
    conversation.current_attempts = claim.attempts;
    try {
      const fallback = !availability.available;
      const messages = await loadMessages(conversation.id);
      const today = formatHotelDate(new Date());
      let reading = fallbackReading(conversation.last_message_id);
      let facts: Record<string, unknown> = {};
      let model = "fallback";
      if (!fallback) {
        const response = await triageWithAgents({
          hotelToday: today,
          timezone: env.HOTEL_TIMEZONE,
          guestFirstName: conversation.guest_first_name,
          knownContext: { isSupplier: conversation.kind === "supplier", reservations: [] },
          messages
        });
        reading = response;
        model = "agents";
        facts = await buildConversationFacts(conversation.id, {
          checkIn: reading.checkIn ?? null,
          checkOut: reading.checkOut ?? null,
          adults: reading.adults ?? null,
          childrenAges: reading.childrenAges ?? []
        });
      }
      const signals = await buildQueueSignals(conversation.id, reading, today, facts);
      await writeReading(conversation, reading, model, facts, signals, fallback ? "skipped" : "done");
      completed += 1;
    } catch (error) {
      if (error instanceof AgentsClientError && (error.reason === "not_configured" || error.reason === "daily_limit")) {
        const reading = fallbackReading(conversation.last_message_id);
        const facts = {};
        const signals = await buildQueueSignals(conversation.id, reading, formatHotelDate(new Date()), facts);
        await writeReading(conversation, reading, "fallback", facts, signals, "skipped");
        completed += 1;
      } else {
        await failTriage(conversation);
      }
    }
  }
  return completed;
}
