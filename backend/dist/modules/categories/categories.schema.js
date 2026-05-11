import { z } from "zod";
export const categoryBodySchema = z.object({
    name: z.string().min(2),
    price: z.coerce.number().positive()
});
export const idParamSchema = z.object({
    id: z.string().uuid()
});
