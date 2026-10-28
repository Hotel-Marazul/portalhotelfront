"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Users } from "lucide-react";
import type { ReservationDto } from "../../types/reservations";
import { addReservationCalendarDays, formatReservationCalendarDate } from "../../utils/reservation";
import { formatDayMonth, formatStayPeriod } from "../../utils/format";
import { normalizeOperationalRoomStatus } from "../../utils/roomStatus";
import { groupRoomsByCategory, roomLabel } from "../agenda/agenda-data";
import { cx } from "../ui/cx";
import { assignTimelineLanes, getTimelineBarPosition, getTimelineOffsets } from "./timeline-layout";

export interface TimelineRoom {
  displayNumber?: string;
  id: string; number: number; categoryId: string; type: string; capacity: number;
  status: string; price: number; singlePrice?: number | null; couplePrice?: number | null;
}

export const guestName = (reservation: ReservationDto) => reservation.client?.fullName || reservation.client?.name || "Hóspede não informado";

// Luminosidade diferente por estado, não só cor. Cancelada fica fora do mapa.
export const MAP_STATUS: Record<string, { label: string; className: string }> = {
  EmAndamento: { label: "Hospedado", className: "bg-fg text-on-dark" },
  Confirmada: { label: "Confirmada", className: "bg-accent text-on-dark" },
  Pendente: { label: "Pendente", className: "border border-warn-border bg-warn-bg text-warn-fg" },
  Concluída: { label: "Concluída", className: "bg-done-bg text-fg-2" },
  Concluida: { label: "Concluída", className: "bg-done-bg text-fg-2" },
};

export const HATCH_STYLE: CSSProperties = {
  backgroundImage: "repeating-linear-gradient(135deg, var(--hatch-a) 0 3px, var(--hatch-b) 3px 6px)",
};

const ROOM_WIDTH = 132;
const MIN_DAY_WIDTH = 48;
const LANE_HEIGHT = 34;
const WEEKDAYS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

