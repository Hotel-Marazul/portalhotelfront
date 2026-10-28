import assert from "node:assert/strict";
import test from "node:test";
import { AGE_RANGE_MESSAGE, pricingRuleBodySchema, pricingRuleIdParamSchema } from "./pricing-rules.schema.js";

const valid = { name: "Criança 6 a 11", description: "Cobrança por diária", minAge: 6, maxAge: 11, price: 120, billingBasis: "per_daily" };

test("regra válida passa e normaliza nome e descrição", () => {
  const parsed = pricingRuleBodySchema.parse({ ...valid, name: "  Criança 6 a 11 ", description: undefined });
  assert.equal(parsed.name, "Criança 6 a 11");
  assert.equal(parsed.description, "");
  assert.equal(pricingRuleBodySchema.safeParse({ ...valid, billingBasis: "per_stay" }).success, true);
});

test("valor zero é permitido (gratuidade) e números em texto são aceitos", () => {
  const parsed = pricingRuleBodySchema.parse({ ...valid, price: "0", minAge: "0", maxAge: "2" });
  assert.deepEqual([parsed.price, parsed.minAge, parsed.maxAge], [0, 0, 2]);
});

test("idade máxima igual à mínima é aceita; menor é recusada com mensagem", () => {
  assert.equal(pricingRuleBodySchema.safeParse({ ...valid, minAge: 5, maxAge: 5 }).success, true);
  const result = pricingRuleBodySchema.safeParse({ ...valid, minAge: 12, maxAge: 6 });
  assert.equal(result.success, false);
  assert.deepEqual(result.error?.flatten().fieldErrors.maxAge, [AGE_RANGE_MESSAGE]);
});

test("recusa nome curto, valor negativo, idade negativa ou fracionada e cobrança desconhecida", () => {
  for (const invalid of [
    { ...valid, name: " a " },
    { ...valid, price: -1 },
    { ...valid, minAge: -1 },
    { ...valid, maxAge: 7.5 },
    { ...valid, billingBasis: "per_person" },
    { ...valid, billingBasis: undefined },
    { ...valid, price: "abc" }
  ]) assert.equal(pricingRuleBodySchema.safeParse(invalid).success, false, JSON.stringify(invalid));
});

test("id da rota precisa ser UUID", () => {
  assert.equal(pricingRuleIdParamSchema.safeParse({ id: "x" }).success, false);
  assert.equal(pricingRuleIdParamSchema.safeParse({ id: "7d0c7f1e-2a4b-4c8d-9e0f-1a2b3c4d5e6f" }).success, true);
});
