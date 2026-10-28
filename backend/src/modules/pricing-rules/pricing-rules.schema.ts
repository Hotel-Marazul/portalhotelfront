import { z } from "zod";

export const AGE_RANGE_MESSAGE = "A idade máxima deve ser maior ou igual à mínima.";

const ageSchema = z.coerce.number().int("Informe a idade em anos inteiros.").min(0, "A idade não pode ser negativa.").max(150);

export const pricingRuleBodySchema = z.object({
  name: z.string().trim().min(2, "Informe o nome da regra."),
  description: z.string().trim().max(500).default(""),
  minAge: ageSchema,
  maxAge: ageSchema,
  price: z.coerce.number().finite().min(0, "O valor não pode ser negativo.").max(1_000_000),
  billingBasis: z.enum(["per_daily", "per_stay"])
}).superRefine((data, context) => {
  if (data.maxAge < data.minAge) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["maxAge"], message: AGE_RANGE_MESSAGE });
  }
});

export type PricingRuleBody = z.infer<typeof pricingRuleBodySchema>;

export const pricingRuleIdParamSchema = z.object({
  id: z.string().uuid()
});
