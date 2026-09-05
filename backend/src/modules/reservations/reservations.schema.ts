import { z } from "zod";
import { normalizeReservationDateInput } from "../../utils/reservation.js";

const reservationStatusSchema = z
  .enum(["Pendente", "Confirmada", "EmAndamento", "Concluída", "Concluida", "Cancelada"])
  .transform((value) => (value === "Concluida" ? "Concluída" : value));

const paymentStageSchema = z.enum(["Confirmacao", "CheckIn", "CheckOut"]);
const paymentMethodSchema = z.enum(["Dinheiro", "Pix", "CartaoDebito", "CartaoCredito"]);
const moneySchema = z.coerce.number().finite().nonnegative().max(1_000_000);
const positiveMoneySchema = moneySchema.positive();

const guestSchema = z.object({
  name: z.string().min(2),
  age: z.coerce.number().int().min(0).max(120),
  pricingRuleId: z.string().uuid().nullable().optional()
});

const reservationDateSchema = z
  .string()
  .refine((value) => normalizeReservationDateInput(value, "checkIn") !== null, {
    message: "Data da reserva invalida."
  });

const reservationBodySchema = z.object({
  roomId: z.string().uuid(),
  clientId: z.string().uuid(),
  checkInDate: reservationDateSchema,
  checkOutDate: reservationDateSchema,
  status: reservationStatusSchema.optional().default("Pendente"),
  guests: z.array(guestSchema).default([]),
  dailyRateOverride: positiveMoneySchema.optional(),
  discountAmount: moneySchema.optional(),
  priceOverrideReason: z.string().trim().min(3).max(500).optional(),
  clearDailyRateOverride: z.boolean().optional().default(false)
});

function validatePricingAdjustment(
  data: z.infer<typeof reservationBodySchema>,
  context: z.RefinementCtx
) {
  const hasDiscount = (data.discountAmount ?? 0) > 0;
  const hasManualAdjustment = data.dailyRateOverride !== undefined || hasDiscount;

  if (hasManualAdjustment && !data.priceOverrideReason) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["priceOverrideReason"],
      message: "Informe o motivo do ajuste manual de preço."
    });
  }
}

export const createReservationSchema = reservationBodySchema.superRefine(validatePricingAdjustment);

export const updateReservationSchema = reservationBodySchema.superRefine(validatePricingAdjustment);

export const reservationIdSchema = z.object({
  id: z.string().uuid()
});

export const createReservationPaymentSchema = z.object({
  stage: paymentStageSchema,
  method: paymentMethodSchema,
  amount: z.coerce.number().positive(),
  note: z.string().max(500).optional().default("")
});
