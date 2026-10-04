import { randomUUID } from "node:crypto";
import { pool, query } from "../../db/client.js";
import { HttpError } from "../../utils/http-error.js";
import { getConversationDetail } from "./queue.service.js";
import { scoreConversation, type QueueRule, type QueueSignals } from "./scoring.js";

/** Quanto cada fonte de aprendizado precisa acumular antes de virar proposta. */
export const LEARNING_THRESHOLDS = {
  outcomesPerSituation: 8,
  corrections: 3,
  editedSuggestions: 5
} as const;

export interface LearningProgressCounts {
  leadsWithoutOutcome: number;
  outcomes90d: number;
  corrections30d: number;
  editedSuggestions30d: number;
}

export interface LearningStep {
  key: "outcomes_pending" | "edited_suggestions" | "corrections" | "outcomes";
  done: boolean;
  current: number;
  target: number | null;
}

/** Traduz as contagens em passos que a operação consegue cumprir para a IA ter o que propor. */
export function learningSteps(counts: LearningProgressCounts): LearningStep[] {
  return [
    { key: "outcomes_pending", done: counts.leadsWithoutOutcome === 0, current: counts.leadsWithoutOutcome, target: null },
    {
      key: "edited_suggestions",
      done: counts.editedSuggestions30d >= LEARNING_THRESHOLDS.editedSuggestions,
      current: counts.editedSuggestions30d,
      target: LEARNING_THRESHOLDS.editedSuggestions
    },
    {
      key: "corrections",
      done: counts.corrections30d >= LEARNING_THRESHOLDS.corrections,
      current: counts.corrections30d,
      target: LEARNING_THRESHOLDS.corrections
    },
    {
      key: "outcomes",
      done: counts.outcomes90d >= LEARNING_THRESHOLDS.outcomesPerSituation,
      current: counts.outcomes90d,
      target: LEARNING_THRESHOLDS.outcomesPerSituation
    }
  ];
}

export type Outcome = "booked" | "not_booked" | "not_lead" | null;
export type FeedbackVerdict = "correct" | "should_be_higher" | "should_be_lower";

export function canonicalConditionKey(condition: Record<string, unknown>): string {
  const normalize = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(normalize);
    if (value && typeof value === "object") {
      return Object.fromEntries(Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, normalize(item)]));
    }
    return value;
  };
  return JSON.stringify(normalize(condition));
}

export function canonicalInstructionKey(instruction: string): string {
  return instruction.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().trim().replace(/\s+/g, " ");
}

function queueRules(rows: Array<{ condition: Record<string, unknown>; weight: number; title: string }>): QueueRule[] {
  return rows.map((row) => ({
    condition: row.condition,
    weight: row.weight === -10 ? -10 : 10,
    title: row.title,
    status: "active"
  }));
}

export async function recomputeQueueScores(): Promise<number> {
  const db = await pool.connect();
  try {
    await db.query("BEGIN");
    const [rulesResult, conversations] = await Promise.all([
      db.query<{ condition: Record<string, unknown>; weight: number; title: string }>(
        "SELECT condition, weight, title FROM whatsapp_ai_rules WHERE kind = 'queue' AND status = 'active'"
      ),
      db.query<{
        id: string;
        awaiting_since: Date | null;
        signals: QueueSignals | null;
      }>(
        `SELECT conversation.id, conversation.awaiting_since, reading.signals
         FROM whatsapp_conversations conversation
         LEFT JOIN whatsapp_ai_readings reading ON reading.id = conversation.current_reading_id
         WHERE conversation.awaiting_since IS NOT NULL
         FOR UPDATE OF conversation`
      )
    ]);
    const rules = queueRules(rulesResult.rows);
    for (const conversation of conversations.rows) {
      if (!conversation.signals) continue;
      const score = scoreConversation(conversation.signals, rules, { awaitingSince: conversation.awaiting_since });
      await db.query(
        `UPDATE whatsapp_conversations
         SET base_score = $2, score_reasons = $3::jsonb
         WHERE id = $1`,
        [conversation.id, score.baseScore, JSON.stringify(score.reasons)]
      );
    }
    await db.query("COMMIT");
    return conversations.rows.filter((conversation) => conversation.signals).length;
  } catch (error) {
    await db.query("ROLLBACK");
    throw error;
  } finally {
    db.release();
  }
}

