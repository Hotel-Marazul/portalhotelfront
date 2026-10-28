"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import apiClient from "../../services/api";
import { useCachedFetch } from "../../hooks/useCachedFetch";
import { displayNameFromEmail, useCurrentUser } from "../../hooks/useCurrentUser";
import { formatHotelDateTime, greetingFor, useHotelNow } from "../../hooks/useHotelNow";
import type { ReservationDto, ReservationsResponse } from "../../types/reservations";
import type { QueueResponse } from "../../types/whatsapp";
import { apiErrorMessage } from "../../utils/api-error";
import { formatCurrency } from "../../utils/format";
import { addReservationCalendarDays, formatReservationCalendarDate } from "../../utils/reservation";
import { CommandBarTrigger } from "../../components/command/CommandBar";
import RoomsNow, { type RoomSummary } from "../../components/today/RoomsNow";
import TodayMovement, { type MovementList } from "../../components/today/TodayMovement";
import TodoList from "../../components/today/TodoList";
import { arrivalsInUnreadyRooms, buildTodoItems, indicatorState, movementCounts, type IndicatorState } from "../../components/today/today-data";
import { housekeepingOf, type HousekeepingStatus } from "../../components/quartos/housekeeping";
import { isMaintenance } from "../../components/quartos/rooms-data";
import type { Room } from "../../utils/models";
import { buttonClasses } from "../../components/ui/Button";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import { Kpi, KpiRow, type KpiStatus } from "../../components/ui/Kpi";
import { toast } from "../../components/ui/Toast";

interface CounterSummary {
  pendenciasVencidas: number;
}

const NOT_CANCELLED = "Pendente,Confirmada,EmAndamento,Concluída";

const kpiStatus = (state: IndicatorState<unknown>): KpiStatus => (state.kind === "ready" ? "ready" : state.kind);

function movementList(fetch: { loading: boolean; error: string | null; data: ReservationsResponse | null }): MovementList {
  const state = indicatorState(fetch);
  return state.kind === "ready" ? { status: "ready", items: state.data.items } : { status: state.kind, items: [] };
}

