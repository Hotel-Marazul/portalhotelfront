import { PricingRule, ReservationGuest } from "../domain/models.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const INCLUDED_ADDITIONAL_GUESTS = 1;
const HOTEL_CHECK_IN_HOUR = 14;
const HOTEL_CHECK_OUT_HOUR = 12;
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isDateOnlyInput(value: string) {
  return DATE_ONLY_PATTERN.test(value);
}

function parseDateOnlyInput(value: string, hour: number) {
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(year, month - 1, day, hour, 0, 0, 0);
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    return null;
  }
  return parsed;
}

function addOneCalendarDay(date: Date, hour: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + 1);
  next.setHours(hour, 0, 0, 0);
  return next;
}

function startOfTodayLocal(hour: number) {
  const today = new Date();
  today.setHours(hour, 0, 0, 0);
  return today;
}

export function normalizeReservationDateInput(value: string, boundary: "checkIn" | "checkOut"): Date | null {
  if (isDateOnlyInput(value)) {
    return parseDateOnlyInput(value, boundary === "checkIn" ? HOTEL_CHECK_IN_HOUR : HOTEL_CHECK_OUT_HOUR);
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function resolveReservationStayPeriod(params: {
  checkInRaw?: string;
  checkOutRaw?: string;
  requireCheckIn: boolean;
}) {
  const { checkInRaw, checkOutRaw, requireCheckIn } = params;

  if (!checkInRaw && requireCheckIn) {
    return null;
  }

  const checkInDate = checkInRaw
    ? normalizeReservationDateInput(checkInRaw, "checkIn")
    : startOfTodayLocal(HOTEL_CHECK_IN_HOUR);

  if (!checkInDate) {
    return null;
  }

  const checkOutDate = checkOutRaw ? normalizeReservationDateInput(checkOutRaw, "checkOut") : null;
  if (checkOutRaw && !checkOutDate) {
    return null;
  }

  const normalizedCheckOut =
    checkOutDate ??
    (!checkInRaw || isDateOnlyInput(checkInRaw)
      ? addOneCalendarDay(checkInDate, HOTEL_CHECK_OUT_HOUR)
      : new Date(checkInDate.getTime() + DAY_MS));

  if (normalizedCheckOut <= checkInDate) {
    return null;
  }

  return {
    checkInDate,
    checkOutDate: normalizedCheckOut
  };
}

export function calculateNights(checkInDate: string, checkOutDate: string): number {
  const start = normalizeReservationDateInput(checkInDate, "checkIn");
  const end = normalizeReservationDateInput(checkOutDate, "checkOut");

  if (!start || !end) {
    return 1;
  }

  const startDay = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
  const endDay = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate());

  return Math.max(1, Math.round((endDay - startDay) / DAY_MS));
}

export type ReservationRateType = "single" | "couple";
export type ReservationPriceSource = "catalog" | "manual";

export interface ReservationPricingInput {
  checkInDate: string;
  checkOutDate: string;
  guests: ReservationGuest[];
  pricingRules: PricingRule[];
  singlePrice: number | null | undefined;
  couplePrice: number | null | undefined;
  legacyDailyPrice?: number | null;
  dailyRateOverride?: number;
  discountAmount?: number;
}

export interface ReservationPricingResult {
  rateType: ReservationRateType;
  dailyRate: number;
  priceSource: ReservationPriceSource;
  nights: number;
  additionalDailyTotal: number;
  subtotal: number;
  discountAmount: number;
  totalPrice: number;
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function ensureMoney(value: number, label: string, allowZero = false) {
  if (!Number.isFinite(value) || (allowZero ? value < 0 : value <= 0)) {
    throw new Error(`${label} deve ser um valor monetário válido.`);
  }

  return roundMoney(value);
}

function calculateStrictNights(checkInDate: string, checkOutDate: string) {
  const start = normalizeReservationDateInput(checkInDate, "checkIn");
  const end = normalizeReservationDateInput(checkOutDate, "checkOut");

  if (!start || !end) {
    throw new Error("As datas da reserva são inválidas.");
  }

  const startDay = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
  const endDay = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate());
  const nights = Math.round((endDay - startDay) / DAY_MS);

  if (nights <= 0) {
    throw new Error("A reserva deve ter pelo menos uma noite.");
  }

  return nights;
}

function validateGuestPricingRule(
  guest: ReservationGuest,
  pricingRules: PricingRule[],
  isPaidAdditionalGuest: boolean
) {
  if (!guest.pricingRuleId) {
    if (isPaidAdditionalGuest) {
      throw new Error(`Informe a regra de preço do hóspede adicional ${guest.name}.`);
    }
    return null;
  }

  const rule = pricingRules.find((item) => item.id === guest.pricingRuleId);
  if (!rule) {
    throw new Error("A regra de preço informada não existe.");
  }

  if (guest.age < rule.minAge || guest.age > rule.maxAge) {
    throw new Error(`A regra de preço selecionada não é compatível com a idade de ${guest.name}.`);
  }

  return rule;
}

/**
 * Calcula a precificação completa de uma reserva.
 *
 * `guests` contém somente os acompanhantes; o cliente principal é sempre a
 * primeira pessoa. Assim, o primeiro acompanhante completa o casal e os
 * acompanhantes seguintes são adicionais pagos por regra de idade.
 */
export function calculateReservationPricing(input: ReservationPricingInput): ReservationPricingResult {
  const nights = calculateStrictNights(input.checkInDate, input.checkOutDate);
  const totalGuestCount = input.guests.length + 1;
  const rateType: ReservationRateType = totalGuestCount === 1 ? "single" : "couple";
  const catalogDailyRate =
    rateType === "single"
      ? input.singlePrice ?? null
      : input.couplePrice ?? input.legacyDailyPrice ?? null;
  const priceSource: ReservationPriceSource = input.dailyRateOverride === undefined ? "catalog" : "manual";
  const dailyRate = ensureMoney(
    input.dailyRateOverride ?? catalogDailyRate ?? Number.NaN,
    rateType === "single" ? "A tarifa de solteiro" : "A tarifa de casal"
  );

  let additionalDailyTotal = 0;
  for (const [index, guest] of input.guests.entries()) {
    const rule = validateGuestPricingRule(guest, input.pricingRules, index >= INCLUDED_ADDITIONAL_GUESTS);
    if (index >= INCLUDED_ADDITIONAL_GUESTS && rule) {
      additionalDailyTotal += ensureMoney(rule.price, "O preço da regra de idade", true);
    }
  }

  additionalDailyTotal = roundMoney(additionalDailyTotal);
  const subtotal = roundMoney((dailyRate + additionalDailyTotal) * nights);
  const discountAmount = ensureMoney(input.discountAmount ?? 0, "O desconto", true);

  if (discountAmount > subtotal) {
    throw new Error("O desconto não pode ser maior que o subtotal da reserva.");
  }

  return {
    rateType,
    dailyRate,
    priceSource,
    nights,
    additionalDailyTotal,
    subtotal,
    discountAmount,
    totalPrice: roundMoney(subtotal - discountAmount)
  };
}

export function calculateReservationTotal(
  dailyPrice: number,
  checkInDate: string,
  checkOutDate: string,
  guests: ReservationGuest[],
  pricingRules: PricingRule[]
): number {
  return calculateReservationPricing({
    checkInDate,
    checkOutDate,
    guests,
    pricingRules,
    singlePrice: dailyPrice,
    couplePrice: dailyPrice
  }).totalPrice;
}
