// Regras puras da tela de Quartos, testadas em tests/quartos-data.test.mjs.
// `today` sempre chega de fora como AAAA-MM-DD, na data civil do hotel.

import { formatDayMonth } from "../../utils/format.ts";
import { addReservationCalendarDays, formatReservationCalendarDate, toReservationCalendarDate } from "../../utils/reservation.ts";
import { normalizeOperationalRoomStatus } from "../../utils/roomStatus.ts";

export interface RoomLike {
  id: string;
  number: number;
  displayNumber?: string;
  connectedRoomNumber?: number | null;
  type: string;
  categoryId: string;
  status: string;
}

export interface ReservationLike {
  id: string;
  roomId: string;
  status: string;
  checkInDate: string;
  checkOutDate: string;
  client?: { name?: string; fullName?: string } | null;
}

export type RoomTodayKind = "maintenance" | "staying" | "leaving" | "arriving" | "awaiting" | "free";
export type RoomFilter = "todos" | "livres" | "ocupados" | "manutencao";

export interface RoomToday {
  kind: RoomTodayKind;
  label: string;
  detail: string;
  staying: boolean;
  arriving: boolean;
}

const BOOKED = new Set(["Pendente", "Confirmada"]);
const UPCOMING = new Set(["Pendente", "Confirmada", "EmAndamento"]);

export const roomLabel = (room: Pick<RoomLike, "number" | "displayNumber">) => room.displayNumber ?? String(room.number);

export const guestName = (reservation: ReservationLike) => reservation.client?.fullName ?? reservation.client?.name ?? "Hóspede";

const day = (value: string) => toReservationCalendarDate(value);

export function isMaintenance(room: Pick<RoomLike, "status">) {
  return normalizeOperationalRoomStatus(room.status) === "Manutencao";
}

/**
 * Situação do quarto hoje. `reservations` traz as hospedagens em andamento
 * (de qualquer data, como no Hoje) e as pendentes ou confirmadas que já começaram.
 * Hospedagem em andamento ocupa o quarto mesmo com a saída vencida.
 */
export function roomToday(room: RoomLike, reservations: ReservationLike[], today: string): RoomToday {
  const mine = reservations.filter((reservation) => reservation.roomId === room.id);
  const stay = mine.find((reservation) => reservation.status === "EmAndamento");
  const arrival = mine.find((reservation) => BOOKED.has(reservation.status) && day(reservation.checkInDate) === today);
  const awaiting = mine.find((reservation) =>
    BOOKED.has(reservation.status) && day(reservation.checkInDate) < today && day(reservation.checkOutDate) > today);
  const flags = { staying: Boolean(stay), arriving: Boolean(arrival) };

  if (isMaintenance(room)) {
    return { kind: "maintenance", label: "Manutenção", detail: arrival ? `${guestName(arrival)} chega hoje` : "Fora da venda", ...flags };
  }
  if (stay) {
    const checkOut = day(stay.checkOutDate);
    if (checkOut <= today) {
      const detail = checkOut < today ? `${guestName(stay)} · saída era ${formatDayMonth(stay.checkOutDate)}` : guestName(stay);
      return { kind: "leaving", label: checkOut < today ? "Saída vencida" : "Sai hoje", detail: arrival ? `${detail} · ${guestName(arrival)} chega` : detail, ...flags };
    }
    return { kind: "staying", label: "Hospedado", detail: `${guestName(stay)} até ${formatDayMonth(stay.checkOutDate)}`, ...flags };
  }
  if (arrival) return { kind: "arriving", label: "Chega hoje", detail: guestName(arrival), ...flags };
  if (awaiting) {
    return { kind: "awaiting", label: "Aguardando chegada", detail: `${guestName(awaiting)} · entrada ${formatDayMonth(awaiting.checkInDate)}`, ...flags };
  }
  return { kind: "free", label: "Livre", detail: "", ...flags };
}

export function summarizeRooms(states: RoomToday[]) {
  return {
    staying: states.filter((state) => state.staying).length,
    arriving: states.filter((state) => state.arriving).length,
    free: states.filter((state) => state.kind === "free").length,
    maintenance: states.filter((state) => state.kind === "maintenance").length,
  };
}

/** Busca pelo número (ou o par conjugado) e pela categoria, como antes. */
export function matchesSearch(room: RoomLike, search: string) {
  const query = search.trim().toLowerCase();
  if (!query) return true;
  return roomLabel(room).toLowerCase().includes(query) || room.type.toLowerCase().includes(query);
}

/** Sem a situação de hoje (rota falhou ou carregando), só "Todos" e "Manutenção" filtram. */
export function matchesFilter(filter: RoomFilter, room: RoomLike, state: RoomToday | null) {
  if (filter === "todos") return true;
  if (filter === "manutencao") return isMaintenance(room);
  if (!state) return false;
  if (filter === "livres") return state.kind === "free";
  return state.kind !== "free" && state.kind !== "maintenance";
}

export function countCategories(rooms: Pick<RoomLike, "categoryId">[]) {
  return new Set(rooms.map((room) => room.categoryId)).size;
}

/** Reservas que ainda não terminaram, da mais próxima para a mais distante. */
export function upcomingReservations<T extends ReservationLike>(reservations: T[], today: string): T[] {
  return reservations
    .filter((reservation) => UPCOMING.has(reservation.status) && (reservation.status === "EmAndamento" || day(reservation.checkOutDate) > today))
    .sort((a, b) => day(a.checkInDate).localeCompare(day(b.checkInDate)) || a.id.localeCompare(b.id));
}

export interface OccupancyDay {
  date: string;
  occupied: boolean;
}

/** Noites ocupadas nos próximos `days` dias: a noite de D conta se a entrada é até D e a saída depois de D. */
export function occupancyWindow(reservations: ReservationLike[], today: string, days = 14) {
  const blocking = reservations.filter((reservation) => UPCOMING.has(reservation.status));
  const window: OccupancyDay[] = Array.from({ length: days }, (_, index) => {
    const date = formatReservationCalendarDate(addReservationCalendarDays(today, index));
    const occupied = blocking.some((reservation) => {
      const checkIn = day(reservation.checkInDate);
      const checkOut = day(reservation.checkOutDate);
      // Hospedagem em andamento com saída vencida ainda ocupa hoje.
      const stillHere = reservation.status === "EmAndamento" && checkOut <= today && date === today;
      return stillHere || (checkIn <= date && checkOut > date);
    });
    return { date, occupied };
  });
  const nights = window.filter((entry) => entry.occupied).length;
  return { days: window, nights, percent: Math.round((nights / days) * 100) };
}

export interface RoomFormValues {
  number: number;
  type: string;
  capacity: number;
  price: number;
  categoryId?: string;
}

/** Mesma checagem do cadastro anterior: nada vazio nem zero. */
export function validateNewRoom(form: RoomFormValues): string | null {
  if (!form.number || !form.type || !form.capacity || !form.price || !form.categoryId) {
    return "Preencha todos os campos antes de continuar.";
  }
  return null;
}

/** Mesma checagem da edição anterior: categoria com preço e capacidade não negativa. */
export function validateRoomUpdate(form: RoomFormValues): string | null {
  if (!form.type?.trim() || form.price == null || form.price <= 0 || form.capacity == null || form.capacity < 0) {
    return "Preencha todos os campos corretamente antes de continuar.";
  }
  return null;
}

/** Número do quarto: só dígitos; vazio vira 0, como antes. */
export function parseRoomNumber(value: string) {
  const parsed = Number(value.replace(/\D/g, ""));
  return Number.isNaN(parsed) ? 0 : parsed;
}