export async function setConversationOutcome(conversationId: string, userId: string, outcome: Outcome) {
  const db = await pool.connect();
  try {
    await db.query("BEGIN");
    const episode = await db.query<{ id: string }>(
      `SELECT current_episode_id AS id
       FROM whatsapp_conversations
       WHERE id = $1
       FOR UPDATE`,
      [conversationId]
    );
    const episodeId = episode.rows[0]?.id;
    if (!episodeId) throw new HttpError(404, "Atendimento não encontrado.");

    const updated = await db.query<{ id: string; outcome: Outcome }>(
      `UPDATE whatsapp_episodes
       SET outcome = $2,
           closed_at = CASE WHEN $2::text IS NULL THEN NULL ELSE NOW() END,
           close_reason = CASE WHEN $2::text IS NULL THEN NULL ELSE 'outcome' END,
           outcome_set_by_user_id = $3,
           outcome_set_at = NOW()
       WHERE id = $1
       RETURNING id, outcome`,
      [episodeId, outcome, userId]
    );
    if (!updated.rows[0]) throw new HttpError(404, "Atendimento não encontrado.");
    if (outcome !== null) {
      await db.query(
        `UPDATE whatsapp_conversations
         SET awaiting_since = NULL, unread_count = 0, triage_status = 'idle', triage_requested_at = NULL
         WHERE id = $1`,
        [conversationId]
      );
    }
    await db.query("COMMIT");
    return { episodeId: updated.rows[0].id, outcome: updated.rows[0].outcome };
  } catch (error) {
    await db.query("ROLLBACK");
    throw error;
  } finally {
    db.release();
  }
}

export async function addPriorityFeedback(
  conversationId: string,
  userId: string,
  verdict: FeedbackVerdict
) {
  const detail = await getConversationDetail(conversationId, userId);
  if (!detail?.reading || !detail.level || !detail.position) {
    throw new HttpError(409, "A conversa não tem uma leitura posicionada na fila.");
  }
  const reading = await query<{ episode_id: string | null }>(
    "SELECT episode_id FROM whatsapp_ai_readings WHERE id = $1",
    [detail.reading.id]
  );
  try {
    const rows = await query<{ id: string }>(
      `INSERT INTO whatsapp_priority_feedback
       (id, conversation_id, episode_id, reading_id, verdict, level_at_feedback, position_at_feedback, user_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id`,
      [randomUUID(), conversationId, reading[0]?.episode_id ?? null, detail.reading.id, verdict, detail.level, detail.position, userId]
    );
    return { id: rows[0]?.id, verdict, level: detail.level, position: detail.position };
  } catch (error) {
    if (error instanceof Error && "code" in error && (error as { code?: string }).code === "23505") {
      throw new HttpError(409, "Você já corrigiu esta leitura.");
    }
    throw error;
  }
}

export async function removePriorityFeedback(conversationId: string, userId: string): Promise<void> {
  await query(
    `DELETE FROM whatsapp_priority_feedback feedback
     USING whatsapp_conversations conversation
     WHERE feedback.conversation_id = conversation.id
       AND conversation.id = $1
       AND feedback.user_id = $2
       AND feedback.reading_id = conversation.current_reading_id`,
    [conversationId, userId]
  );
}

export async function listRules() {
  const rows = await query<{
    id: string; kind: "queue" | "reply"; status: "proposed" | "active" | "ignored" | "reverted";
    title: string; condition: Record<string, unknown> | null; weight: number | null;
    instruction: string | null; evidence: Record<string, unknown>; evidence_text: string;
    source: string | null; proposed_at: string; decided_at: string | null;
  }>(
    `SELECT id, kind, status, title, condition, weight, instruction, evidence, evidence_text, source,
            proposed_at::text, decided_at::text
     FROM whatsapp_ai_rules
     WHERE status IN ('proposed', 'active')
     ORDER BY status, proposed_at DESC`
  );
  const history = await query<{
    id: string; action: "accepted" | "ignored" | "reverted"; created_at: string;
    title: string; kind: "queue" | "reply"; weight: number | null; instruction: string | null; user_name: string | null;
  }>(
    `SELECT event.id, event.action, event.created_at::text, rule.title, rule.kind, rule.weight,
            rule.instruction, u.name AS user_name
     FROM whatsapp_ai_rule_events event
     JOIN whatsapp_ai_rules rule ON rule.id = event.rule_id
     LEFT JOIN users u ON u.id = event.actor_user_id
     WHERE event.action IN ('accepted', 'ignored', 'reverted')
     ORDER BY event.created_at DESC
     LIMIT 20`
  );
  return {
    proposed: rows.filter((row) => row.status === "proposed").map(ruleDto),
    active: rows.filter((row) => row.status === "active").map(ruleDto),
    history: history.map((row) => ({
      id: row.id,
      action: row.action,
      at: row.created_at,
      title: row.title,
      kind: row.kind,
      weight: row.weight,
      instruction: row.instruction,
      userName: row.user_name
    }))
  };
}