function dayOffset(date: string, periodStart: string) {
  return Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${periodStart}T00:00:00Z`)) / 86_400_000);
}

function weekday(date: string) {
  return new Date(`${date}T00:00:00Z`).getUTCDay();
}

type RowItem =
  | { kind: "reservation"; start: number; end: number; reservation: ReservationDto }
  | { kind: "maintenance"; start: number; end: number };

interface Props {
  rooms: TimelineRoom[];
  reservations: ReservationDto[];
  /** Primeiro dia visível, AAAA-MM-DD. */
  start: string;
  days: number;
  /** Hoje no fuso do hotel; null até montar no navegador. */
  today: string | null;
  onSelect: (reservation: ReservationDto) => void;
}

export default function TimelineGrid({ rooms, reservations, start, days, today, onSelect }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [dayWidth, setDayWidth] = useState(MIN_DAY_WIDTH);
  // Sem quartos, o mapa sai da tela; ao voltar, mede de novo.
  const hasRooms = rooms.length > 0;

  // Os dias dividem a largura disponível; abaixo de 48 px por dia, o mapa rola para o lado.
  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    const measure = () => setDayWidth(Math.max(MIN_DAY_WIDTH, Math.floor((element.clientWidth - ROOM_WIDTH) / days)));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [days, hasRooms]);

  const dates = Array.from({ length: days }, (_, index) => formatReservationCalendarDate(addReservationCalendarDays(start, index)));
  const todayOffset = today ? dayOffset(today, start) : null;
  const trackWidth = days * dayWidth;

  if (!rooms.length) {
    return <p role="status" className="m-0 py-10 text-center text-[13px] text-fg-3">Nenhum quarto encontrado. Ajuste os filtros ou cadastre um quarto.</p>;
  }

  const dayBackground = (index: number) =>
    index === todayOffset ? "bg-accent-50" : [0, 6].includes(weekday(dates[index])) ? "bg-bg/50" : "bg-surface";

  return (
    <div
      ref={scrollRef}
      role="region"
      aria-label="Mapa de reservas por quarto e dia"
      aria-describedby="agenda-legenda"
      tabIndex={0}
      className="min-h-[240px] flex-1 overflow-auto rounded-block border border-rule"
    >
      <div style={{ width: ROOM_WIDTH + trackWidth, minWidth: "100%" }}>
        <div className="sticky top-0 z-[4] flex h-12 border-b border-rule bg-surface">
          <div className="sticky left-0 z-[5] flex w-[132px] flex-none items-center border-r border-rule bg-surface px-3.5 text-xs font-medium text-fg-3">Quarto</div>
          {dates.map((date, index) => {
            const isToday = index === todayOffset;
            const day = Number(date.slice(8));
            return (
              <div
                key={date}
                style={{ width: dayWidth }}
                className={cx("flex flex-none flex-col items-center justify-center gap-px border-l border-muted whitespace-nowrap", dayBackground(index), isToday && "shadow-[inset_0_2px_0_var(--accent)]")}
              >
                <span className={cx("text-[11px]", isToday ? "text-accent" : "text-fg-3")}>{isToday ? "hoje" : WEEKDAYS[weekday(date)]}</span>
                <span className={cx("font-mono text-sm font-medium", isToday ? "text-accent" : "text-fg")}>{day === 1 ? formatDayMonth(date) : day}</span>
              </div>
            );
          })}
        </div>

        {groupRoomsByCategory(rooms).map((group) => (
          <div key={group.id} role="group" aria-label={`${group.name}, ${group.caption}`}>
            <div className="flex h-7 items-center justify-between border-b border-muted bg-bg/50 px-3.5 text-xs">
              <span className="sticky left-3.5 font-semibold text-fg-2">
                {group.name} <span className="font-normal text-fg-3">· {group.caption}</span>
              </span>
              <span className="text-fg-3">{group.rooms.length} {group.rooms.length === 1 ? "quarto" : "quartos"}</span>
            </div>
            {group.rooms.map((room) => {
              const label = roomLabel(room);
              const items: RowItem[] = reservations
                .filter((reservation) => (reservation.room?.id || reservation.roomId) === room.id)
                .flatMap((reservation) => {
                  const offsets = getTimelineOffsets(reservation.checkInDate, reservation.checkOutDate, start);
                  return offsets ? [{ kind: "reservation" as const, ...offsets, reservation }] : [];
                });
              // Manutenção vem do status atual do quarto, sem data de fim: vale de hoje em diante.
              if (normalizeOperationalRoomStatus(room.status) === "Manutencao" && todayOffset !== null) {
                items.push({ kind: "maintenance", start: todayOffset - 0.5, end: days + 1 });
              }
              const laid = assignTimelineLanes(items);
              const lanes = Math.max(1, ...laid.map((item) => item.lane + 1));
              return (
                <div key={room.id} className="flex border-b border-muted" style={{ height: 4 + lanes * LANE_HEIGHT }}>
                  <div className="sticky left-0 z-[3] flex w-[132px] flex-none items-center gap-2 border-r border-rule bg-surface px-3.5">
                    <span className="font-mono text-[13px] font-medium">{label}</span>
                    <span className="inline-flex items-center gap-[3px] text-xs text-fg-3" title={`Até ${room.capacity} ${room.capacity === 1 ? "pessoa" : "pessoas"}`}>
                      <Users aria-hidden="true" className="size-3" />
                      <span className="sr-only">até</span>{room.capacity}<span className="sr-only">{room.capacity === 1 ? " pessoa" : " pessoas"}</span>
                    </span>
                  </div>
                  <div className="relative flex flex-none" style={{ width: trackWidth }}>
                    {dates.map((date, index) => (
                      <span
                        key={date}
                        aria-hidden="true"
                        style={{ width: dayWidth }}
                        // Linha fina no meio do dia: saída à esquerda, entrada à direita.
                        className={cx("h-full flex-none border-l border-muted bg-[linear-gradient(to_right,transparent_calc(50%-0.5px),var(--rule)_calc(50%-0.5px),var(--rule)_calc(50%+0.5px),transparent_calc(50%+0.5px))]", dayBackground(index))}
                      />
                    ))}
                    {laid.map((item) => {
                      const position = item.kind === "maintenance"
                        ? getTimelineBarPosition(item.start, item.end, days, dayWidth)
                        : getTimelineBarPosition(item.start, item.end, days, dayWidth);
                      if (!position) return null;
                      const style: CSSProperties = {
                        top: 4 + item.lane * LANE_HEIGHT,
                        left: position.left,
                        width: position.right - position.left,
                        borderTopLeftRadius: position.flatLeft ? 0 : 6,
                        borderBottomLeftRadius: position.flatLeft ? 0 : 6,
                        borderTopRightRadius: position.flatRight ? 0 : 6,
                        borderBottomRightRadius: position.flatRight ? 0 : 6,
                      };
                      const barClass = "absolute flex h-[30px] items-center gap-1.5 overflow-hidden px-2 text-left text-xs font-medium whitespace-nowrap";
                      if (item.kind === "maintenance") {
                        const text = `Quarto ${label} em manutenção`;
                        return (
                          <span key="maintenance" role="img" aria-label={text} title={text} className={cx(barClass, "text-fg-2")} style={{ ...style, ...HATCH_STYLE }}>
                            <span aria-hidden="true" className="truncate">Manutenção</span>
                          </span>
                        );
                      }
                      const { reservation } = item;
                      const status = MAP_STATUS[reservation.status] ?? { label: reservation.status, className: "bg-done-bg text-fg-2" };
                      const name = guestName(reservation);
                      const people = 1 + (reservation.guests?.length ?? 0);
                      const description = `${name}, quarto ${label}, ${formatStayPeriod(reservation.checkInDate, reservation.checkOutDate)}, ${status.label}`;
                      return (
                        <button
                          key={reservation.id}
                          type="button"
                          onClick={() => onSelect(reservation)}
                          title={description}
                          aria-label={`${description}. Abrir reserva`}
                          className={cx(barClass, "cursor-pointer hover:brightness-95 focus-visible:z-[2] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg", status.className)}
                          style={style}
                        >
                          <span className="truncate">{name}</span>
                          {item.end - item.start >= 2 && <span className="font-mono text-[11px] opacity-75">{people}p</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
