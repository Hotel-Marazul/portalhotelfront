export function formatReservationCalendarDate(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function parseReservationDate(value: string | Date): Date {
  if (value instanceof Date) {
    return new Date(value.getTime());
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-").map(Number);
    const parsed = new Date(year, month - 1, day);

    if (
      parsed.getFullYear() !== year ||
      parsed.getMonth() !== month - 1 ||
      parsed.getDate() !== day
    ) {
      return new Date(Number.NaN);
    }

    return parsed;
  }

  return new Date(value);
}

export function toReservationCalendarDate(value: string | Date): string {
  if (value instanceof Date) {
    return formatReservationCalendarDate(value);
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  const parsed = parseReservationDate(value);
  return Number.isNaN(parsed.getTime()) ? value : formatReservationCalendarDate(parsed);
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
    return room.singlePrice ?? null;
  }

  return room.couplePrice ?? room.price ?? null;
}
