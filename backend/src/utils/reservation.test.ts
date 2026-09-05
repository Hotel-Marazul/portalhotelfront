import assert from "node:assert/strict";
import test from "node:test";
import { calculateNights, calculateReservationPricing, resolveReservationStayPeriod } from "./reservation.js";

const pricingRules = [
  {
    id: "00000000-0000-0000-0000-000000000001",
    name: "Crianca",
    description: "Criancas de 0 a 11 anos",
    minAge: 0,
    maxAge: 11,
    price: 45
  }
];

test("calcula uma noite para datas de calendário consecutivas", () => {
  assert.equal(calculateNights("2026-09-04", "2026-09-05"), 1);
  assert.equal(calculateNights("2026-09-04", "2026-09-07"), 3);
});

test("normaliza entrada às 14h e saída ao meio-dia para datas sem horário", () => {
  const period = resolveReservationStayPeriod({
    checkInRaw: "2026-09-04",
    checkOutRaw: "2026-09-05",
    requireCheckIn: true
  });

  assert.ok(period);
  assert.equal(period.checkInDate.getHours(), 14);
  assert.equal(period.checkOutDate.getHours(), 12);
});

test("usa tarifa de solteiro para uma pessoa e de casal para duas", () => {
  const single = calculateReservationPricing({
    checkInDate: "2026-09-04",
    checkOutDate: "2026-09-05",
    guests: [],
    pricingRules,
    singlePrice: 120,
    couplePrice: 180
  });
  const couple = calculateReservationPricing({
    checkInDate: "2026-09-04",
    checkOutDate: "2026-09-05",
    guests: [{ id: "guest-1", reservationId: "", name: "Acompanhante", age: 35, pricingRuleId: null }],
    pricingRules,
    singlePrice: 120,
    couplePrice: 180
  });

  assert.deepEqual(single, {
    rateType: "single",
    dailyRate: 120,
    priceSource: "catalog",
    nights: 1,
    additionalDailyTotal: 0,
    subtotal: 120,
    discountAmount: 0,
    totalPrice: 120
  });
  assert.equal(couple.rateType, "couple");
  assert.equal(couple.totalPrice, 180);
});

test("cobra regras de idade somente a partir da terceira pessoa", () => {
  const pricing = calculateReservationPricing({
    checkInDate: "2026-09-04",
    checkOutDate: "2026-09-06",
    guests: [
      { id: "guest-1", reservationId: "", name: "Segundo", age: 35, pricingRuleId: null },
      {
        id: "guest-2",
        reservationId: "",
        name: "Crianca",
        age: 8,
        pricingRuleId: pricingRules[0].id
      }
    ],
    pricingRules,
    singlePrice: 120,
    couplePrice: 180
  });

  assert.equal(pricing.additionalDailyTotal, 45);
  assert.equal(pricing.nights, 2);
  assert.equal(pricing.subtotal, 450);
  assert.equal(pricing.totalPrice, 450);
});

test("permite diária manual e desconto sem aceitar total calculado pelo cliente", () => {
  const pricing = calculateReservationPricing({
    checkInDate: "2026-09-04",
    checkOutDate: "2026-09-06",
    guests: [],
    pricingRules,
    singlePrice: null,
    couplePrice: 180,
    dailyRateOverride: 150,
    discountAmount: 20
  });

  assert.equal(pricing.priceSource, "manual");
  assert.equal(pricing.rateType, "single");
  assert.equal(pricing.subtotal, 300);
  assert.equal(pricing.totalPrice, 280);
});

test("rejeita solteiro sem tarifa padrão nem override manual", () => {
  assert.throws(
    () =>
      calculateReservationPricing({
        checkInDate: "2026-09-04",
        checkOutDate: "2026-09-05",
        guests: [],
        pricingRules,
        singlePrice: null,
        couplePrice: 180
      }),
    /tarifa de solteiro/i
  );
});

test("rejeita adicional pago sem regra de idade", () => {
  assert.throws(
    () =>
      calculateReservationPricing({
        checkInDate: "2026-09-04",
        checkOutDate: "2026-09-05",
        guests: [
          { id: "guest-1", reservationId: "", name: "Segundo", age: 35, pricingRuleId: null },
          { id: "guest-2", reservationId: "", name: "Terceiro", age: 35, pricingRuleId: null }
        ],
        pricingRules,
        singlePrice: 120,
        couplePrice: 180
      }),
    /regra de preço/i
  );
});
