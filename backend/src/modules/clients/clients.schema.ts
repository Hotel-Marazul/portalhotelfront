import { z } from "zod";

export const clientBodySchema = z.object({
  fullName: z.string().min(3),
  cpf: z.string().min(11).max(14),
  email: z.string().email(),
  fone: z.string().min(8),
  automovel: z.string().optional().default(""),
  placa: z.string().optional().default("")
});

export const clientIdSchema = z.object({
  id: z.string().uuid()
});
