// Regras puras do Hoje, testadas em tests/today-data.test.mjs.

interface ReservationLike {
  status: string;
  guests?: unknown[] | null;
  roomId?: string;
  room?: { id?: string } | null;
}

export type MovementTab = "arrivals" | "departures" | "staying";
export type RowAction = "checkin" | "checkout" | "open";

const isDone = (status: string) => status === "Concluída" || status === "Concluida";

/** O primeiro hóspede é o cliente; `guests` traz só os acompanhantes. */
export function reservationPeople(reservation: ReservationLike): number {
  return 1 + (reservation.guests?.length ?? 0);
}

export function movementCounts({ arrivals, departures, staying }: Record<MovementTab, ReservationLike[]>) {
  return {
    arrivals: arrivals.length,
    arrived: arrivals.filter((r) => r.status === "EmAndamento" || isDone(r.status)).length,
    departures: departures.length,
    departed: departures.filter((r) => isDone(r.status)).length,
    staying: staying.length,
    people: staying.reduce((sum, r) => sum + reservationPeople(r), 0),
  };
}

/** Check-in só de reserva confirmada e check-out só de hospedagem em andamento; o resto abre a reserva. */
export function nextAction(tab: MovementTab, status: string): RowAction {
  if (tab === "arrivals" && status === "Confirmada") return "checkin";
  if (tab === "departures" && status === "EmAndamento") return "checkout";
  return "open";
}

const roomIdOf = (reservation: ReservationLike) => reservation.room?.id ?? reservation.roomId;

/** Chegadas de hoje que ainda não entraram e cujo quarto não está pronto. Limpeza desconhecida não conta. */
export function arrivalsInUnreadyRooms(arrivals: ReservationLike[], cleaning: Record<string, string>): number {
  return arrivals.filter((reservation) => {
    if (reservation.status !== "Pendente" && reservation.status !== "Confirmada") return false;
    const id = roomIdOf(reservation);
    const state = id ? cleaning[id] : undefined;
    return state !== undefined && state !== "limpo";
  }).length;
}

export type IndicatorState<T> = { kind: "loading" } | { kind: "error" } | { kind: "ready"; data: T };

/** Indicador sem dado não aparece como zero: falha vira erro daquela parte. */
export function indicatorState<T>({ loading, error, data }: { loading: boolean; error: string | null; data: T | null }): IndicatorState<T> {
  if (error) return { kind: "error" };
  if (loading || data === null) return { kind: "loading" };
  return { kind: "ready", data };
}

export interface TodoItem {
  key: string;
  title: string;
  detail: string;
  href: string;
}

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

/**
 * "A fazer" com as fontes que já existem: conversas em nível Agora, chegadas em
 * quarto não pronto, pendências vencidas e quartos em manutenção. `null` é fonte que não carregou: some da lista.
 */
export function buildTodoItems({ overdue, urgentConversations, maintenanceRooms, unreadyArrivals = null }: {
  overdue: number | null;
  urgentConversations: number | null;
  maintenanceRooms: number | null;
  unreadyArrivals?: number | null;
}): TodoItem[] {
  const items: TodoItem[] = [];
  if (urgentConversations) {
    items.push({
      key: "whatsapp",
      title: `${plural(urgentConversations, "conversa", "conversas")} no WhatsApp para responder agora`,
      detail: "Nível Agora na fila",
      href: "/whatsapp",
    });
  }
  if (unreadyArrivals) {
    items.push({
      key: "cleaning",
      title: `${plural(unreadyArrivals, "chegada de hoje", "chegadas de hoje")} com o quarto ainda não pronto`,
      detail: "Marque como pronto em Quartos depois da limpeza",
      href: "/quarto",
    });
  }
  if (overdue) {
    items.push({
      key: "overdue",
      title: `${plural(overdue, "reserva passou", "reservas passaram")} da saída sem fechar`,
      detail: "Pendentes ou confirmadas com a saída já vencida",
      href: "/reservas?vista=lista",
    });
  }
  if (maintenanceRooms) {
    items.push({
      key: "maintenance",
      title: `${plural(maintenanceRooms, "quarto", "quartos")} em manutenção`,
      detail: "Fora da venda até liberar",
      href: "/quarto",
    });
  }
  return items.slice(0, 4);
}
