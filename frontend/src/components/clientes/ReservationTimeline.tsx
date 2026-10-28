"use client";

import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, Plus, Search } from "lucide-react";
import type { ReservationDto } from "../../types/reservations";
import {
  addReservationCalendarDays,
  formatReservationCalendarDate,
  formatReservationDisplayDate,
} from "../../utils/reservation";
import { usePersistentUiState } from "../../hooks/usePersistentUiState";
import Button from "../ui/Button";
import Input from "../ui/Input";
import Select from "../ui/Select";
import { roomLabel } from "../agenda/agenda-data";
import TimelineAvailability from "./TimelineAvailability";
import TimelineGrid, { guestName, HATCH_STYLE, type TimelineRoom } from "./TimelineGrid";

interface Props {
  /** Título e troca de visão, na mesma linha da navegação por semana. */
  heading: ReactNode;
  rooms: TimelineRoom[];
  roomsLoading?: boolean;
  reservations: ReservationDto[];
  reservationsLoading?: boolean;
  totalReservations?: number;
  error?: string | null;
  onRetry?: () => void;
  onPeriodChange?: (start: string, days: 7 | 14) => void;
  onOpenReservation: (reservation: ReservationDto) => void;
  onNewReservation: () => void;
}

interface AgendaPreferences {
  start: string;
  days: 7 | 14;
  category: string;
  capacity: string;
}

function isAgendaPreferences(value: unknown): value is AgendaPreferences {
  if (!value || typeof value !== "object") return false;
  const preferences = value as Record<string, unknown>;
  return typeof preferences.start === "string"
    && /^\d{4}-\d{2}-\d{2}$/.test(preferences.start)
    && (preferences.days === 7 || preferences.days === 14)
    && typeof preferences.category === "string"
    && typeof preferences.capacity === "string";
}

const todayDate = () => formatReservationCalendarDate(new Date());
const shiftDays = (date: string, amount: number) => formatReservationCalendarDate(addReservationCalendarDays(date, amount));
const normalize = (text: string) => text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLocaleLowerCase("pt-BR");

const LEGEND: Array<{ label: string; className?: string; style?: CSSProperties }> = [
  { label: "Hospedado", className: "bg-fg" },
  { label: "Confirmada", className: "bg-accent" },
  { label: "Pendente", className: "bg-warn-bg shadow-[inset_0_0_0_1px_var(--warn-border)]" },
  { label: "Concluída", className: "bg-done-bg" },
  { label: "Manutenção", style: HATCH_STYLE },
];

