import { env } from "../../config/env.js";
import { query } from "../../db/client.js";

type ConnectionState = "open" | "connecting" | "close" | "unknown";
type AiReason = "disabled" | "not_configured" | "daily_limit" | null;

interface ConfigurationInput {
  enabled: boolean;
  instance: string;
  state: ConnectionState;
  stateChangedAt: string | null;
  apiConfigured: boolean;
  webhookConfigured: boolean;
  aiEnabled: boolean;
  aiAvailable: boolean;
  aiReason: AiReason;
  dailyCalls: number | null;
  dailyLimit: number;
  retentionMonths: number;
  conversations: number | null;
  waiting: number | null;
  inboundToday: number | null;
  outboundToday: number | null;
  failedToday: number | null;
}

const countOf = (value: number | null): number => value ?? 0;

export function buildWhatsappConfiguration(input: ConfigurationInput) {
  return {
    connection: {
      enabled: input.enabled,
      instance: input.instance,
      state: input.state,
      stateChangedAt: input.stateChangedAt,
      apiConfigured: input.apiConfigured,
      webhookConfigured: input.webhookConfigured
    },
    agent: {
      enabled: input.aiEnabled,
      available: input.aiAvailable,
      reason: input.aiReason,
      dailyCalls: countOf(input.dailyCalls),
      dailyLimit: input.dailyLimit,
      mode: "assistido" as const
    },
    data: { retentionMonths: input.retentionMonths },
    metrics: {
      conversations: countOf(input.conversations),
      waiting: countOf(input.waiting),
      inboundToday: countOf(input.inboundToday),
      outboundToday: countOf(input.outboundToday),
      failedToday: countOf(input.failedToday)
    }
  };
}

export async function getWhatsappConfiguration() {
  const [instances, usage, metrics] = await Promise.all([
    query<{ connection_state: ConnectionState; state_changed_at: string | null }>(
      `SELECT connection_state, state_changed_at::text
       FROM whatsapp_instances
       WHERE name = $1
       LIMIT 1`,
      [env.EVOLUTION_INSTANCE]
    ),
    query<{ calls: number }>(
      `SELECT calls
       FROM whatsapp_ai_daily_usage
       WHERE usage_date = (NOW() AT TIME ZONE $1)::date
       LIMIT 1`,
      [env.HOTEL_TIMEZONE]
    ),
    query<{
      conversations: number;
      waiting: number;
      inbound_today: number;
      outbound_today: number;
      failed_today: number;
    }>(
      `SELECT
         (SELECT COUNT(*)::int FROM whatsapp_conversations) AS conversations,
         (SELECT COUNT(*)::int FROM whatsapp_conversations WHERE awaiting_since IS NOT NULL) AS waiting,
         COUNT(*) FILTER (
           WHERE direction = 'inbound'
             AND (sent_at AT TIME ZONE $1)::date = (NOW() AT TIME ZONE $1)::date
         )::int AS inbound_today,
         COUNT(*) FILTER (
           WHERE direction = 'outbound'
             AND (sent_at AT TIME ZONE $1)::date = (NOW() AT TIME ZONE $1)::date
         )::int AS outbound_today,
         COUNT(*) FILTER (
           WHERE direction = 'outbound' AND status = 'failed'
             AND (sent_at AT TIME ZONE $1)::date = (NOW() AT TIME ZONE $1)::date
         )::int AS failed_today
       FROM whatsapp_messages`,
      [env.HOTEL_TIMEZONE]
    )
  ]);

  const dailyCalls = usage[0]?.calls ?? 0;
  let aiReason: AiReason = null;
  if (!env.WHATSAPP_AI_ENABLED) aiReason = "disabled";
  else if (!env.AGENTS_API_URL || !env.AGENTS_API_KEY) aiReason = "not_configured";
  else if (dailyCalls >= env.WHATSAPP_AI_DAILY_LIMIT) aiReason = "daily_limit";

  const metric = metrics[0];
  return buildWhatsappConfiguration({
    enabled: env.WHATSAPP_ENABLED,
    instance: env.EVOLUTION_INSTANCE,
    state: instances[0]?.connection_state ?? "unknown",
    stateChangedAt: instances[0]?.state_changed_at ?? null,
    apiConfigured: Boolean(env.EVOLUTION_API_URL && env.EVOLUTION_API_KEY),
    webhookConfigured: Boolean(env.WHATSAPP_WEBHOOK_SECRET),
    aiEnabled: env.WHATSAPP_AI_ENABLED,
    aiAvailable: aiReason === null,
    aiReason,
    dailyCalls,
    dailyLimit: env.WHATSAPP_AI_DAILY_LIMIT,
    retentionMonths: env.WHATSAPP_RETENTION_MONTHS,
    conversations: metric?.conversations ?? 0,
    waiting: metric?.waiting ?? 0,
    inboundToday: metric?.inbound_today ?? 0,
    outboundToday: metric?.outbound_today ?? 0,
    failedToday: metric?.failed_today ?? 0
  });
}
