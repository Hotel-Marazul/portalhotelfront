import { z } from "zod";

const positiveMoneySchema = z.coerce.number().finite().positive().max(1_000_000);

export const categoryBodySchema = z.object({
  name: z.string().min(2),
  // `price` remains accepted for old clients and represents the couple/default
  // tariff during the expand phase of the migration.
  price: positiveMoneySchema.optional(),
  singlePrice: positiveMoneySchema.nullable().optional(),
  couplePrice: positiveMoneySchema.optional()
}).superRefine((data, context) => {
  if (data.price === undefined && data.couplePrice === undefined) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["couplePrice"],
      message: "Informe a tarifa de casal ou o preço legado da categoria."
    });
  }
});

export const idParamSchema = z.object({
  id: z.string().uuid()
});