export default function ReservationTimeline({
  heading,
  rooms,
  roomsLoading = false,
  reservations,
  reservationsLoading = false,
  totalReservations = reservations.length,
  error = null,
  onRetry,
  onPeriodChange,
  onOpenReservation,
  onNewReservation,
}: Props) {
  const [preferences, setPreferences] = usePersistentUiState<AgendaPreferences>(
    "agenda:map",
    { start: todayDate(), days: 14, category: "", capacity: "" },
    isAgendaPreferences,
  );
  const [search, setSearch] = useState("");
  const [today, setToday] = useState<string | null>(null);
  useEffect(() => { setToday(todayDate()); }, []);

  const { start, days, category, capacity } = preferences;
  const update = (patch: Partial<AgendaPreferences>) => setPreferences((current) => ({ ...current, ...patch }));

  useEffect(() => {
    onPeriodChange?.(start, days);
  }, [onPeriodChange, start, days]);

  const categories = useMemo(() => {
    const byId = new Map<string, string>();
    for (const room of rooms) byId.set(room.categoryId || room.type, room.type);
    return [...byId.entries()].sort((a, b) => a[1].localeCompare(b[1], "pt-BR"));
  }, [rooms]);
  const capacities = useMemo(() => [...new Set(rooms.map((room) => room.capacity))].sort((a, b) => a - b), [rooms]);

  // Cancelada não ocupa o quarto: fica só na lista.
  const mapReservations = useMemo(() => reservations.filter((reservation) => reservation.status !== "Cancelada"), [reservations]);

  const visibleRooms = useMemo(() => {
    const term = normalize(search.trim());
    return rooms.filter((room) => {
      if (category && (room.categoryId || room.type) !== category) return false;
      if (capacity && room.capacity < Number(capacity)) return false;
      if (!term) return true;
      if (normalize(roomLabel(room)).includes(term)) return true;
      return mapReservations.some((reservation) =>
        (reservation.room?.id || reservation.roomId) === room.id && normalize(guestName(reservation)).includes(term));
    });
  }, [rooms, category, capacity, search, mapReservations]);

  const periodLabel = `${formatReservationDisplayDate(start, { day: "numeric", month: "short" })} – ${formatReservationDisplayDate(addReservationCalendarDays(start, days - 1), { day: "numeric", month: "short", year: "numeric" })}`.replace(/\./g, "");
  const partial = !reservationsLoading && !error && totalReservations > reservations.length;

  return (
    <>
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-x-5 gap-y-3">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
          {heading}
          <div className="inline-flex items-center gap-2">
            <Button variant="ghost" size="sm" className="w-8 px-0" aria-label="Semana anterior" onClick={() => update({ start: shiftDays(start, -7) })}>
              <ChevronLeft aria-hidden="true" />
            </Button>
            <Button variant="ghost" size="sm" className="w-8 px-0" aria-label="Próxima semana" onClick={() => update({ start: shiftDays(start, 7) })}>
              <ChevronRight aria-hidden="true" />
            </Button>
            <span aria-live="polite" className="px-1.5 font-medium">{periodLabel}</span>
            <Button size="sm" onClick={() => update({ start: todayDate() })}>Hoje</Button>
          </div>
        </div>
        <Button variant="primary" onClick={onNewReservation}>
          <Plus aria-hidden="true" />
          Nova reserva
        </Button>
      </header>

      <div className="flex shrink-0 flex-wrap items-center gap-3">
        <Input
          type="search"
          aria-label="Buscar hóspede ou quarto"
          placeholder="Buscar hóspede ou quarto"
          icon={<Search />}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="w-full min-[600px]:w-[260px]"
        />
        <Select aria-label="Categoria" value={category} onChange={(event) => update({ category: event.target.value })} className="w-[calc(50%-6px)] min-[600px]:w-auto">
          <option value="">Categoria: todas</option>
          {categories.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
        </Select>
        <Select aria-label="Capacidade" value={capacity} onChange={(event) => update({ capacity: event.target.value })} className="w-[calc(50%-6px)] min-[600px]:w-auto">
          <option value="">Capacidade: qualquer</option>
          {capacities.map((value) => <option key={value} value={String(value)}>Para {value} ou mais</option>)}
        </Select>
        <Select aria-label="Dias visíveis" value={String(days)} onChange={(event) => update({ days: Number(event.target.value) === 7 ? 7 : 14 })} className="w-[calc(50%-6px)] min-[600px]:w-auto">
          <option value="14">14 dias</option>
          <option value="7">7 dias</option>
        </Select>
        <div className="min-[600px]:ml-auto">
          <TimelineAvailability />
        </div>
      </div>

      {partial && (
        <p role="status" className="m-0 shrink-0 rounded-control bg-warn-bg px-3 py-2 text-[13px] text-warn-fg">
          Mapa parcial: <span className="font-mono">{reservations.length}</span> de <span className="font-mono">{totalReservations}</span> reservas carregadas. Confirme a disponibilidade na consulta por período antes de reservar.
        </p>
      )}

      {roomsLoading ? (
        <div aria-busy="true" className="flex flex-col gap-2">
          <span className="sr-only">Carregando agenda</span>
          {[0, 1, 2, 3].map((row) => <span key={row} aria-hidden="true" className="h-9 animate-pulse rounded-bar bg-muted" />)}
        </div>
      ) : error ? (
        <div role="alert" className="flex flex-wrap items-center gap-3 py-6 text-[13px] text-danger">
          {error}
          {onRetry && <Button size="sm" onClick={onRetry}>Tentar novamente</Button>}
        </div>
      ) : (
        <TimelineGrid rooms={visibleRooms} reservations={mapReservations} start={start} days={days} today={today} onSelect={onOpenReservation} />
      )}

      <div id="agenda-legenda" className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-fg-2">
        {LEGEND.map((item) => (
          <span key={item.label} className="inline-flex items-center gap-1.5">
            <span aria-hidden="true" className={`h-2.5 w-3.5 rounded-[3px] ${item.className ?? ""}`} style={item.style} />
            {item.label}
          </span>
        ))}
        {reservationsLoading && <span role="status" className="text-fg-3">Atualizando as reservas deste período…</span>}
        <span className="text-fg-3 min-[900px]:ml-auto">Cada dia tem duas metades: saída à esquerda, entrada à direita.</span>
      </div>
    </>
  );
}
