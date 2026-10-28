"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Plus, Search } from "lucide-react";
import apiClient from "../../services/api";
import { useCachedFetch } from "../../hooks/useCachedFetch";
import { useCurrentUser } from "../../hooks/useCurrentUser";
import type { ReservationsResponse } from "../../types/reservations";
import { apiErrorMessage } from "../../utils/api-error";
import type { Room } from "../../utils/models";
import { formatReservationCalendarDate } from "../../utils/reservation";
import { CommandBarTrigger } from "../../components/command/CommandBar";
import RoomFormSheet from "../../components/quartos/RoomFormSheet";
import RoomPanel, { roomSubtitle } from "../../components/quartos/RoomPanel";
import RoomSwatch from "../../components/quartos/RoomSwatch";
import RoomsTable, { type RoomRow } from "../../components/quartos/RoomsTable";
import { normalizeRoom, updateHousekeeping, updateRoom } from "../../components/quartos/room-api";
import { housekeepingLabel, type HousekeepingStatus } from "../../components/quartos/housekeeping";
import {
  countCategories, isMaintenance, matchesFilter, matchesSearch, roomLabel, roomToday, summarizeRooms, validateRoomUpdate, type RoomFilter,
} from "../../components/quartos/rooms-data";
import { useWideLayout } from "../../components/quartos/useWideLayout";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import { Kpi, KpiRow } from "../../components/ui/Kpi";
import Segmented from "../../components/ui/Segmented";
import Sheet from "../../components/ui/Sheet";
import { toast } from "../../components/ui/Toast";

type LoadStatus = "loading" | "error" | "ready";

function KpiLabel({ kind, children }: { kind: Parameters<typeof RoomSwatch>[0]["kind"]; children: string }) {
  return <span className="inline-flex items-center gap-1.5"><RoomSwatch kind={kind} />{children}</span>;
}

