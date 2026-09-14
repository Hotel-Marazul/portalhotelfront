const HOTEL_TIMEZONE = process.env.NEXT_PUBLIC_HOTEL_TIMEZONE || "America/Sao_Paulo";
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function hotelDateParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: HOTEL_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  return Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
}

export function formatReservationCalendarDate(date: Date): string {
  if (Number.isNaN(date.getTime())) return "";
  const parts = hotelDateParts(date);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function formatReservationDisplayDate(value: string | Date, options?: Intl.DateTimeFormatOptions): string {
  const date = parseReservationDate(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("pt-BR", { timeZone: HOTEL_TIMEZONE, ...options }).format(date);
}

export function parseReservationDate(value: string | Date): Date {
  if (value instanceof Date) return new Date(value.getTime());

  if (DATE_ONLY_PATTERN.test(value)) {
    const [year, month, day] = value.split("-").map(Number);
    // Meio-dia UTC mantém uma data civil estável ao formatar no fuso do hotel.
    const parsed = new Date(Date.UTC(year, month - 1, day, 12));
    if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) {
      return new Date(Number.NaN);
    }
    return parsed;
  }

  return new Date(value);
}

/** Date representation for native/MUI pickers, which render in the browser's local calendar. */
export function parseReservationPickerDate(value: string | Date): Date {
  if (value instanceof Date) return new Date(value.getTime());
  const calendarDate = DATE_ONLY_PATTERN.test(value)
    ? value
    : formatReservationCalendarDate(new Date(value));
  const [year, month, day] = calendarDate.split("-").map(Number);
  const parsed = new Date(year, month - 1, day, 12);
  return parsed.getFullYear() === year && parsed.getMonth() === month - 1 && parsed.getDate() === day
    ? parsed
    : new Date(Number.NaN);
}

export function formatReservationPickerDate(date: Date): string {
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/** Add calendar days without letting the browser timezone change the hotel date. */
export function addReservationCalendarDays(value: string | Date, days: number): Date {
  const calendarDate = typeof value === "string" && DATE_ONLY_PATTERN.test(value)
    ? value
    : formatReservationCalendarDate(parseReservationDate(value));
  if (!calendarDate || !Number.isInteger(days) || Number.isNaN(parseReservationDate(calendarDate).getTime())) {
    return new Date(Number.NaN);
  }
  const [year, month, day] = calendarDate.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + days, 12));
  return parseReservationDate(
    `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, "0")}-${String(shifted.getUTCDate()).padStart(2, "0")}`
  );
}

export function toReservationCalendarDate(value: string | Date): string {
  if (typeof value === "string" && DATE_ONLY_PATTERN.test(value)) return value;
  const parsed = parseReservationDate(value);
  return Number.isNaN(parsed.getTime()) ? String(value) : formatReservationCalendarDate(parsed);
}

export type ReservationRateType = "single" | "couple";

export function getReservationRateType(totalGuestCount: number): ReservationRateType {
  return totalGuestCount === 1 ? "single" : "couple";
}

export function getSuggestedDailyRate(
  room: { price?: number; singlePrice?: number | null; couplePrice?: number | null } | null | undefined,
  totalGuestCount: number
) {
  if (!room) return null;

  if (getReservationRateType(totalGuestCount) === "single") {
    return room.singlePrice ?? room.couplePrice ?? room.price ?? null;
  }
  return room.couplePrice ?? room.price ?? null;
}
