import assert from "node:assert/strict";
import test from "node:test";
import { reservationQuoteKey } from "../src/utils/reservation.ts";

test("cotação de temporada aceita regra não selecionada sem enviar UUID vazio", () => {
  const input = {
    roomId: "11111111-1111-4111-8111-111111111111", clientId: "22222222-2222-4222-8222-222222222222",
    checkInDate: "2026-12-20", checkOutDate: "2026-12-25", mealPlan: "half_board",
    guests: [{ name: "Acompanhante", age: 35, pricingRuleId: null }, { name: "Criança", age: 4, pricingRuleId: "" }]
  };
  const body = JSON.parse(reservationQuoteKey(input));
  assert.equal(body.guests[1].pricingRuleId, null);
  assert.equal(body.mealPlan, "half_board");
  assert.equal(body.guests[1].age, 4);
  assert.equal(input.guests[1].pricingRuleId, "", "A normalização não altera o formulário.");
});

test("chave de cotação preserva regra explícita e diferencia regimes e períodos", () => {
  const ruleId = "33333333-3333-4333-8333-333333333333";
  const input = { roomId: "room", clientId: "client", checkInDate: "2026-12-20", checkOutDate: "2026-12-25", guests: [{ name: "Criança", age: 4, pricingRuleId: ruleId }] };
  assert.equal(JSON.parse(reservationQuoteKey(input)).guests[0].pricingRuleId, ruleId);
  assert.notEqual(reservationQuoteKey(input), reservationQuoteKey({ ...input, mealPlan: "half_board" }));
  assert.notEqual(reservationQuoteKey(input), reservationQuoteKey({ ...input, checkOutDate: "2026-12-26" }));
  assert.equal(reservationQuoteKey(null), "");
});
