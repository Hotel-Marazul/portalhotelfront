// Brechas e encaixes da Agenda (add-agenda-gap-fitting). Testado em tests/agenda-gaps.test.mjs.
import { getTimelineOffsets } from "../clientes/timeline-layout.ts";
import { toReservationCalendarDate } from "../../utils/reservation.ts";

export const MAX_GAP_NIGHTS = 4;

export interface GapRoom {
  id: string;
  number: number;
  displayNumber?: string;
  capacity: number;
  categoryId: string;
  type: string;
  /** "Manutencao" já normalizado vira ocupação de hoje em diante. */
  maintenance: boolean;
}

export interface GapReservation {
  id: string;
  roomId: string;
  room?: { id?: string } | null;
  checkInDate: string;
  checkOutDate: string;
  status: string;
  guests?: unknown[] | null;
  client?: { fullName?: string; name?: string } | null;
}

export type GapNeighbor = { kind: "reservation"; reservation: GapReservation } | { kind: "maintenance" };

export interface Gap<R extends GapReservation = GapReservation> {
  id: string;
  roomId: string;
  /** Dias em relação ao início do período: saída de quem está antes e entrada de quem vem depois. */
  start: number;
  end: number;
  nights: number;
  before: GapNeighbor;
  after: GapNeighbor;
  candidates: R[];
}

const roomOf = (reservation: GapReservation) => reservation.room?.id || reservation.roomId;
const people = (reservation: GapReservation) => 1 + (reservation.guests?.length ?? 0);
const movable = (status: string) => status === "Pendente" || status === "Confirmada";

interface Occupation<R> { start: number; end: number; neighbor: GapNeighbor; reservation?: R }

/**
 * Brechas de 1 a 4 noites entre duas ocupações do mesmo quarto, inteiras no período,
 * com as reservas de outros quartos que cabem nelas (mesmas datas primeiro).
 */
export function findGaps<R extends GapReservation>(
  rooms: GapRoom[],
  reservations: R[],
  periodStart: string,
  days: number,
  todayOffset: number | null,
): Gap<R>[] {
  const byId = new Map(rooms.map((room) => [room.id, room]));
  const placed = reservations.flatMap((reservation) => {
    const offsets = getTimelineOffsets(reservation.checkInDate, reservation.checkOutDate, periodStart);
    return offsets ? [{ reservation, ...offsets }] : [];
  });

  const gaps: Gap<R>[] = [];
  for (const room of rooms) {
    const occupations: Occupation<R>[] = placed
      .filter((item) => roomOf(item.reservation) === room.id)
      .map((item) => ({ start: item.start, end: item.end, neighbor: { kind: "reservation", reservation: item.reservation }, reservation: item.reservation }));
    if (room.maintenance && todayOffset !== null) {
      occupations.push({ start: todayOffset, end: Number.POSITIVE_INFINITY, neighbor: { kind: "maintenance" } });
    }
    occupations.sort((a, b) => a.start - b.start || a.end - b.end);

    for (let index = 0; index < occupations.length - 1; index += 1) {
      const start = occupations[index].end;
      const end = occupations[index + 1].start;
      const nights = end - start;
      if (nights < 1 || nights > MAX_GAP_NIGHTS || start < 0 || end > days) continue;
      // Uma ocupação que ainda vai além desta não deixa brecha (sobreposição antiga no mapa).
      if (occupations.slice(0, index).some((other) => other.end > start)) continue;

      const candidates = placed
        .filter(({ reservation, start: s, end: e }) => {
          const origin = byId.get(roomOf(reservation));
          if (!origin || origin.id === room.id || !movable(reservation.status)) return false;
          if (s < start || e > end || people(reservation) > room.capacity) return false;
          return (s === start && e === end) || origin.capacity > room.capacity;
        })
        .sort((a, b) => Number(b.start === start && b.end === end) - Number(a.start === start && a.end === end))
        .map(({ reservation }) => reservation);

      gaps.push({
        id: `${room.id}:${start}`,
        roomId: room.id,
        start,
        end,
        nights,
        before: occupations[index].neighbor,
        after: occupations[index + 1].neighbor,
        candidates,
      });
    }
  }
  return gaps;
}

export function gapSummary(gaps: Gap[]): string {
  const fits = gaps.filter((gap) => gap.candidates.length > 0).length;
  return `${gaps.length} · ${fits} ${fits === 1 ? "encaixe" : "encaixes"}`;
}

export interface MoveDetail {
  roomId: string;
  clientId: string;
  checkInDate: string;
  checkOutDate: string;
  version: number;
  guests: Array<{ name: string; age: number | null; pricingRuleId?: string | null }>;
  pricing?: { mealPlan?: "breakfast" | "half_board"; dailyRate: number; priceSource: "catalog" | "manual"; discountAmount: number; overrideReason?: string } | null;
}

/**
 * Corpo do PUT que só troca o quarto. Em outra categoria, a diária reservada vira
 * diária manual com o motivo da troca: o hóspede não paga diferente por um encaixe.
 */
export function buildMovePayload(
  detail: MoveDetail,
  target: { id: string; categoryId: string; label: string },
  origin: { categoryId: string; label: string },
) {
  const pricing = detail.pricing;
  const keepRate = Boolean(pricing) && (origin.categoryId !== target.categoryId || pricing!.priceSource === "manual");
  const discount = pricing?.discountAmount ?? 0;
  const reason = pricing?.overrideReason?.trim()
    || (keepRate || discount > 0 ? `Diária reservada mantida na troca do quarto ${origin.label} para o ${target.label}.` : undefined);

  return {
    roomId: target.id,
    clientId: detail.clientId,
    checkInDate: toReservationCalendarDate(detail.checkInDate),
    checkOutDate: toReservationCalendarDate(detail.checkOutDate),
    version: detail.version,
    mealPlan: pricing?.mealPlan ?? "breakfast",
    guests: detail.guests.map((guest) => ({ name: guest.name, age: guest.age, pricingRuleId: guest.pricingRuleId ?? null })),
    ...(keepRate ? { dailyRateOverride: pricing!.dailyRate } : {}),
    ...(discount > 0 ? { discountAmount: discount } : {}),
    ...(reason ? { priceOverrideReason: reason } : {}),
  };
}
