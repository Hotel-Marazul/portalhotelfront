import assert from "node:assert/strict";
import test from "node:test";
import { calculateReservationPricing, type ReservationPricingInput } from "./reservation.js";

const guest = (age: number, rule: string | null = null) => ({
  id: `g-${age}`, reservationId: "", name: `Hóspede ${age}`, age, pricingRuleId: rule
});
const input: ReservationPricingInput = {
  checkInDate: "2026-12-20", checkOutDate: "2026-12-25",
  singlePrice: null, couplePrice: 473, halfBoardPrice: 583,
  rateValidFrom: "2026-12-01", rateValidUntil: "2027-03-01",
  guests: [guest(35)],
  pricingRules: [
    { id: "free", name: "Bebê", description: "", minAge: 0, maxAge: 2, price: 0 },
    { id: "child", name: "Criança", description: "", minAge: 3, maxAge: 5, price: 100, billingBasis: "per_stay" },
    { id: "older", name: "Criança", description: "", minAge: 6, maxAge: 11, price: 120 },
    { id: "adult", name: "Adicional", description: "", minAge: 12, maxAge: 120, price: 200 }
  ]
};

test("casal por cinco diárias com café e meia pensão", () => {
  assert.equal(calculateReservationPricing(input).totalPrice, 2365);
  assert.equal(calculateReservationPricing({ ...input, mealPlan: "half_board" }).totalPrice, 2915);
});

test("criança 3–5 paga cem uma vez, nos dois regimes e por criança", () => {
  for (const mealPlan of ["breakfast", "half_board"] as const) {
    const pricing = calculateReservationPricing({ ...input, mealPlan, guests: [...input.guests, guest(4, "child"), guest(5, "child")] });
    assert.equal(pricing.totalPrice, (mealPlan === "breakfast" ? 2365 : 2915) + 200);
    assert.equal(pricing.additionalStayTotal, 200);
    assert.equal(pricing.additionalDailyTotal, 0);
  }
});

test("limites de idade e adicionais por diária", () => {
  for (const [age, rule, extra] of [[0, "free", 0], [2, "free", 0], [3, "child", 100], [5, "child", 100], [6, "older", 600], [11, "older", 600], [12, "adult", 1000]] as const) {
    assert.equal(calculateReservationPricing({ ...input, guests: [...input.guests, guest(age, rule)] }).totalPrice, 2365 + extra);
  }
});

test("datas fora da validade usam a diária atual da categoria", () => {
  for (const [checkInDate, checkOutDate, nights] of [["2027-02-28", "2027-03-01", 1], ["2026-11-30", "2026-12-02", 2], ["2027-02-28", "2027-03-02", 2], ["2027-12-20", "2027-12-25", 5]] as const) {
    assert.equal(calculateReservationPricing({ ...input, checkInDate, checkOutDate }).totalPrice, 473 * nights);
  }
});

test("meia pensão ausente não utiliza o preço do café", () => {
  assert.throws(() => calculateReservationPricing({ ...input, mealPlan: "half_board", halfBoardPrice: null }), /meia pensão/i);
});

test("desconto e diária manual preservam taxa única e regras de idade", () => {
  const pricing = calculateReservationPricing({ ...input, guests: [...input.guests, guest(4, "child")], dailyRateOverride: 400, discountAmount: 50 });
  assert.equal(pricing.totalPrice, 2050);
  assert.throws(() => calculateReservationPricing({ ...input, guests: [...input.guests, guest(8, "child")] }), /compatível/i);
  assert.throws(() => calculateReservationPricing({ ...input, discountAmount: 9999 }), /desconto/i);
});

test("criança não completa o casal: adulto com criança de 9 paga solteiro mais a regra", () => {
  const withSingle = { ...input, singlePrice: 286, couplePrice: 440, guests: [guest(9, "older")] };
  const pricing = calculateReservationPricing(withSingle);
  assert.equal(pricing.rateType, "single");
  assert.equal(pricing.totalPrice, (286 + 120) * 5);
});

test("o primeiro acompanhante de 12 anos ou mais completa o casal, em qualquer posição", () => {
  const base = { ...input, singlePrice: 286, couplePrice: 440 };
  assert.equal(calculateReservationPricing({ ...base, guests: [guest(13)] }).totalPrice, 440 * 5);
  const mixed = calculateReservationPricing({ ...base, guests: [guest(9, "older"), guest(35)] });
  assert.equal(mixed.rateType, "couple");
  assert.equal(mixed.totalPrice, (440 + 120) * 5);
  assert.throws(() => calculateReservationPricing({ ...base, guests: [guest(9)] }), /regra de preço/i);
});
