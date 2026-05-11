import { z } from "zod";

const reservationStatusSchema = z
  .enum(["Pendente", "Confirmada", "EmAndamento", "Concluída", "Concluida", "Cancelada"])
  .transform((value) => (value === "Concluida" ? "Concluída" : value));

const guestSchema = z.object({
  name: z.string().min(2),
  age: z.coerce.number().int().min(0).max(120),
  pricingRuleId: z.string().uuid().nullable().optional()
});

export const createReservationSchema = z.object({
  roomId: z.string().uuid(),
  clientId: z.string().uuid(),
  checkInDate: z.string().datetime(),
  checkOutDate: z.string().datetime(),
  status: reservationStatusSchema.optional().default("Pendente"),
  guests: z.array(guestSchema).default([])
});

export const updateReservationSchema = createReservationSchema;

export const reservationIdSchema = z.object({
  id: z.string().uuid()
});

