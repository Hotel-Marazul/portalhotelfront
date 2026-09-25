import { randomUUID } from "node:crypto";
import { pool, query } from "../../db/client.js";
import { canonicalConditionKey } from "./learning.service.js";
import { aiAvailability, proposeReplyStylesWithAgents } from "./agents-client.js";

export const CONDITION_CATALOG: Array<{ title: string; condition: Record<string, unknown> }> = [
  { title: "Pedido com datas e número de pessoas", condition: { has_dates: true, has_guest_count: true, intent: "reserva_nova" } },
  { title: "Pergunta só de preço, sem datas", condition: { has_dates: false, intent: "preco" } },
  { title: "Pergunta de preço com datas", condition: { has_dates: true, intent: "preco" } },
  { title: "Quem já se hospedou antes", condition: { is_returning_guest: true } },
  { title: "Contato sem cadastro", condition: { unknown_contact: true } },
  { title: "Período com poucos quartos livres", condition: { high_demand: true } },
  { title: "Sem quarto livre para o grupo", condition: { no_availability: true } },
  { title: "Pedido de alteração de reserva", condition: { intent: "alteracao_reserva" } }
];

export function matchesCondition(condition: Record<string, unknown>, signals: Record<string, unknown>): boolean {
  return Object.entries(condition).every(([key, value]) => signals[key] === value);
}

function percent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

async function insertProposal(input: {
  kind: "queue" | "reply";
  title: string;
  condition?: Record<string, unknown>;
  weight?: -10 | 10;
  source: "outcomes" | "corrections" | "edits";
  evidence: Record<string, unknown>;
  evidenceText: string;
  instruction?: string;
}): Promise<boolean> {
  const conditionKey = input.kind === "queue"
    ? canonicalConditionKey(input.condition ?? {})
    : input.instruction!.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim().replace(/\s+/g, " ");
  const recent = await query<{ id: string }>(
    `SELECT event.id FROM whatsapp_ai_rule_events event
     JOIN whatsapp_ai_rules rule ON rule.id = event.rule_id
     WHERE rule.kind = $1 AND rule.condition_key = $2
       AND event.action IN ('ignored', 'reverted')
       AND event.created_at >= NOW() - INTERVAL '30 days'
     LIMIT 1`,
    [input.kind, conditionKey]
  );
  if (recent.length > 0) return false;
  const rows = await query<{ id: string }>(
    `INSERT INTO whatsapp_ai_rules
     (id, kind, status, title, condition, weight, instruction, condition_key, source, evidence, evidence_text)
     VALUES ($1, $2, 'proposed', $3, $4::jsonb, $5, $6, $7, $8, $9::jsonb, $10)
     ON CONFLICT DO NOTHING
     RETURNING id`,
    [
      randomUUID(), input.kind, input.title, input.condition ? JSON.stringify(input.condition) : null,
      input.weight ?? null, input.instruction ?? null, conditionKey, input.source,
      JSON.stringify(input.evidence), input.evidenceText
    ]
  );
  if (rows.length > 0) {
    await query(
      `INSERT INTO whatsapp_ai_rule_events (id, rule_id, action)
       VALUES ($1, $2, 'proposed')`,
      [randomUUID(), rows[0].id]
    );
  }
  return rows.length > 0;
}