export default function TodayPage() {
  const now = useHotelNow();
  const { user } = useCurrentUser();
  const today = formatReservationCalendarDate(new Date());
  const tomorrow = formatReservationCalendarDate(addReservationCalendarDays(today, 1));

  const counter = useCachedFetch<CounterSummary>("/api/reservations/counter-summary", { cacheKey: "hoje:counter" });
  const rooms = useCachedFetch<RoomSummary>(`/api/rooms/summary?checkIn=${today}&checkOut=${tomorrow}`, { cacheKey: "hoje:rooms" });
  const arrivals = useCachedFetch<ReservationsResponse>(`/api/reservations?checkInFrom=${today}&checkInTo=${today}&status=${NOT_CANCELLED}&pageSize=100`, { cacheKey: "hoje:arrivals" });
  const departures = useCachedFetch<ReservationsResponse>(`/api/reservations?checkOutFrom=${today}&checkOutTo=${today}&status=${NOT_CANCELLED}&pageSize=100`, { cacheKey: "hoje:departures" });
  const staying = useCachedFetch<ReservationsResponse>("/api/reservations?status=EmAndamento&pageSize=100", { cacheKey: "hoje:staying" });
  // Limpeza por quarto para as chegadas; sem essa lista, as chegadas mostram a categoria como antes.
  const roomList = useCachedFetch<Room[]>("/api/rooms", { cacheKey: "hoje:roomList" });
  const waiting = useCachedFetch<{ waiting: number }>("/api/whatsapp/queue/count", { cacheKey: "hoje:waiting" });
  const queue = useCachedFetch<QueueResponse>("/api/whatsapp/queue", { cacheKey: "hoje:queue" });

  const [busyId, setBusyId] = useState<string | null>(null);
  const [checkoutWithBalance, setCheckoutWithBalance] = useState<{ reservation: ReservationDto; balance: number } | null>(null);

  const lists = { arrivals: movementList(arrivals), departures: movementList(departures), staying: movementList(staying) };
  const counts = movementCounts({ arrivals: lists.arrivals.items, departures: lists.departures.items, staying: lists.staying.items });
  const waitingState = indicatorState(waiting);
  const roomsState = indicatorState(rooms);
  const counterState = indicatorState(counter);
  const queueState = indicatorState(queue);

  const cleaning = useMemo(() => {
    const map: Record<string, HousekeepingStatus> = {};
    for (const room of roomList.data ?? []) {
      const state = housekeepingOf(room, isMaintenance(room));
      if (state) map[room.id] = state;
    }
    return map;
  }, [roomList.data]);

  const todo = buildTodoItems({
    unreadyArrivals: roomList.data && lists.arrivals.status === "ready" ? arrivalsInUnreadyRooms(lists.arrivals.items, cleaning) : null,
    overdue: counterState.kind === "ready" ? counterState.data.pendenciasVencidas : null,
    urgentConversations: queueState.kind === "ready" ? queueState.data.waiting.filter((item) => item.level === "agora").length : null,
    maintenanceRooms: roomsState.kind === "ready" ? roomsState.data.manutencao : null,
  });

  // Check-in e check-out mudam as três listas; o check-out também deixa o quarto "a limpar".
  const refreshMovement = () => {
    arrivals.refetch();
    departures.refetch();
    staying.refetch();
    roomList.refetch();
    rooms.refetch();
  };

  async function transition(reservation: ReservationDto, targetStatus: "EmAndamento" | "Concluída", version = reservation.version) {
    const name = reservation.client?.fullName ?? reservation.client?.name ?? "hóspede";
    setBusyId(reservation.id);
    try {
      await apiClient.post(`/api/reservations/${reservation.id}/transitions`, { targetStatus, version, idempotencyKey: crypto.randomUUID() });
      toast.success(targetStatus === "EmAndamento" ? `Check-in de ${name} feito.` : `Check-out de ${name} feito.`);
      refreshMovement();
    } catch (error) {
      toast.error(apiErrorMessage(error, targetStatus === "EmAndamento" ? "Não foi possível fazer o check-in." : "Não foi possível fazer o check-out."));
    } finally {
      setBusyId(null);
    }
  }

  // Antes do check-out, confere o saldo: concluir com saldo pede confirmação e não apaga o que falta receber.
  async function handleCheckOut(reservation: ReservationDto) {
    setBusyId(reservation.id);
    try {
      const { data } = await apiClient.get<ReservationDto>(`/api/reservations/${reservation.id}`);
      if ((data.balanceDue ?? 0) > 0) {
        setBusyId(null);
        setCheckoutWithBalance({ reservation: data, balance: data.balanceDue ?? 0 });
        return;
      }
      await transition(data, "Concluída", data.version);
    } catch (error) {
      setBusyId(null);
      toast.error(apiErrorMessage(error, "Não foi possível conferir o saldo da reserva."));
    }
  }

  const firstName = user ? displayNameFromEmail(user.email).split(" ")[0] : "";

  return (
    <div className="flex flex-col gap-6 px-5 py-6 min-[900px]:min-h-0 min-[900px]:flex-1 min-[900px]:px-9 min-[900px]:py-7">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col gap-0.5">
          <h1 className="m-0 text-[22px] font-semibold tracking-[-0.02em]">
            {now ? `${greetingFor(now)}${firstName ? `, ${firstName}` : ""}` : "Hoje"}
          </h1>
          <span className="min-h-5 text-fg-3">{now ? formatHotelDateTime(now) : ""}</span>
        </div>
        <Link href="/reservas?nova=1" className={buttonClasses("primary")}>
          <Plus aria-hidden="true" />
          Nova reserva
        </Link>
      </header>

      <CommandBarTrigger className="shrink-0" />

      <KpiRow>
        <Kpi label="Chegadas" status={lists.arrivals.status} value={counts.arrivals} note={counts.arrived ? `${counts.arrived} já ${counts.arrived === 1 ? "entrou" : "entraram"}` : undefined} />
        <Kpi label="Saídas" status={lists.departures.status} value={counts.departures} note={counts.departed ? `${counts.departed} ${counts.departed === 1 ? "feita" : "feitas"}` : undefined} />
        <Kpi label="Hospedados" status={lists.staying.status} value={counts.staying} note={counts.staying ? `${counts.people} ${counts.people === 1 ? "pessoa" : "pessoas"}` : undefined} />
        <Kpi label="Conversas aguardando" status={kpiStatus(waitingState)} value={waitingState.kind === "ready" ? waitingState.data.waiting : null} />
      </KpiRow>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-10 min-[900px]:min-h-0 min-[900px]:flex-1 min-[1100px]:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <TodayMovement lists={lists} busyId={busyId} onCheckIn={(reservation) => void transition(reservation, "EmAndamento")} onCheckOut={(reservation) => void handleCheckOut(reservation)} cleaning={cleaning} />
        <div className="flex min-h-0 min-w-0 flex-col gap-7">
          <RoomsNow status={kpiStatus(roomsState)} summary={roomsState.kind === "ready" ? roomsState.data : null} />
          <TodoList items={todo} loading={counter.loading || rooms.loading || queue.loading} />
        </div>
      </div>

      <ConfirmDialog
        open={!!checkoutWithBalance}
        onOpenChange={(open) => { if (!open) setCheckoutWithBalance(null); }}
        title="Concluir com saldo em aberto?"
        description={checkoutWithBalance
          ? `Ainda faltam ${formatCurrency(checkoutWithBalance.balance)} desta hospedagem. Concluir não apaga o saldo: ele continua a receber na reserva.`
          : ""}
        confirmLabel="Concluir hospedagem"
        busy={!!checkoutWithBalance && busyId === checkoutWithBalance.reservation.id}
        onConfirm={() => {
          if (!checkoutWithBalance) return;
          const { reservation } = checkoutWithBalance;
          void transition(reservation, "Concluída", reservation.version).finally(() => setCheckoutWithBalance(null));
        }}
      />
    </div>
  );
}
