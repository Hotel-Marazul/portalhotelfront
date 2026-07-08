import { z } from "zod";
import { normalizeReservationDateInput } from "../../utils/reservation.js";

const reservationStatusSchema = z
  .enum(["Pendente", "Confirmada", "EmAndamento", "Concluída", "Concluida", "Cancelada"])
  .transform((value) => (value === "Concluida" ? "Concluída" : value));

const paymentStageSchema = z.enum(["Confirmacao", "CheckIn", "CheckOut"]);
const paymentMethodSchema = z.enum(["Dinheiro", "Pix", "CartaoDebito", "CartaoCredito"]);

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

export const createReservationSchema = z.object({
  roomId: z.string().uuid(),
  clientId: z.string().uuid(),
  checkInDate: reservationDateSchema,
  checkOutDate: reservationDateSchema,
  status: reservationStatusSchema.optional().default("Pendente"),
  guests: z.array(guestSchema).default([])
});

export const updateReservationSchema = createReservationSchema;

export const reservationIdSchema = z.object({
  id: z.string().uuid()
});

export const createReservationPaymentSchema = z.object({
  stage: paymentStageSchema,
  method: paymentMethodSchema,
  amount: z.coerce.number().positive(),
  note: z.string().max(500).optional().default("")
});