export async function runLearningProposals(): Promise<{ created: number; topEdits: unknown[] }> {
  const outcomeRows = await query<{ signals: Record<string, unknown>; outcome: "booked" | "not_booked" }>(
    `SELECT reading.signals, episode.outcome
     FROM whatsapp_episodes episode
     JOIN LATERAL (
       SELECT signals FROM whatsapp_ai_readings reading
       WHERE reading.episode_id = episode.id
       ORDER BY reading.created_at ASC LIMIT 1
     ) reading ON TRUE
     WHERE episode.is_lead = TRUE
       AND episode.outcome IN ('booked', 'not_booked')
       AND episode.started_at >= NOW() - INTERVAL '90 days'`
  );
  const total = outcomeRows.length;
  const booked = outcomeRows.filter((row) => row.outcome === "booked").length;
  const base = total ? booked / total : 0;
  let created = 0;
  for (const catalog of CONDITION_CATALOG) {
    const matched = outcomeRows.filter((row) => matchesCondition(catalog.condition, row.signals));
    if (matched.length < 8) continue;
    const matchedBooked = matched.filter((row) => row.outcome === "booked").length;
    const rate = matchedBooked / matched.length;
    const weight: -10 | 0 | 10 = rate - base >= 0.2 ? 10 : base - rate >= 0.2 ? -10 : 0;
    if (weight === 0) continue;
    const proposalWeight: -10 | 10 = weight > 0 ? 10 : -10;
    const added = await insertProposal({
      kind: "queue", title: catalog.title, condition: catalog.condition, weight: proposalWeight,
      source: "outcomes",
      evidence: { total: matched.length, booked: matchedBooked, rate, base },
      evidenceText: `De ${matched.length} atendimentos assim, ${matchedBooked} viraram reserva (${percent(rate)}), contra ${percent(base)} no geral.`
    });
    if (added) created += 1;
  }

  const correctionRows = await query<{
    verdict: "should_be_higher" | "should_be_lower";
    signals: Record<string, unknown>;
    first_name: string | null;
  }>(
    `SELECT feedback.verdict, reading.signals,
            split_part(COALESCE(client.full_name, contact.push_name), ' ', 1) AS first_name
     FROM whatsapp_priority_feedback feedback
     JOIN whatsapp_ai_readings reading ON reading.id = feedback.reading_id
     JOIN whatsapp_conversations conversation ON conversation.id = feedback.conversation_id
     JOIN whatsapp_contacts contact ON contact.id = conversation.contact_id
     LEFT JOIN clients client ON client.id = contact.client_id
     WHERE feedback.verdict <> 'correct' AND feedback.created_at >= NOW() - INTERVAL '30 days'`
  );
  for (const catalog of CONDITION_CATALOG) {
    const matched = correctionRows.filter((row) => matchesCondition(catalog.condition, row.signals));
    const higher = matched.filter((row) => row.verdict === "should_be_higher").length;
    const lower = matched.filter((row) => row.verdict === "should_be_lower").length;
    const weight: -10 | 0 | 10 = higher >= 3 && higher >= lower * 2 ? 10 : lower >= 3 && lower >= higher * 2 ? -10 : 0;
    if (weight === 0) continue;
    const proposalWeight: -10 | 10 = weight > 0 ? 10 : -10;
    const direction = proposalWeight > 0 ? "cima" : "baixo";
    const names = [...new Set(matched.map((row) => row.first_name).filter(Boolean))].slice(0, 3).join(", ");
    const added = await insertProposal({
      kind: "queue", title: catalog.title, condition: catalog.condition, weight: proposalWeight,
      source: "corrections",
      evidence: { higher, lower, names },
      evidenceText: `Corrigido para ${direction} ${weight > 0 ? higher : lower} vezes${names ? ` por ${names}` : ""}.`
    });
    if (added) created += 1;
  }

  const topEdits: unknown[] = [];
  const ai = await aiAvailability();
  if (ai.available) {
    const pairs = await query<{
      suggested: string;
      sent: string;
      push_name: string;
      full_name: string | null;
    }>(
      `SELECT suggestion.text AS suggested, message.body AS sent,
              contact.push_name, client.full_name
       FROM whatsapp_reply_suggestions suggestion
       JOIN whatsapp_messages message ON message.suggestion_id = suggestion.id
       JOIN whatsapp_conversations conversation ON conversation.id = suggestion.conversation_id
       JOIN whatsapp_contacts contact ON contact.id = conversation.contact_id
       LEFT JOIN clients client ON client.id = contact.client_id
       WHERE message.origin = 'portal_suggestion_edited'
         AND message.sent_at >= NOW() - INTERVAL '30 days'
       ORDER BY message.sent_at DESC LIMIT 50`
    );
    if (pairs.length >= 5) {
      const activeInstructions = await query<{ instruction: string }>(
        "SELECT instruction FROM whatsapp_ai_rules WHERE kind = 'reply' AND status = 'active' ORDER BY proposed_at"
      );
      const response = await proposeReplyStylesWithAgents({
        pairs: pairs.map((pair) => ({ suggested: pair.suggested, sent: pair.sent })),
        activeInstructions: activeInstructions.map((row) => row.instruction)
      });
      const names = pairs.flatMap((pair) => [pair.push_name, pair.full_name ?? ""])
        .flatMap((name) => name.split(/\s+/)).filter((name) => name.length >= 3)
        .map((name) => name.toLocaleLowerCase("pt-BR"));
      for (const proposal of response.proposals) {
        const instruction = proposal.instruction.trim();
        const lower = instruction.toLocaleLowerCase("pt-BR");
        if (proposal.supportCount < 5 || proposal.supportCount > proposal.applicableCount) continue;
        if (/\d{8,}/.test(instruction) || names.some((name) => lower.includes(name))) continue;
        const added = await insertProposal({
          kind: "reply", title: "Padrão de resposta", instruction, source: "edits",
          evidence: { supportCount: proposal.supportCount, applicableCount: proposal.applicableCount },
          evidenceText: `Em ${proposal.supportCount} de ${proposal.applicableCount} sugestões editadas, segundo a leitura da IA.`
        });
        if (added) created += 1;
      }
      topEdits.push(...response.topEdits);
    }
  }
  await query(
    `INSERT INTO whatsapp_job_runs (job_name, last_started_at, last_finished_at, last_result)
     VALUES ('whatsapp_proposals', NOW(), NOW(), $1::jsonb)
     ON CONFLICT (job_name) DO UPDATE
     SET last_finished_at = NOW(), last_result = EXCLUDED.last_result`,
    [JSON.stringify({ topEdits })]
  );
  return { created, topEdits };
}
