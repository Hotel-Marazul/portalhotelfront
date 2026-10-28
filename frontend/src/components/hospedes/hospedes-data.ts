// Regras puras da tela Hóspedes, testadas em tests/hospedes-data.test.mjs.
import { calculateNights, formatDayMonth } from "../../utils/format.ts";

/** Reserva como vem embutida em `GET /api/client` (`reservations` de cada cliente). */
export interface GuestStay {
  id: string;
  status: string;
  checkInDate: string;
  checkOutDate: string;
  totalPrice: number;
  room?: {
    id: string;
    roomNumber: number;
    status: string;
    categoryName: string;
    categoryPrice: number;
  };
  guests?: Array<{
    id: string;
    name: string;
    age: number;
    pricingRuleDescription: string;
    pricingRulePrice: number;
  }>;
}

export interface GuestClient {
  id: string;
  fullName: string;
  cpf: string;
  email: string;
  fone: string;
  automovel: string;
  placa: string;
  reservations?: GuestStay[];
}

export type SituationTone = "staying" | "arriving" | "late" | "future" | "none";

const dateOnly = (value: string) => value.slice(0, 10);
const isCancelled = (status: string) => status === "Cancelada";
const isDone = (status: string) => status === "Concluída" || status === "Concluida";
const isStaying = (status: string) => status === "EmAndamento";
const isOpen = (status: string) => !isCancelled(status) && !isDone(status);

const byCheckIn = (a: GuestStay, b: GuestStay) =>
  dateOnly(a.checkInDate).localeCompare(dateOnly(b.checkInDate)) || a.id.localeCompare(b.id);

export function roomLabel(stay: GuestStay): string {
  return stay.room ? String(stay.room.roomNumber) : "—";
}

/**
 * Estadia atual: a hospedagem em andamento ou, sem ela, a próxima reserva em aberto.
 * Próximas: as outras reservas em aberto que ainda não terminaram.
 * Histórico: concluídas, canceladas e reservas que passaram da saída sem andamento, mais recentes primeiro.
 */
export function splitStays(reservations: GuestStay[] | undefined, today: string) {
  const all = [...(reservations ?? [])].sort(byCheckIn);
  const ahead = all.filter((stay) => isStaying(stay.status) || (isOpen(stay.status) && dateOnly(stay.checkOutDate) > today));
  const current = ahead.find((stay) => isStaying(stay.status)) ?? ahead[0] ?? null;
  const upcoming = ahead.filter((stay) => stay !== current);
  const history = all.filter((stay) => !ahead.includes(stay)).reverse();
  return { current, upcoming, history };
}

/** Estadias, noites e total contam só o que já aconteceu ou está acontecendo. */
export function stayTotals(reservations: GuestStay[] | undefined) {
  const lived = (reservations ?? []).filter((stay) => isDone(stay.status) || isStaying(stay.status));
  return {
    stays: lived.length,
    nights: lived.reduce((sum, stay) => sum + calculateNights(dateOnly(stay.checkInDate), dateOnly(stay.checkOutDate)), 0),
    total: lived.reduce((sum, stay) => sum + (Number(stay.totalPrice) || 0), 0),
  };
}

/** Situação de hoje na lista, a partir da estadia atual. */
export function guestSituation(reservations: GuestStay[] | undefined, today: string): { tone: SituationTone; label: string } {
  const { current } = splitStays(reservations, today);
  if (!current) return { tone: "none", label: "Sem reserva" };
  const room = roomLabel(current);
  const checkIn = dateOnly(current.checkInDate);
  if (isStaying(current.status)) return { tone: "staying", label: `No quarto ${room}` };
  if (checkIn === today) return { tone: "arriving", label: `Chega hoje · ${room}` };
  if (checkIn < today) return { tone: "late", label: `Entrada pendente · ${room}` };
  return { tone: "future", label: `Reserva em ${formatDayMonth(checkIn)}` };
}

/** Rótulo do bloco da estadia atual na ficha. */
export function currentStayLabel(stay: GuestStay, today: string): string {
  const checkIn = dateOnly(stay.checkInDate);
  if (isStaying(stay.status)) return dateOnly(stay.checkOutDate) === today ? "Hospedagem · saída hoje" : "Hospedagem em andamento";
  if (checkIn === today) return "Chega hoje";
  if (checkIn < today) return `Entrada pendente desde ${formatDayMonth(checkIn)}`;
  return "Próxima estadia";
}

/** O primeiro hóspede é o cliente; `guests` traz só os acompanhantes. */
export function stayPeople(stay: GuestStay): number {
  return 1 + (stay.guests?.length ?? 0);
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0][0];
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return `${first}${last}`.toUpperCase();
}

export function vehicleLabel(client: Pick<GuestClient, "automovel" | "placa">): string {
  return [client.automovel?.trim(), client.placa?.trim()].filter(Boolean).join(" · ") || "—";
}

/** "1–20 de 1.284" no rodapé da lista. */
export function pageRangeLabel(page: number, pageSize: number, total: number): string {
  if (total === 0) return "0 de 0";
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);
  const fmt = (value: number) => value.toLocaleString("pt-BR");
  return `${fmt(start)}–${fmt(end)} de ${fmt(total)}`;
}
