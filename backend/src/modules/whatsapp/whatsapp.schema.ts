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
