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
