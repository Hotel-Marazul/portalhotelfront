// Formulário de regra de hóspede adicional, testado em tests/regra-form.test.mjs.
// As mensagens repetem as do backend (pricing-rules.schema.ts).

import { moneyInput, parseMoney, type PricingRuleDto } from "./tarifas-data.ts";

export type BillingBasis = "per_daily" | "per_stay";

export interface RuleFormState {
  name: string;
  description: string;
  minAge: string;
  maxAge: string;
  price: string;
  billingBasis: BillingBasis;
}

/** Corpo de POST /api/pricing-rules e PUT /api/pricing-rules/:id. */
export interface RuleBody {
  name: string;
  description: string;
  minAge: number;
  maxAge: number;
  price: number;
  billingBasis: BillingBasis;
}

export type RuleFormErrors = Partial<Record<keyof RuleFormState, string>>;

export const EMPTY_RULE_FORM: RuleFormState = { name: "", description: "", minAge: "", maxAge: "", price: "", billingBasis: "per_daily" };

export function ruleFormFrom(rule: PricingRuleDto | null): RuleFormState {
  if (!rule) return EMPTY_RULE_FORM;
  return {
    name: rule.name,
    description: rule.description ?? "",
    minAge: String(rule.minAge),
    maxAge: String(rule.maxAge),
    price: moneyInput(rule.price),
    billingBasis: rule.billingBasis ?? "per_daily",
  };
}

const MAX_AGE = 150;

function parseAge(text: string): number | null {
  const clean = text.trim();
  if (!/^\d+$/.test(clean)) return null;
  const age = Number(clean);
  return age <= MAX_AGE ? age : null;
}

export function validateRuleForm(form: RuleFormState): { ok: true; body: RuleBody } | { ok: false; errors: RuleFormErrors } {
  const errors: RuleFormErrors = {};
  const name = form.name.trim();
  if (name.length < 2) errors.name = "Informe o nome da regra.";

  const minAge = parseAge(form.minAge);
  const maxAge = parseAge(form.maxAge);
  if (minAge === null) errors.minAge = "Idade em anos inteiros, de 0 a 150.";
  if (maxAge === null) errors.maxAge = "Idade em anos inteiros, de 0 a 150.";
  else if (minAge !== null && maxAge < minAge) errors.maxAge = "A idade máxima deve ser maior ou igual à mínima.";

  const price = parseMoney(form.price);
  if (price === null || Number.isNaN(price)) errors.price = "Informe o valor; use 0 para gratuidade.";

  if (form.billingBasis !== "per_daily" && form.billingBasis !== "per_stay") errors.billingBasis = "Escolha a cobrança.";

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    body: {
      name,
      description: form.description.trim(),
      minAge: minAge as number,
      maxAge: maxAge as number,
      price: price as number,
      billingBasis: form.billingBasis,
    },
  };
}
