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
  return Number.isNaN(parsed.getTime()) ? null : parsed;
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

export function calculateReservationTotal(
  dailyPrice: number,
  checkInDate: string,
  checkOutDate: string,
  guests: ReservationGuest[],
  pricingRules: PricingRule[]
): number {
  const nights = calculateNights(checkInDate, checkOutDate);
  const base = dailyPrice * nights;

  const extras = guests.reduce((acc, guest, index) => {
    if (index < INCLUDED_ADDITIONAL_GUESTS || !guest.pricingRuleId) {
      return acc;
    }
    const rule = pricingRules.find((item) => item.id === guest.pricingRuleId);
    if (!rule) {
      return acc;
    }
    return acc + rule.price * nights;
  }, 0);

  return Number((base + extras).toFixed(2));
}
