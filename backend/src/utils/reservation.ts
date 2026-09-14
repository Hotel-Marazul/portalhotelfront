import { PricingRule, ReservationGuest } from "../domain/models.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const INCLUDED_ADDITIONAL_GUESTS = 1;
const HOTEL_CHECK_IN_HOUR = 14;
const HOTEL_CHECK_OUT_HOUR = 12;
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
export const HOTEL_TIMEZONE = process.env.HOTEL_TIMEZONE || "America/Sao_Paulo";

function isDateOnlyInput(value: string) {
  return DATE_ONLY_PATTERN.test(value);
}

function getOffsetMilliseconds(instant: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: HOTEL_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
  }).formatToParts(instant);
  const values = Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  const localAsUtc = Date.UTC(
    Number(values.year), Number(values.month) - 1, Number(values.day),
    Number(values.hour), Number(values.minute), Number(values.second)
  );
  return localAsUtc - instant.getTime();
}

function parseDateOnlyInput(value: string, hour: number) {
  const [year, month, day] = value.split("-").map(Number);
  const sourceAsUtc = Date.UTC(year, month - 1, day, hour, 0, 0, 0);
  let parsed = new Date(sourceAsUtc - getOffsetMilliseconds(new Date(sourceAsUtc)));
  // Re-evaluate the offset at the selected local time to also work on a DST boundary.
  parsed = new Date(sourceAsUtc - getOffsetMilliseconds(parsed));
  if (
    Number.isNaN(parsed.getTime()) ||
    formatHotelDate(parsed) !== value
  ) {
    return null;
  }
  return parsed;
}

export function formatHotelDate(value: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: HOTEL_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(value);
  const entries = Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  return `${entries.year}-${entries.month}-${entries.day}`;
}

/** Convert a civil hotel date to an instant without using the host timezone. */
export function hotelCivilDateToUtc(value: string, hour = 0): Date | null {
  if (!DATE_ONLY_PATTERN.test(value) || !Number.isInteger(hour) || hour < 0 || hour > 23) {
    return null;
  }
  return parseDateOnlyInput(value, hour);
}

export function nextHotelCivilDateToUtc(value: string, hour = 0): Date | null {
  const date = hotelCivilDateToUtc(value, hour);
  return date ? addOneCalendarDay(date, hour) : null;
}

export function hotelDayBounds(now = new Date()) {
  const start = hotelCivilDateToUtc(formatHotelDate(now));
  if (!start) return null;
  const end = nextHotelCivilDateToUtc(formatHotelDate(now));
  return end ? { start, end } : null;
}

function addOneCalendarDay(date: Date, hour: number) {
  const [year, month, day] = formatHotelDate(date).split("-").map(Number);
  const nextCalendarDay = new Date(Date.UTC(year, month - 1, day + 1));
  return parseDateOnlyInput(
    `${nextCalendarDay.getUTCFullYear()}-${String(nextCalendarDay.getUTCMonth() + 1).padStart(2, "0")}-${String(nextCalendarDay.getUTCDate()).padStart(2, "0")}`,
    hour
  )!;
}

function startOfTodayLocal(hour: number) {
  return parseDateOnlyInput(formatHotelDate(new Date()), hour)!;
}

export function normalizeReservationDateInput(value: string, boundary: "checkIn" | "checkOut"): Date | null {
  const parsed = isDateOnlyInput(value) ? null : new Date(value);
  const civilDate = isDateOnlyInput(value)
    ? value
    : parsed && !Number.isNaN(parsed.getTime())
      ? formatHotelDate(parsed)
      : null;
  return civilDate
    ? parseDateOnlyInput(civilDate, boundary === "checkIn" ? HOTEL_CHECK_IN_HOUR : HOTEL_CHECK_OUT_HOUR)
    : null;
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
    checkOutDate ?? addOneCalendarDay(checkInDate, HOTEL_CHECK_OUT_HOUR);

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
    return 0;
  }

  const [startYear, startMonth, startDate] = formatHotelDate(start).split("-").map(Number);
  const [endYear, endMonth, endDate] = formatHotelDate(end).split("-").map(Number);
  const startDay = Date.UTC(startYear, startMonth - 1, startDate);
  const endDay = Date.UTC(endYear, endMonth - 1, endDate);

  return Math.max(0, Math.round((endDay - startDay) / DAY_MS));
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

  const [startYear, startMonth, startDate] = formatHotelDate(start).split("-").map(Number);
  const [endYear, endMonth, endDate] = formatHotelDate(end).split("-").map(Number);
  const startDay = Date.UTC(startYear, startMonth - 1, startDate);
  const endDay = Date.UTC(endYear, endMonth - 1, endDate);
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
      ? input.singlePrice ?? input.couplePrice ?? input.legacyDailyPrice ?? null
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
