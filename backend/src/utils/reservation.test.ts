import assert from "node:assert/strict";
import test from "node:test";
import { calculateNights, calculateReservationPricing, formatHotelDate, resolveReservationStayPeriod } from "./reservation.js";

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

test("calcula noites por data civil, inclusive na troca de mês", () => {
  assert.equal(calculateNights("2026-09-04", "2026-09-05"), 1);
  assert.equal(calculateNights("2026-09-04", "2026-09-07"), 3);
  assert.equal(calculateNights("2026-01-31", "2026-02-06"), 6);
  assert.equal(calculateNights("2026-09-04", "2026-09-04"), 0);
});

test("normaliza entrada às 14h e saída ao meio-dia no fuso do hotel para datas sem horário", () => {
  const period = resolveReservationStayPeriod({
    checkInRaw: "2026-09-04",
    checkOutRaw: "2026-09-05",
    requireCheckIn: true
  });

  assert.ok(period);
  assert.equal(formatHotelDate(period.checkInDate), "2026-09-04");
  assert.equal(formatHotelDate(period.checkOutDate), "2026-09-05");
  assert.equal(period.checkInDate.toISOString(), "2026-09-04T17:00:00.000Z");
  assert.equal(period.checkOutDate.toISOString(), "2026-09-05T15:00:00.000Z");
});

test("normaliza timestamps para os horários operacionais do dia civil do hotel", () => {
  const period = resolveReservationStayPeriod({
    checkInRaw: "2026-09-04T03:00:00.000Z",
    checkOutRaw: "2026-09-06T03:00:00.000Z",
    requireCheckIn: true
  });

  assert.ok(period);
  assert.equal(period.checkInDate.toISOString(), "2026-09-04T17:00:00.000Z");
  assert.equal(period.checkOutDate.toISOString(), "2026-09-06T15:00:00.000Z");
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

test("rejeita reserva sem nenhuma tarifa padrão nem override manual", () => {
  assert.throws(
    () =>
      calculateReservationPricing({
        checkInDate: "2026-09-04",
        checkOutDate: "2026-09-05",
        guests: [],
        pricingRules,
        singlePrice: null,
        couplePrice: null,
        legacyDailyPrice: null
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