function ruleDto(row: {
  id: string; kind: string; status: string; title: string; condition: Record<string, unknown> | null;
  weight: number | null; instruction: string | null; evidence: Record<string, unknown>; evidence_text: string;
  source?: string | null; proposed_at: string; decided_at: string | null;
}) {
  return {
    id: row.id,
    kind: row.kind,
    status: row.status,
    title: row.title,
    condition: row.condition,
    weight: row.weight,
    instruction: row.instruction,
    evidence: row.evidence,
    evidenceText: row.evidence_text,
    source: row.source ?? null,
    proposedAt: row.proposed_at,
    decidedAt: row.decided_at
  };
}

export async function decideRule(ruleId: string, action: "accept" | "ignore" | "revert", userId: string) {
  const expected = action === "accept" || action === "ignore" ? "proposed" : "active";
  const next = action === "accept" ? "active" : action === "ignore" ? "ignored" : "reverted";
  const db = await pool.connect();
  let kind: "queue" | "reply" = "reply";
  try {
    await db.query("BEGIN");
    const rule = await db.query<{ kind: "queue" | "reply"; status: string }>(
      "SELECT kind, status FROM whatsapp_ai_rules WHERE id = $1 FOR UPDATE",
      [ruleId]
    );
    if (!rule.rows[0]) throw new HttpError(404, "Regra não encontrada.");
    if (rule.rows[0].status !== expected) throw new HttpError(409, "A regra já mudou de estado.");
    kind = rule.rows[0].kind;
    const updated = await db.query(
      `UPDATE whatsapp_ai_rules
       SET status = $2, decided_by_user_id = $3, decided_at = NOW()
       WHERE id = $1
       RETURNING id, kind, status, title, condition, weight, instruction, evidence, evidence_text, source,
                 proposed_at::text, decided_at::text`,
      [ruleId, next, userId]
    );
    await db.query(
      `INSERT INTO whatsapp_ai_rule_events (id, rule_id, action, actor_user_id)
       VALUES ($1, $2, $3, $4)`,
      [randomUUID(), ruleId, action === "accept" ? "accepted" : action === "ignore" ? "ignored" : "reverted", userId]
    );
    await db.query("COMMIT");
    if (kind === "queue" && (action === "accept" || action === "revert")) await recomputeQueueScores();
    return ruleDto(updated.rows[0]);
  } catch (error) {
    await db.query("ROLLBACK");
    throw error;
  } finally {
    db.release();
  }
}

