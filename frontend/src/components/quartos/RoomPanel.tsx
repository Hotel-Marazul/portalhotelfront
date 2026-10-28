"use client";

import Link from "next/link";
import { Pencil } from "lucide-react";
import { useCachedFetch } from "../../hooks/useCachedFetch";
import type { ReservationsResponse } from "../../types/reservations";
import { formatCurrency, formatDayMonth, formatStayPeriod } from "../../utils/format";
import type { Room } from "../../utils/models";
import Button, { buttonClasses } from "../ui/Button";
import { cx } from "../ui/cx";
import { guestName, isMaintenance, occupancyWindow, roomLabel, upcomingReservations, type RoomToday } from "./rooms-data";
import RoomSwatch from "./RoomSwatch";

const MAX_UPCOMING = 5;

interface RoomPanelProps {
  room: Room;
  today: string;
  /** null quando a situação de hoje não carregou. */
  state: RoomToday | null;
  busy: boolean;
  onEdit: () => void;
  onToggleMaintenance: () => void;
  /** No Sheet, o número e a categoria já estão no cabeçalho. */
  showHeader?: boolean;
}

export function roomSubtitle(room: Room) {
  const parts = [room.type, `até ${room.capacity} ${room.capacity === 1 ? "pessoa" : "pessoas"}`];
  if (room.connectedRoomNumber) parts.push(`conjuga com ${room.connectedRoomNumber}`);
  return parts.join(" · ");
}

const h3Class = "m-0 text-[13px] font-semibold text-fg-2";

// Detalhe do quarto escolhido: situação, manutenção, ocupação de 14 dias, preço e próximas reservas.
export default function RoomPanel({ room, today, state, busy, onEdit, onToggleMaintenance, showHeader = true }: RoomPanelProps) {
  const reservations = useCachedFetch<ReservationsResponse>(
    `/api/reservations?roomId=${room.id}&status=Pendente,Confirmada,EmAndamento&pageSize=100`,
    { cacheKey: `quartos:reservas:${room.id}` },
  );
  // Sem filtro de data, para não perder hospedagem com saída vencida. Lista cortada vira erro.
  const truncated = Boolean(reservations.data && reservations.data.total > reservations.data.items.length);
  const loaded = truncated ? null : reservations.data;
  const failed = Boolean(reservations.error) || truncated;
  const items = loaded?.items ?? [];
  const occupancy = occupancyWindow(items, today);
  const upcoming = upcomingReservations(items, today);
  const maintenance = isMaintenance(room);
  const couple = room.couplePrice ?? room.price;

  return (
    <div className="flex flex-col gap-5">
      {showHeader && (
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-0.5">
            <h2 className="m-0 font-mono text-[28px] leading-tight font-medium tracking-[-0.02em]">{roomLabel(room)}</h2>
            <span className="text-[13px] text-fg-3">{roomSubtitle(room)}</span>
          </div>
          <Button size="sm" className="size-8 px-0" aria-label={`Editar quarto ${roomLabel(room)}`} onClick={onEdit}>
            <Pencil aria-hidden="true" />
          </Button>
        </div>
      )}

      <div className="flex flex-col gap-1 rounded-block border border-rule bg-surface p-3.5">
        {state ? (
          <>
            <span className="inline-flex items-center gap-1.5 font-medium"><RoomSwatch kind={state.kind} />{state.label}</span>
            {state.detail && <span className="text-[13px] text-fg-3">{state.detail}</span>}
          </>
        ) : (
          <span className="inline-flex items-center gap-1.5 font-medium">
            <RoomSwatch kind={maintenance ? "maintenance" : null} />
            {maintenance ? "Manutenção" : "Situação de hoje indisponível"}
          </span>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5">
        <Button size="sm" disabled={busy} onClick={onToggleMaintenance}>
          {busy ? "Aguarde…" : maintenance ? "Encerrar manutenção" : "Colocar em manutenção"}
        </Button>
        <Link href="/reservas" className={buttonClasses("ghost", "sm")}>Ver na agenda</Link>
      </div>

      <section aria-labelledby="quarto-ocupacao" className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between gap-3">
          <h3 id="quarto-ocupacao" className={h3Class}>Próximos 14 dias</h3>
          {loaded && <span className="font-mono text-xs text-fg-3">{occupancy.percent}% ocupado</span>}
        </div>
        {reservations.loading && !reservations.data && <span aria-busy="true" className="block h-[22px] animate-pulse rounded-bar bg-muted"><span className="sr-only">Carregando</span></span>}
        {failed && <p role="alert" className="m-0 text-[13px] text-danger">Não foi possível carregar as reservas do quarto.</p>}
        {loaded && (
          <>
            <div role="img" aria-label={`${occupancy.nights} de 14 noites ocupadas`} className="grid grid-cols-[repeat(14,minmax(0,1fr))] gap-[3px]">
              {occupancy.days.map((entry) => (
                <span key={entry.date} title={formatDayMonth(entry.date)} className={cx("h-[22px] rounded-[3px]", entry.occupied ? "bg-accent" : "bg-done-bg")} />
              ))}
            </div>
            <div className="flex justify-between font-mono text-[11px] text-fg-3">
              <span>{formatDayMonth(occupancy.days[0].date)}</span>
              <span>{formatDayMonth(occupancy.days[7].date)}</span>
              <span>{formatDayMonth(occupancy.days[13].date)}</span>
            </div>
          </>
        )}
      </section>

      <section aria-labelledby="quarto-preco" className="flex flex-col gap-2">
        <h3 id="quarto-preco" className={h3Class}>Preço</h3>
        <dl className="m-0 grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-2 text-[13px]">
          <dt className="text-fg-3">Diária de casal</dt>
          <dd className="m-0 font-mono">{formatCurrency(couple)}</dd>
          {room.singlePrice != null && (
            <>
              <dt className="text-fg-3">Só 1 pessoa</dt>
              <dd className="m-0 font-mono">{formatCurrency(room.singlePrice)}</dd>
            </>
          )}
          <dt className="text-fg-3">Hóspede adicional</dt>
          <dd className="m-0">pela regra de idade</dd>
        </dl>
        <Link href="/categoria" className="text-[13px] text-accent underline-offset-4 hover:underline">Editar em Categorias e tarifas</Link>
      </section>

      <section aria-labelledby="quarto-proximas" className="flex flex-col">
        <h3 id="quarto-proximas" className={cx(h3Class, "mb-1")}>Próximas reservas</h3>
        {failed && <p className="m-0 py-2 text-[13px] text-fg-3">Sem dados.</p>}
        {loaded && upcoming.length === 0 && <p className="m-0 py-2 text-[13px] text-fg-3">Nenhuma reserva a partir de hoje.</p>}
        {upcoming.slice(0, MAX_UPCOMING).map((reservation) => (
          <Link
            key={reservation.id}
            href={`/reservas?reserva=${reservation.id}`}
            className="flex min-h-10 items-center justify-between gap-2.5 border-b border-rule text-[13px] text-fg no-underline hover:text-accent"
          >
            <span className="truncate font-medium">{guestName(reservation)}</span>
            <span className="shrink-0 font-mono text-fg-2">{formatStayPeriod(reservation.checkInDate, reservation.checkOutDate)}</span>
          </Link>
        ))}
        {upcoming.length > MAX_UPCOMING && (
          <Link href="/reservas" className="pt-2 text-[13px] text-fg-2 underline-offset-4 hover:text-fg">
            Ver todas na agenda ({upcoming.length})
          </Link>
        )}
      </section>
    </div>
  );
}
