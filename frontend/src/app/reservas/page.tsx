"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Plus } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import apiClient from "../../services/api";
import type { ReservationDto, ReservationStatus, ReservationsResponse } from "../../types/reservations";
import ReservationDrawer from "../../components/reservations/ReservationDrawer";
import ModalNovaReserva from "../../components/clientes/ModalNovaReserva";
import ReservationTimeline from "../../components/clientes/ReservationTimeline";
import type { TimelineRoom } from "../../components/clientes/TimelineGrid";
import ReservationsFiltersComponent from "../../components/reservations/ReservationsFilters";
import ReservationsTable from "../../components/reservations/ReservationsTable";
import ReservationWorkspaceSwitcher, { type ReservationWorkspaceView } from "../../components/reservations/ReservationWorkspaceSwitcher";
import {
  DEFAULT_LIST_STATUSES,
  LIST_STATUSES,
  listSearchParams,
  listStatusParam,
  type ListStatus,
} from "../../components/agenda/agenda-data";
import Button from "../../components/ui/Button";
import { addReservationCalendarDays, formatReservationCalendarDate } from "../../utils/reservation";
import { useCachedFetch } from "../../hooks/useCachedFetch";
import { usePersistentUiState } from "../../hooks/usePersistentUiState";
import { getIdempotencyAttempt } from "../../utils/idempotency";
import { apiErrorMessage } from "../../utils/api-error";

const AGENDA_PAGE_SIZE = 100;
const LIST_PAGE_SIZE = 50;
// Cancelada não ocupa quarto e fica fora do mapa.
const MAP_STATUSES = "Pendente,Confirmada,EmAndamento,Concluída";

function isWorkspaceView(value: unknown): value is ReservationWorkspaceView {
  return value === "agenda" || value === "lista";
}

function normalizeStatus(status: ReservationStatus): ReservationStatus {
  return status === "Concluida" ? "Concluída" : status;
}

type ListState =
  | { status: "loading"; items: ReservationDto[]; total: number; error: null }
  | { status: "error"; items: ReservationDto[]; total: number; error: string }
  | { status: "ready"; items: ReservationDto[]; total: number; error: null };

function ReservationsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [workspaceView, setWorkspaceView] = usePersistentUiState("agenda:view", "agenda", isWorkspaceView);

  const {
    data: agendaRooms,
    loading: loadingAgendaRooms,
    error: agendaRoomsError,
    refetch: refetchAgendaRooms,
  } = useCachedFetch<TimelineRoom[]>("/api/rooms", {
    cacheKey: "agenda:rooms",
    expiresIn: 5 * 60 * 1000,
  });

  // --- Mapa -----------------------------------------------------------------
  const [agendaReservations, setAgendaReservations] = useState<ReservationsResponse | null>(null);
  const [loadingAgendaReservations, setLoadingAgendaReservations] = useState(true);
  const [agendaReservationsError, setAgendaReservationsError] = useState<string | null>(null);
  const [agendaPeriod, setAgendaPeriod] = useState<{ start: string; days: 7 | 14 } | null>(null);
  const agendaRequestId = useRef(0);
  // Período já carregado: voltar ao Mapa não refaz a consulta.
  const loadedAgendaKey = useRef<string | null>(null);

  const loadAgendaReservations = useCallback(async (periodStart: string, periodDays: 7 | 14) => {
    const requestId = ++agendaRequestId.current;
    const lastVisibleDate = addReservationCalendarDays(periodStart, periodDays - 1);
    const checkInTo = formatReservationCalendarDate(lastVisibleDate);
    if (!checkInTo) {
      setAgendaReservations(null);
      setAgendaReservationsError("Período inválido para a agenda.");
      setLoadingAgendaReservations(false);
      return;
    }

    setLoadingAgendaReservations(true);
    setAgendaReservationsError(null);
    try {
      // checkOutFrom inclusivo: quem sai no primeiro dia aparece na metade da manhã.
      const params = { limit: AGENDA_PAGE_SIZE, checkInTo, checkOutFrom: periodStart, status: MAP_STATUSES };
      const firstResponse = await apiClient.get<ReservationsResponse>("/api/reservations", { params: { ...params, page: 1 } });
      const total = typeof firstResponse.data.total === "number" ? firstResponse.data.total : firstResponse.data.items.length;
      const items = [...(firstResponse.data.items ?? [])];
      const pageCount = Math.ceil(total / AGENDA_PAGE_SIZE);
      for (let currentPage = 2; currentPage <= pageCount; currentPage += 1) {
        const response = await apiClient.get<ReservationsResponse>("/api/reservations", { params: { ...params, page: currentPage } });
        items.push(...(response.data.items ?? []));
      }
      if (requestId !== agendaRequestId.current) return;
      setAgendaReservations({ items, total, page: 1, pageSize: AGENDA_PAGE_SIZE });
      loadedAgendaKey.current = `${periodStart}|${periodDays}`;
    } catch (requestError) {
      if (requestId !== agendaRequestId.current) return;
      setAgendaReservations(null);
      setAgendaReservationsError(apiErrorMessage(requestError, "Não foi possível carregar as reservas da agenda."));
    } finally {
      if (requestId === agendaRequestId.current) setLoadingAgendaReservations(false);
    }
  }, []);

  const handleAgendaPeriodChange = useCallback((start: string, days: 7 | 14) => {
    setAgendaPeriod((current) => current?.start === start && current.days === days ? current : { start, days });
    if (loadedAgendaKey.current === `${start}|${days}`) return;
    void loadAgendaReservations(start, days);
  }, [loadAgendaReservations]);

  // --- Lista ----------------------------------------------------------------
  const [listText, setListText] = useState("");
  const [statuses, setStatuses] = useState<ListStatus[]>(DEFAULT_LIST_STATUSES);
  const [checkInFrom, setCheckInFrom] = useState<string | undefined>();
  const [checkInTo, setCheckInTo] = useState<string | undefined>();
  const [page, setPage] = useState(0);
  const [list, setList] = useState<ListState>({ status: "loading", items: [], total: 0, error: null });
  const [counts, setCounts] = useState<Partial<Record<ListStatus, number>> | null>(null);
  const [listNonce, setListNonce] = useState(0);
  const listRequestId = useRef(0);
  const countsRequestId = useRef(0);
  // Última consulta feita: trocar de visão e voltar não repete as requisições.
  const lastListKey = useRef<string | null>(null);
  const lastCountsKey = useRef<string | null>(null);

  // Filtros que valem para a lista e para as contagens; o status só para a lista.
  const baseParams = useMemo(() => ({
    ...listSearchParams(listText, agendaRooms ?? []),
    ...(checkInFrom ? { checkInFrom } : {}),
    ...(checkInTo ? { checkInTo } : {}),
  }), [listText, agendaRooms, checkInFrom, checkInTo]);
  const baseKey = JSON.stringify(baseParams);
  const statusParam = listStatusParam(statuses);

  useEffect(() => {
    if (workspaceView !== "lista") return;
    const key = `${baseKey}|${statusParam}|${page}|${listNonce}`;
    if (lastListKey.current === key) return;
    lastListKey.current = key;
    const requestId = ++listRequestId.current;
    if (!statusParam) {
      setList({ status: "ready", items: [], total: 0, error: null });
      return;
    }
    setList((current) => ({ status: "loading", items: current.items, total: current.total, error: null }));
    apiClient.get<ReservationsResponse>("/api/reservations", {
      params: { ...JSON.parse(baseKey), status: statusParam, page: page + 1, pageSize: LIST_PAGE_SIZE },
    })
      .then(({ data }) => {
        if (requestId !== listRequestId.current) return;
        const total = typeof data.total === "number" ? data.total : 0;
        const lastPage = Math.max(0, Math.ceil(total / LIST_PAGE_SIZE) - 1);
        if (page > lastPage) {
          setPage(lastPage);
          return;
        }
        setList({ status: "ready", items: Array.isArray(data.items) ? data.items : [], total, error: null });
      })
      .catch((error: unknown) => {
        if (requestId !== listRequestId.current) return;
        lastListKey.current = null;
        setList({ status: "error", items: [], total: 0, error: apiErrorMessage(error, "Erro ao carregar reservas") });
      });
  }, [workspaceView, baseKey, statusParam, page, listNonce]);

  // Contagem por status com os mesmos filtros: muda com busca e período, não ao ligar um status.
  useEffect(() => {
    if (workspaceView !== "lista") return;
    const key = `${baseKey}|${listNonce}`;
    if (lastCountsKey.current === key) return;
    lastCountsKey.current = key;
    const requestId = ++countsRequestId.current;
    setCounts(null);
    const params = JSON.parse(baseKey) as Record<string, string>;
    Promise.all(LIST_STATUSES.map((status) =>
      apiClient.get<ReservationsResponse>("/api/reservations", { params: { ...params, status, page: 1, pageSize: 1 } })
        .then(({ data }) => [status, data.total] as const)))
      .then((entries) => {
        if (requestId !== countsRequestId.current) return;
        // Sem número confiável, a contagem não aparece.
        if (entries.some(([, total]) => typeof total !== "number")) return;
        setCounts(Object.fromEntries(entries));
      })
      .catch(() => undefined);
  }, [workspaceView, baseKey, listNonce]);

  const toggleStatus = (status: ListStatus) => {
    setStatuses((current) => current.includes(status) ? current.filter((item) => item !== status) : [...current, status]);
    setPage(0);
  };
  const handleSearchChange = useCallback((text: string) => {
    setListText(text);
    setPage(0);
  }, []);

  // --- Reserva aberta e nova reserva ----------------------------------------
  const [viewing, setViewing] = useState<ReservationDto | null>(null);
  const statusSubmittingRef = useRef(false);
  const [statusAttempt, setStatusAttempt] = useState<{ fingerprint: string; key: string } | null>(null);
  const [creating, setCreating] = useState(false);

  // A barra de busca abre uma reserva por /reservas?reserva=<id>.
  const reservaParam = searchParams.get("reserva");
  useEffect(() => {
    if (!reservaParam) return;
    let active = true;
    apiClient.get<ReservationDto>(`/api/reservations/${reservaParam}`)
      .then((response) => { if (active) setViewing(response.data); })
      .catch(() => undefined);
    return () => { active = false; };
  }, [reservaParam]);

  // O Hoje abre a nova reserva por /reservas?nova=1.
  const novaParam = searchParams.get("nova");
  useEffect(() => {
    if (novaParam !== "1") return;
    setCreating(true);
    router.replace("/reservas", { scroll: false });
  }, [novaParam, router]);

  const refreshAll = useCallback(() => {
    if (agendaPeriod) void loadAgendaReservations(agendaPeriod.start, agendaPeriod.days);
    setListNonce((value) => value + 1);
  }, [agendaPeriod, loadAgendaReservations]);

  const retryAgenda = useCallback(() => {
    refetchAgendaRooms();
    if (agendaPeriod) void loadAgendaReservations(agendaPeriod.start, agendaPeriod.days);
  }, [agendaPeriod, loadAgendaReservations, refetchAgendaRooms]);

  const heading = (
    <>
      <h1 className="m-0 text-[22px] font-semibold tracking-[-0.02em]">Agenda</h1>
      <ReservationWorkspaceSwitcher value={workspaceView} onChange={setWorkspaceView} />
    </>
  );

  return (
    <div className="flex flex-col gap-5 px-5 py-6 min-[900px]:min-h-0 min-[900px]:flex-1 min-[900px]:px-7 min-[900px]:py-6">
      {workspaceView === "agenda" ? (
        <ReservationTimeline
          heading={heading}
          rooms={agendaRooms ?? []}
          roomsLoading={loadingAgendaRooms}
          reservations={agendaReservations?.items ?? []}
          totalReservations={agendaReservations?.total ?? 0}
          reservationsLoading={loadingAgendaReservations}
          error={agendaRoomsError || agendaReservationsError}
          onRetry={retryAgenda}
          onPeriodChange={handleAgendaPeriodChange}
          onOpenReservation={setViewing}
          onNewReservation={() => setCreating(true)}
        />
      ) : (
        <>
          <header className="flex shrink-0 flex-wrap items-center justify-between gap-x-5 gap-y-3">
            <div className="flex flex-wrap items-center gap-x-5 gap-y-3">{heading}</div>
            <Button variant="primary" onClick={() => setCreating(true)}>
              <Plus aria-hidden="true" />
              Nova reserva
            </Button>
          </header>
          <ReservationsFiltersComponent
            search={listText}
            onSearchChange={handleSearchChange}
            checkInFrom={checkInFrom}
            checkInTo={checkInTo}
            onPeriodChange={(from, to) => {
              setCheckInFrom(from);
              setCheckInTo(to);
              setPage(0);
            }}
            statuses={statuses}
            onToggleStatus={toggleStatus}
            counts={counts}
          />
          <ReservationsTable
            reservations={list.items}
            status={list.status}
            error={list.error}
            empty={statusParam ? "Nenhuma reserva com esses filtros." : "Ligue ao menos um status para ver reservas."}
            total={list.total}
            page={page}
            pageSize={LIST_PAGE_SIZE}
            onPageChange={setPage}
            onOpen={setViewing}
            onRetry={() => setListNonce((value) => value + 1)}
          />
        </>
      )}

      <ModalNovaReserva
        open={creating}
        onClose={() => setCreating(false)}
        onSuccess={() => {
          setCreating(false);
          refreshAll();
        }}
      />

      <ReservationDrawer
        open={!!viewing}
        reservation={viewing}
        mode="view"
        onClose={() => setViewing(null)}
        onSave={(updated) => {
          setList((current) => ({ ...current, items: current.items.map((r) => r.id === updated.id ? updated : r) }));
          setViewing(updated);
          if (agendaPeriod) void loadAgendaReservations(agendaPeriod.start, agendaPeriod.days);
        }}
        onStatusChange={async (id, status) => {
          if (statusSubmittingRef.current) return;
          statusSubmittingRef.current = true;
          try {
            const r = viewing!;
            const targetStatus = normalizeStatus(status);
            const attempt = getIdempotencyAttempt(
              statusAttempt,
              { id, targetStatus, version: r.version },
            );
            setStatusAttempt(attempt);
            const response = await apiClient.post<ReservationDto>(`/api/reservations/${id}/transitions`, {
              targetStatus,
              version: r.version,
              idempotencyKey: attempt.key,
              ...(targetStatus === "Cancelada" ? { reason: "Cancelamento confirmado pela operação." } : {})
            });
            setStatusAttempt(null);
            setViewing(response.data);
            refreshAll();
          } finally {
            statusSubmittingRef.current = false;
          }
        }}
      />
    </div>
  );
}

export default function ReservationsPage() {
  return <Suspense fallback={null}><ReservationsPageContent /></Suspense>;
}
