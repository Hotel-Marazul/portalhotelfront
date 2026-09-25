import { z } from "zod";
import { env } from "../../config/env.js";
import { pool, query } from "../../db/client.js";

const triageResponseSchema = z.object({
  intent: z.enum(["reserva_nova", "preco", "alteracao_reserva", "cancelamento", "duvida_estadia", "problema_estadia", "agradecimento", "fornecedor", "outro", "desconhecida"]),
  checkIn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  checkOut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  adults: z.number().int().min(1).max(50).nullable().optional(),
  childrenAges: z.array(z.number().int().min(0).max(17)).max(20).default([]),
  requests: z.array(z.string().max(40)).max(5).default([]),
  missingFields: z.array(z.enum(["dates", "guests"])).max(2).default([]),
  headline: z.string().max(70),
  markerText: z.string().max(100).startsWith("IA leu:")
}).superRefine((value, context) => {
  if ((value.checkIn == null) !== (value.checkOut == null)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["checkOut"], message: "Datas incompletas" });
  } else if (value.checkIn && value.checkOut && value.checkOut <= value.checkIn) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["checkOut"], message: "Check-out inválido" });
  }
});

export interface TriageAgentMessage {
  direction: "inbound" | "outbound";
  text: string;
  sentAt: string;
  media: string | null;
}

export interface TriageAgentRequest {
  hotelToday: string;
  timezone: string;
  guestFirstName: string | null;
  knownContext: { isSupplier: boolean; reservations: unknown[] };
  messages: TriageAgentMessage[];
}

export type TriageAgentResponse = z.output<typeof triageResponseSchema>;

export class AgentsClientError extends Error {
  constructor(public readonly reason: "unavailable" | "timeout" | "invalid_response" | "not_configured" | "daily_limit") {
    super(reason);
  }
}

async function canUseAi(): Promise<void> {
  if (!env.WHATSAPP_AI_ENABLED) throw new AgentsClientError("not_configured");
  if (!env.AGENTS_API_URL || !env.AGENTS_API_KEY) throw new AgentsClientError("not_configured");
  const result = await pool.query<{ calls: number }>(
    `INSERT INTO whatsapp_ai_daily_usage (usage_date, calls)
     VALUES ((NOW() AT TIME ZONE $1)::date, 1)
     ON CONFLICT (usage_date) DO UPDATE SET calls = whatsapp_ai_daily_usage.calls + 1
       WHERE whatsapp_ai_daily_usage.calls < $2
     RETURNING calls`,
    [env.HOTEL_TIMEZONE, env.WHATSAPP_AI_DAILY_LIMIT]
  );
  if (result.rows.length === 0) throw new AgentsClientError("daily_limit");
}

const suggestionResponseSchema = z.object({
  parts: z.array(z.object({ text: z.string().min(1).max(600), gap: z.boolean().default(false) })).min(1).max(20),
  basis: z.array(z.string()).min(2).max(4)
});

const styleResponseSchema = z.object({
  proposals: z.array(z.object({
    instruction: z.string().min(10).max(160),
    supportCount: z.number().int().min(0),
    applicableCount: z.number().int().min(0)
  })).max(3),
  topEdits: z.array(z.object({ description: z.string().min(1).max(160), count: z.number().int().min(1) })).max(3)
});

async function callAgent<T>(path: string, payload: unknown, schema: z.ZodType<T>, timeoutMs: number): Promise<T> {
  await canUseAi();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${env.AGENTS_API_URL}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": env.AGENTS_API_KEY! },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    if (!response.ok) throw new AgentsClientError("unavailable");
    const parsed = schema.safeParse(await response.json());
    if (!parsed.success) throw new AgentsClientError("invalid_response");
    return parsed.data;
  } catch (error) {
    if (error instanceof AgentsClientError) throw error;
    if (error instanceof Error && error.name === "AbortError") throw new AgentsClientError("timeout");
    throw new AgentsClientError("unavailable");
  } finally {
    clearTimeout(timer);
  }
}

export async function triageWithAgents(payload: TriageAgentRequest): Promise<TriageAgentResponse> {
  const response = await callAgent("/whatsapp/triage", payload, triageResponseSchema, 20_000);
  return {
    ...response,
    childrenAges: response.childrenAges ?? [],
    requests: response.requests ?? [],
    missingFields: response.missingFields ?? []
  };
}

export type SuggestionAgentResponse = z.output<typeof suggestionResponseSchema>;

export async function suggestReplyWithAgents(payload: unknown): Promise<SuggestionAgentResponse> {
  const response = await callAgent("/whatsapp/suggest-reply", payload, suggestionResponseSchema, 15_000);
  return { ...response, parts: response.parts.map((part) => ({ ...part, gap: part.gap ?? false })) };
}

export type StyleAgentResponse = z.output<typeof styleResponseSchema>;

export async function proposeReplyStylesWithAgents(payload: unknown): Promise<StyleAgentResponse> {
  return callAgent("/whatsapp/reply-style-proposals", payload, styleResponseSchema, 60_000);
}

export async function aiAvailability() {
  if (!env.WHATSAPP_AI_ENABLED) return { available: false, reason: "disabled" as const };
  if (!env.AGENTS_API_URL || !env.AGENTS_API_KEY) return { available: false, reason: "not_configured" as const };
  const rows = await query<{ calls: number }>(
    `SELECT calls FROM whatsapp_ai_daily_usage
     WHERE usage_date = (NOW() AT TIME ZONE $1)::date LIMIT 1`,
    [env.HOTEL_TIMEZONE]
  );
  if ((rows[0]?.calls ?? 0) >= env.WHATSAPP_AI_DAILY_LIMIT) return { available: false, reason: "daily_limit" as const };
  return { available: true, reason: null } as const;
}
