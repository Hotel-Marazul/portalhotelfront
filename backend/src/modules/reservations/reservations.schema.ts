import { z } from "zod";
import { normalizeReservationDateInput } from "../../utils/reservation.js";

const reservationStatusValueSchema = z
  .enum(["Pendente", "Confirmada", "EmAndamento", "Concluída", "Concluida", "Cancelada"])
  .transform((value) => (value === "Concluida" ? "Concluída" : value));

const paymentStageSchema = z.enum(["Confirmacao", "CheckIn", "CheckOut"]);
const paymentMethodSchema = z.enum(["Dinheiro", "Pix", "CartaoDebito", "CartaoCredito"]);
const moneySchema = z.coerce.number()
  .finite()
  .nonnegative()
  .max(1_000_000)
  .refine((value) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-8, {
    message: "Use no máximo duas casas decimais."
  });
const positiveMoneySchema = moneySchema.refine((value) => value > 0, { message: "O valor deve ser maior que zero." });
const uuidSchema = z.string().uuid();

const guestSchema = z.object({
  name: z.string().trim().min(2).max(200),
  age: z.coerce.number().int().min(0).max(120),
  pricingRuleId: uuidSchema.nullable().optional()
});

const reservationDateSchema = z
  .string()
  .trim()
  .refine((value) => normalizeReservationDateInput(value, "checkIn") !== null, {
    message: "Data da reserva inválida."
  });

const civilDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a data no formato AAAA-MM-DD.")
  .refine((value) => normalizeReservationDateInput(value, "checkIn") !== null, "Data inválida.");

const reservationBodySchema = z.object({
  roomId: uuidSchema,
  clientId: uuidSchema,
  checkInDate: reservationDateSchema,
  checkOutDate: reservationDateSchema,
  status: reservationStatusValueSchema.optional().default("Pendente"),
  statusReason: z.string().trim().min(3).max(500).optional(),
  guests: z.array(guestSchema).max(100).default([]),
  dailyRateOverride: positiveMoneySchema.optional(),
  discountAmount: moneySchema.optional(),
  priceOverrideReason: z.string().trim().min(3).max(500).optional(),
  clearDailyRateOverride: z.boolean().optional().default(false),
  idempotencyKey: uuidSchema,
  correlationId: uuidSchema.optional()
});

type PricingAdjustmentData = {
  dailyRateOverride?: number;
  discountAmount?: number;
  priceOverrideReason?: string;
};

function validatePricingAdjustment(
  data: PricingAdjustmentData,
  context: z.RefinementCtx
) {
  const hasDiscount = Number(data.discountAmount ?? 0) > 0;
  const hasManualAdjustment = data.dailyRateOverride !== undefined || hasDiscount;

  if (hasManualAdjustment && !data.priceOverrideReason) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["priceOverrideReason"],
      message: "Informe o motivo do ajuste manual de preço."
    });
  }
}

export const reservationQuoteSchema = reservationBodySchema
  .omit({ status: true, statusReason: true, idempotencyKey: true, correlationId: true })
  .extend({ reservationId: uuidSchema.optional() })
  .superRefine(validatePricingAdjustment);

export const createReservationSchema = reservationBodySchema.superRefine((data, context) => {
  validatePricingAdjustment(data, context);
  if (data.status !== "Pendente" && data.status !== "Confirmada") {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["status"],
      message: "A criação só pode iniciar como Pendente ou Confirmada."
    });
  }
  if (data.status === "Confirmada" && !data.statusReason) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["statusReason"],
      message: "Informe a justificativa administrativa para criar Confirmada."
    });
  }
});

export const updateReservationSchema = reservationBodySchema
  .omit({ idempotencyKey: true, status: true, statusReason: true, guests: true })
  .extend({
    guests: z.array(guestSchema).max(100).optional(),
    version: z.coerce.number().int().positive(),
    idempotencyKey: uuidSchema.optional()
  })
  .superRefine(validatePricingAdjustment);

export const reservationIdSchema = z.object({
  id: uuidSchema
});

const versionSchema = z.coerce.number().int().positive();

export const reservationTransitionSchema = z.object({
  targetStatus: reservationStatusValueSchema,
  version: versionSchema,
  reason: z.string().trim().min(3).max(500).optional(),
  idempotencyKey: uuidSchema.optional(),
  correlationId: uuidSchema.optional()
}).superRefine((data, context) => {
  if (data.targetStatus === "Cancelada" && !data.reason) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["reason"], message: "Informe o motivo do cancelamento." });
  }
});

export const cancelReservationSchema = z.object({
  version: versionSchema,
  reason: z.string().trim().min(3).max(500),
  idempotencyKey: uuidSchema.optional(),
  correlationId: uuidSchema.optional()
});

export const createReservationPaymentSchema = z.object({
  stage: paymentStageSchema,
  method: paymentMethodSchema,
  amount: positiveMoneySchema,
  note: z.string().trim().max(500).optional().default(""),
  idempotencyKey: uuidSchema,
  correlationId: uuidSchema.optional()
});

export const reverseReservationPaymentSchema = z.object({
  amount: positiveMoneySchema,
  reason: z.string().trim().min(3).max(500),
  idempotencyKey: uuidSchema,
  correlationId: uuidSchema.optional()
});

const reservationStatusFilterSchema = z.preprocess(
  (value) => {
    if (value === undefined) return undefined;
    const values = Array.isArray(value) ? value : [value];
    return values
      .filter((item): item is string => typeof item === "string")
      .flatMap((item) => item.split(","))
      .map((item) => item.trim())
      .filter(Boolean);
  },
  z.array(reservationStatusValueSchema).min(1).max(5)
);

export const reservationListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
  status: reservationStatusFilterSchema.optional(),
  search: z.string().trim().max(100).optional(),
  q: z.string().trim().max(100).optional(),
  roomId: uuidSchema.optional(),
  checkInFrom: civilDateSchema.optional(),
  checkInTo: civilDateSchema.optional(),
  checkOutFrom: civilDateSchema.optional(),
  checkOutTo: civilDateSchema.optional()
}).superRefine((data, context) => {
  const ranges: Array<[keyof typeof data, keyof typeof data, string]> = [
    ["checkInFrom", "checkInTo", "checkInTo"],
    ["checkOutFrom", "checkOutTo", "checkOutTo"]
  ];
  for (const [fromKey, toKey, path] of ranges) {
    const from = data[fromKey];
    const to = data[toKey];
    if (from && to && to < from) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: [path], message: "Data final deve ser posterior à inicial." });
    }
  }
});
