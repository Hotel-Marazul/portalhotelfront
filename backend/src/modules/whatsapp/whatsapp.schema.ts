import { z } from "zod";

export const whatsappContactIdSchema = z.object({
  id: z.string().uuid()
});

export const whatsappLinkBodySchema = z.object({
  clientId: z.string().uuid()
});

export const whatsappContactKindBodySchema = z.object({
  kind: z.enum(["guest", "supplier"])
});

export const whatsappQueueQuerySchema = z.object({
  filter: z.enum(["todas", "lead", "reserva", "outros"]).default("todas")
});

export const whatsappSearchQuerySchema = z.object({
  search: z.string().trim().min(2).max(100)
});

export const whatsappMessagesQuerySchema = z.object({
  before: z.string().uuid().optional(),
  after: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(50)
}).refine((value) => !(value.before && value.after), {
  message: "before e after não podem ser usados juntos."
});

export const whatsappSendMessageSchema = z.object({
  text: z.string().trim().min(1).max(4096),
  clientRequestId: z.string().uuid(),
  suggestionId: z.string().uuid().nullable().optional(),
  lastSeenMessageId: z.string().uuid().nullable().optional(),
  force: z.boolean().default(false)
});

export const whatsappOutcomeSchema = z.object({
  outcome: z.enum(["booked", "not_booked", "not_lead"]).nullable()
});

export const whatsappPriorityFeedbackSchema = z.object({
  verdict: z.enum(["correct", "should_be_higher", "should_be_lower"])
});

export const whatsappLearningPeriodSchema = z.object({
  period: z.enum(["7d", "30d", "all"]).default("30d")
});

export const whatsappLearningPageSchema = z.object({
  page: z.coerce.number().int().min(1).default(1)
});
