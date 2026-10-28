// Montagem de dados da Agenda (mapa e lista), sem React, para testar com node --test.
import { addReservationCalendarDays, formatReservationCalendarDate } from "../../utils/reservation.ts";

export interface AgendaRoomLike {
  id: string;
  number: number;
  displayNumber?: string;
  categoryId: string;
  type: string;
  capacity: number;
  status: string;
}

export interface AgendaRoomGroup<T extends AgendaRoomLike> {
  id: string;
  name: string;
  caption: string;
  rooms: T[];
}

export const roomLabel = (room: Pick<AgendaRoomLike, "number" | "displayNumber">) => room.displayNumber ?? String(room.number);

const people = (count: number) => `${count} ${count === 1 ? "pessoa" : "pessoas"}`;

/**
 * Capacidade da categoria em uma linha: "até 4 pessoas" quando todos os quartos
 * comportam o mesmo; senão a exceção primeiro, como "102 para 2 · demais até 4".
 */
export function categoryCapacityCaption(rooms: AgendaRoomLike[]): string {
  if (rooms.length === 0) return "";
  const frequency = new Map<number, number>();
  for (const room of rooms) frequency.set(room.capacity, (frequency.get(room.capacity) ?? 0) + 1);
  if (frequency.size === 1) return `até ${people(rooms[0].capacity)}`;
  // A capacidade mais comum vira o "demais"; no empate, a maior.
  const [common] = [...frequency.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0];
  const exceptions = rooms
    .filter((room) => room.capacity !== common)
    .map((room) => `${roomLabel(room)} para ${room.capacity}`);
  return `${exceptions.join(" · ")} · demais até ${common}`;
}

/** Quartos agrupados por categoria, na ordem do menor número de quarto de cada uma. */
export function groupRoomsByCategory<T extends AgendaRoomLike>(rooms: T[]): AgendaRoomGroup<T>[] {
  const groups = new Map<string, T[]>();
  for (const room of [...rooms].sort((a, b) => a.number - b.number)) {
    const key = room.categoryId || room.type;
    groups.set(key, [...(groups.get(key) ?? []), room]);
  }
  return [...groups.entries()].map(([id, members]) => ({
    id,
    name: members[0].type,
    caption: categoryCapacityCaption(members),
    rooms: members,
  }));
}

/**
 * Busca da lista: um número que bate com um quarto vira roomId; o resto vai
 * como nome do hóspede (o backend busca só pelo nome).
 */
export function listSearchParams(text: string, rooms: Array<Pick<AgendaRoomLike, "id" | "number" | "displayNumber">>): { search?: string; roomId?: string } {
  const value = text.trim();
  if (!value) return {};
  const roomText = value.replace(/^quarto\s+/i, "");
  if (/^\d+(\/\d+)?$/.test(roomText)) {
    const room = rooms.find((item) => roomLabel(item) === roomText || String(item.number) === roomText);
    if (room) return { roomId: room.id };
  }
  return { search: value };
}

export const LIST_STATUSES = ["Pendente", "Confirmada", "EmAndamento", "Concluída", "Cancelada"] as const;
export type ListStatus = (typeof LIST_STATUSES)[number];

// Concluída e Cancelada começam desligadas.
export const DEFAULT_LIST_STATUSES: ListStatus[] = ["Pendente", "Confirmada", "EmAndamento"];

/** Valor de `status` para o backend, na ordem fixa; null quando nenhum está ligado. */
export function listStatusParam(active: readonly ListStatus[]): string | null {
  const selected = LIST_STATUSES.filter((status) => active.includes(status));
  return selected.length ? selected.join(",") : null;
}

/** Folga buscada antes e depois do período visível: rolar alguns dias não refaz a consulta. */
export const AGENDA_FETCH_BUFFER_DAYS = 14;

export interface AgendaRange {
  /** Primeiro e último dia carregados, AAAA-MM-DD, inclusivos. */
  from: string;
  to: string;
}

const shiftDate = (date: string, amount: number) => formatReservationCalendarDate(addReservationCalendarDays(date, amount));

export function agendaFetchRange(start: string, days: number, buffer = AGENDA_FETCH_BUFFER_DAYS): AgendaRange {
  return { from: shiftDate(start, -buffer), to: shiftDate(start, days - 1 + buffer) };
}

export function agendaRangeCovers(range: AgendaRange | null, start: string, days: number): boolean {
  if (!range) return false;
  return start >= range.from && shiftDate(start, days - 1) <= range.to;
}

/**
 * Converte rolagem lateral (Shift + roda, ou gesto horizontal do trackpad) em dias inteiros.
 * Devolve os dias a andar e o resto acumulado para o próximo evento.
 */
export function wheelToDays(accumulated: number, delta: number, dayWidth: number): { days: number; rest: number } {
  const total = accumulated + delta;
  const days = Math.trunc(total / dayWidth);
  return { days, rest: total - days * dayWidth };
}