function QuartosContent() {
  const today = formatReservationCalendarDate(new Date());
  const wide = useWideLayout();
  // Criar, editar e manutenção usam rotas só de admin; a recepção consulta.
  const { user } = useCurrentUser();
  const isAdmin = user?.role === "admin";
  const quartoParam = useSearchParams().get("quarto");

  const [rooms, setRooms] = useState<Room[] | null>(null);
  const [roomsError, setRoomsError] = useState(false);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let active = true;
    apiClient.get<Room[]>("/api/rooms")
      .then((response) => { if (active) setRooms(response.data.map(normalizeRoom)); })
      .catch((error) => {
        if (!active) return;
        setRoomsError(true);
        console.error("Erro ao carregar quartos", error);
      });
    return () => { active = false; };
  }, [reload]);

  // Situação de hoje: hospedagens em andamento (como no Hoje) e reservas que já começaram ou começam hoje.
  const staying = useCachedFetch<ReservationsResponse>("/api/reservations?status=EmAndamento&pageSize=100", { cacheKey: "quartos:hospedados" });
  const booked = useCachedFetch<ReservationsResponse>(
    `/api/reservations?status=Pendente,Confirmada&checkInTo=${today}&checkOutFrom=${today}&pageSize=100`,
    { cacheKey: "quartos:reservados" },
  );
  // Lista cortada pela paginação daria quarto ocupado como livre: vira erro.
  const truncated = [staying.data, booked.data].some((data) => data && data.total > data.items.length);
  const todayStatus: LoadStatus = staying.error || booked.error || truncated
    ? "error"
    : staying.data && booked.data ? "ready" : "loading";

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<RoomFilter>("todos");
  const [selection, setSelection] = useState<{ id: string | null; param: string | null }>({ id: quartoParam, param: quartoParam });
  if (selection.param !== quartoParam) setSelection({ id: quartoParam, param: quartoParam });

  const [form, setForm] = useState<{ open: boolean; room: Room | null }>({ open: false, room: null });
  const [busyId, setBusyId] = useState<string | null>(null);
  const [cleaningId, setCleaningId] = useState<string | null>(null);

  const rows: RoomRow[] = useMemo(() => {
    if (!rooms) return [];
    const reservations = todayStatus === "ready" ? [...(staying.data?.items ?? []), ...(booked.data?.items ?? [])] : [];
    return rooms.map((room) => ({
      room,
      // Sem a situação de hoje, só a manutenção (que vem do quarto) aparece.
      state: todayStatus === "ready" || isMaintenance(room) ? roomToday(room, reservations, today) : null,
    }));
  }, [rooms, todayStatus, staying.data, booked.data, today]);

  const summary = summarizeRooms(rows.flatMap((row) => (row.state ? [row.state] : [])));
  const visible = rows.filter((row) => matchesSearch(row.room, search) && matchesFilter(filter, row.room, row.state));

  // Na tela larga sempre há um quarto no painel; na estreita, só o que foi tocado.
  const selectedId = selection.id ?? (wide ? visible[0]?.room.id ?? null : null);
  const selectedRow = rows.find((row) => row.room.id === selectedId) ?? null;

  const replaceRoom = (saved: Room) => setRooms((previous) => {
    if (!previous) return previous;
    // A resposta do cadastro não traz o número de exibição; o que faltar fica do quarto anterior.
    const exists = previous.some((room) => room.id === saved.id);
    return exists
      ? previous.map((room) => (room.id === saved.id ? { ...room, ...saved } : room))
      : [...previous, saved].sort((a, b) => a.number - b.number);
  });

  async function changeHousekeeping(room: Room, status: HousekeepingStatus) {
    setCleaningId(room.id);
    try {
      const saved = await updateHousekeeping(room.id, status);
      setRooms((previous) => previous?.map((item) => (item.id === saved.id ? { ...item, ...saved } : item)) ?? previous);
      toast.success(`Quarto ${roomLabel(room)}: ${housekeepingLabel(status).toLowerCase()}.`);
    } catch (error) {
      toast.error(apiErrorMessage(error, "Não foi possível atualizar a limpeza."));
    } finally {
      setCleaningId(null);
    }
  }

  async function toggleMaintenance(room: Room) {
    const next = isMaintenance(room) ? "Disponivel" : "Manutencao";
    const problem = validateRoomUpdate(room);
    if (problem) {
      toast.warning(problem);
      return;
    }
    setBusyId(room.id);
    try {
      replaceRoom(await updateRoom({ ...room, status: next }));
      toast.success(next === "Manutencao" ? `Quarto ${roomLabel(room)} em manutenção.` : `Manutenção do quarto ${roomLabel(room)} encerrada.`);
    } catch (error) {
      toast.error(apiErrorMessage(error, "Erro ao atualizar quarto!"));
    } finally {
      setBusyId(null);
    }
  }

  const panel = selectedRow && (
    <RoomPanel
      key={selectedRow.room.id}
      room={selectedRow.room}
      today={today}
      state={selectedRow.state}
      busy={busyId === selectedRow.room.id}
      onEdit={isAdmin ? () => setForm({ open: true, room: selectedRow.room }) : undefined}
      onToggleMaintenance={isAdmin ? () => void toggleMaintenance(selectedRow.room) : undefined}
      onHousekeepingChange={(status) => void changeHousekeeping(selectedRow.room, status)}
      housekeepingBusy={cleaningId === selectedRow.room.id}
      showHeader={wide}
    />
  );

  const filterCount = (value: RoomFilter) => (rooms && (todayStatus === "ready" || value === "todos" || value === "manutencao" || value === "limpeza")
    ? rows.filter((row) => matchesFilter(value, row.room, row.state)).length
    : undefined);

  return (
    <div className="flex flex-col gap-4 px-5 py-6 min-[900px]:min-h-0 min-[900px]:flex-1 min-[900px]:px-8 min-[900px]:py-6">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-x-5 gap-y-3">
        <div className="flex flex-wrap items-baseline gap-x-3">
          <h1 className="m-0 text-[22px] font-semibold tracking-[-0.02em]">Quartos</h1>
          {rooms && (
            <span className="text-fg-3">
              <span className="font-mono">{rooms.length}</span> {rooms.length === 1 ? "unidade" : "unidades"} · {countCategories(rooms)} {countCategories(rooms) === 1 ? "categoria" : "categorias"}
            </span>
          )}
        </div>
        {isAdmin && (
          <Button variant="primary" onClick={() => setForm({ open: true, room: null })}>
            <Plus aria-hidden="true" />
            Novo quarto
          </Button>
        )}
      </header>

      <CommandBarTrigger className="shrink-0" />

      <KpiRow>
        <Kpi label={<KpiLabel kind="staying">Hospedados</KpiLabel>} status={rooms ? todayStatus : roomsError ? "error" : "loading"} value={summary.staying} />
        <Kpi label={<KpiLabel kind="arriving">Chegam hoje</KpiLabel>} status={rooms ? todayStatus : roomsError ? "error" : "loading"} value={summary.arriving} />
        <Kpi label={<KpiLabel kind="free">Livres</KpiLabel>} status={rooms ? todayStatus : roomsError ? "error" : "loading"} value={summary.free} />
        <Kpi label={<KpiLabel kind="maintenance">Manutenção</KpiLabel>} status={rooms ? "ready" : roomsError ? "error" : "loading"} value={summary.maintenance} />
      </KpiRow>

      <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2">
        <label htmlFor="busca-quarto" className="sr-only">Buscar quarto</label>
        <Input
          id="busca-quarto"
          icon={<Search />}
          placeholder="Número ou categoria"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="w-full min-[480px]:w-60"
        />
        <Segmented
          label="Filtrar por situação"
          value={filter}
          onChange={(value) => { setFilter(value); setSelection((previous) => ({ ...previous, id: null })); }}
          className="max-w-full overflow-x-auto"
          options={[
            { value: "todos", label: "Todos", count: filterCount("todos") },
            { value: "livres", label: "Livres", count: filterCount("livres"), disabled: todayStatus !== "ready" },
            { value: "ocupados", label: "Ocupados hoje", count: filterCount("ocupados"), disabled: todayStatus !== "ready" },
            { value: "limpeza", label: "Limpeza", count: filterCount("limpeza") },
            { value: "manutencao", label: "Manutenção", count: filterCount("manutencao") },
          ]}
        />
        {todayStatus === "error" && rooms && (
          <span role="alert" className="inline-flex items-center gap-2 text-[13px] text-danger">
            Não foi possível carregar a situação de hoje.
            <Button size="sm" variant="ghost" onClick={() => { staying.refetch(); booked.refetch(); }}>Tentar de novo</Button>
          </span>
        )}
      </div>

      <div className="flex gap-7 min-[900px]:min-h-0 min-[900px]:flex-1">
        <div className="min-w-0 flex-1 overflow-x-auto min-[900px]:overflow-auto">
          {!rooms && !roomsError && (
            <div aria-busy="true" className="flex flex-col gap-2 pt-2">
              <span className="sr-only">Carregando</span>
              {[0, 1, 2, 3].map((row) => <span key={row} aria-hidden="true" className="h-11 animate-pulse rounded-bar bg-muted" />)}
            </div>
          )}
          {roomsError && (
            <p role="alert" className="m-0 flex flex-wrap items-center gap-2 py-6 text-[13px] text-danger">
              Não foi possível carregar quartos.
              <Button size="sm" onClick={() => { setRoomsError(false); setRooms(null); setReload((value) => value + 1); }}>Tentar novamente</Button>
            </p>
          )}
          {rooms && (
            <RoomsTable
              rows={visible}
              todayStatus={todayStatus}
              selectedId={selectedId}
              onSelect={(room) => setSelection((previous) => ({ ...previous, id: room.id }))}
            />
          )}
        </div>

        {wide && panel && (
          <aside aria-label="Detalhes do quarto" className="w-[320px] shrink-0 overflow-auto rounded-block bg-bg p-5">
            {panel}
          </aside>
        )}
      </div>

      {!wide && selectedRow && (
        <Sheet
          open={!form.open}
          onOpenChange={(open) => { if (!open) setSelection((previous) => ({ ...previous, id: null })); }}
          title={`Quarto ${roomLabel(selectedRow.room)}`}
          description={roomSubtitle(selectedRow.room)}
          headerAside={isAdmin ? (
            <Button size="sm" onClick={() => setForm({ open: true, room: selectedRow.room })}>Editar</Button>
          ) : undefined}
        >
          {panel}
        </Sheet>
      )}

      <RoomFormSheet
        open={form.open}
        onOpenChange={(open) => setForm((previous) => ({ ...previous, open }))}
        room={form.room}
        onSaved={replaceRoom}
        onDeleted={(id) => {
          setRooms((previous) => previous?.filter((room) => room.id !== id) ?? previous);
          setSelection((previous) => ({ ...previous, id: null }));
        }}
      />
    </div>
  );
}

export default function QuartosPage() {
  return <Suspense fallback={null}><QuartosContent /></Suspense>;
}