export async function learningSummary(period: "7d" | "30d" | "all" = "30d") {
  const interval = period === "7d" ? "7 days" : period === "30d" ? "30 days" : null;
  const since = interval ? `NOW() - INTERVAL '${interval}'` : "'epoch'::timestamptz";
  const [readings, leads, suggestions, corrections, accuracy, usage, progress] = await Promise.all([
    query<{ conversations: number; contacts: number }>(
      `SELECT COUNT(DISTINCT reading.conversation_id)::int AS conversations,
              COUNT(DISTINCT conversation.contact_id)::int AS contacts
       FROM whatsapp_ai_readings reading
       JOIN whatsapp_conversations conversation ON conversation.id = reading.conversation_id
       JOIN whatsapp_episodes episode ON episode.id = reading.episode_id
       WHERE reading.model <> 'fallback' AND episode.started_at >= ${since}`
    ),
    query<{ leads: number; booked: number; no_outcome: number }>(
      `SELECT COUNT(*) FILTER (WHERE is_lead)::int AS leads,
              COUNT(*) FILTER (WHERE is_lead AND outcome = 'booked')::int AS booked,
              COUNT(*) FILTER (WHERE is_lead AND outcome IS NULL)::int AS no_outcome
       FROM whatsapp_episodes WHERE started_at >= ${since}`
    ),
    query<{ created: number; edited: number; used: number; dismissed: number; unused: number }>(
      `SELECT COUNT(*)::int AS created,
              COUNT(*) FILTER (WHERE status = 'used')::int AS used,
              COUNT(*) FILTER (WHERE status = 'dismissed')::int AS dismissed,
              COUNT(*) FILTER (WHERE status IN ('shown', 'superseded'))::int AS unused,
              COUNT(*) FILTER (WHERE status = 'used' AND EXISTS (
                SELECT 1 FROM whatsapp_messages message
                WHERE message.suggestion_id = suggestion.id AND message.origin = 'portal_suggestion_edited'
              ))::int AS edited
       FROM whatsapp_reply_suggestions suggestion WHERE created_at >= ${since}`
    ),
    query<{ corrections: number }>(
      `SELECT COUNT(*)::int AS corrections FROM whatsapp_priority_feedback
       WHERE verdict <> 'correct' AND created_at >= ${since}`
    ),
    query<{ first_level: string; conversations: number; booked: number; response_minutes: number | null }>(
      `SELECT first_level, COUNT(*)::int AS conversations,
              COUNT(*) FILTER (WHERE outcome = 'booked')::int AS booked,
              percentile_cont(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (first_response_at - started_at)) / 60)
                FILTER (WHERE first_response_at IS NOT NULL) AS response_minutes
       FROM whatsapp_episodes
       WHERE started_at >= ${since} AND first_level IS NOT NULL
       GROUP BY first_level ORDER BY first_level`
    ),
    query<{ result: Record<string, unknown> | null; finished_at: string | null }>(
      "SELECT last_result AS result, last_finished_at::text AS finished_at FROM whatsapp_job_runs WHERE job_name = 'whatsapp_proposals'"
    ),
    // As janelas acompanham as do job de propostas, não o período escolhido na tela.
    query<LearningProgressCounts>(
      `SELECT
         (SELECT COUNT(*)::int FROM whatsapp_episodes
          WHERE is_lead AND outcome IS NULL AND closed_at IS NULL) AS "leadsWithoutOutcome",
         (SELECT COUNT(*)::int FROM whatsapp_episodes
          WHERE is_lead AND outcome IN ('booked', 'not_booked')
            AND started_at >= NOW() - INTERVAL '90 days') AS "outcomes90d",
         (SELECT COUNT(*)::int FROM whatsapp_priority_feedback
          WHERE verdict <> 'correct' AND created_at >= NOW() - INTERVAL '30 days') AS "corrections30d",
         (SELECT COUNT(*)::int FROM whatsapp_messages
          WHERE origin = 'portal_suggestion_edited'
            AND sent_at >= NOW() - INTERVAL '30 days') AS "editedSuggestions30d"`
    )
  ]);
  const leadCount = leads[0]?.leads ?? 0;
  const booked = leads[0]?.booked ?? 0;
  return {
    period,
    readings: { conversations: readings[0]?.conversations ?? 0, contacts: readings[0]?.contacts ?? 0 },
    leads: { total: leadCount, booked, bookedPercent: leadCount ? Math.round(booked * 100 / leadCount) : 0, noOutcome: leads[0]?.no_outcome ?? 0 },
    suggestions: suggestions[0] ?? { created: 0, edited: 0, used: 0, dismissed: 0, unused: 0 },
    corrections: corrections[0]?.corrections ?? 0,
    accuracy,
    topEdits: Array.isArray(usage[0]?.result?.topEdits) ? usage[0]!.result!.topEdits : [],
    lastAnalysisAt: usage[0]?.finished_at ?? null,
    steps: learningSteps(progress[0] ?? { leadsWithoutOutcome: 0, outcomes90d: 0, corrections30d: 0, editedSuggestions30d: 0 })
  };
}

export async function listCorrections(page = 1, pageSize = 10) {
  const offset = (page - 1) * pageSize;
  const [items, total] = await Promise.all([
    query(
      `SELECT feedback.id, feedback.verdict, feedback.level_at_feedback, feedback.position_at_feedback,
              feedback.created_at::text, contact.push_name, reading.headline, u.name AS user_name
       FROM whatsapp_priority_feedback feedback
       JOIN whatsapp_conversations conversation ON conversation.id = feedback.conversation_id
       JOIN whatsapp_contacts contact ON contact.id = conversation.contact_id
       JOIN whatsapp_ai_readings reading ON reading.id = feedback.reading_id
       LEFT JOIN users u ON u.id = feedback.user_id
       ORDER BY feedback.created_at DESC LIMIT $1 OFFSET $2`,
      [pageSize, offset]
    ),
    query<{ count: number }>("SELECT COUNT(*)::int AS count FROM whatsapp_priority_feedback")
  ]);
  return { items, total: total[0]?.count ?? 0, page, pageSize };
}
