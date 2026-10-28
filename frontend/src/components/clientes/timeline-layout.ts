import { toReservationCalendarDate } from "../../utils/reservation.ts";

/** Calendar-day coordinates, independent of timezone or daylight-saving shifts. */
function calendarDay(value: string): number {
  const calendarDate = toReservationCalendarDate(value);
  return Date.parse(`${calendarDate}T00:00:00Z`) / 86_400_000;
}

export function getTimelineRange(checkIn: string, checkOut: string, periodStart: string, days: number) {
  const origin = calendarDay(periodStart);
  const start = Math.max(0, calendarDay(checkIn) - origin);
  const end = Math.min(days, calendarDay(checkOut) - origin);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
  return { start, end };
}

/** Separate overlapping historical/cancelled records without hiding another stay. */
export function assignTimelineLanes<T extends { start: number; end: number }>(items: T[]) {
  const ends: number[] = [];
  return [...items].sort((a, b) => a.start - b.start || a.end - b.end).map(item => {
    let lane = ends.findIndex(end => end <= item.start);
    if (lane === -1) lane = ends.length;
    ends[lane] = item.end;
    return { ...item, lane };
  });
}

/** Dias de entrada e saída em relação ao início do período, sem recorte. */
export function getTimelineOffsets(checkIn: string, checkOut: string, periodStart: string) {
  const origin = calendarDay(periodStart);
  const start = calendarDay(checkIn) - origin;
  const end = calendarDay(checkOut) - origin;
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
  return { start, end };
}

export interface TimelineBarPosition {
  left: number;
  right: number;
  /** O lado encosta na borda do período: o canto fica reto. */
  flatLeft: boolean;
  flatRight: boolean;
}

/**
 * Do meio do dia de entrada ao meio do dia de saída, com 1 px de folga de cada
 * lado: saída e entrada no mesmo dia ficam a 2 px uma da outra.
 */
export function getTimelineBarPosition(start: number, end: number, days: number, dayWidth: number): TimelineBarPosition | null {
  const rawLeft = (start + 0.5) * dayWidth;
  const rawRight = (end + 0.5) * dayWidth;
  const width = days * dayWidth;
  const flatLeft = rawLeft < 0;
  const flatRight = rawRight > width;
  const left = flatLeft ? 0 : rawLeft + 1;
  const right = flatRight ? width : rawRight - 1;
  if (right <= left) return null;
  return { left, right, flatLeft, flatRight };
}
