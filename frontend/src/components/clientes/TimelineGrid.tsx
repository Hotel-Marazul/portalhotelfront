import { useEffect, useState } from "react";
import type { ReservationDto } from "../../types/reservations";
import {
  addReservationCalendarDays,
  formatReservationCalendarDate,
  formatReservationDisplayDate,
  parseReservationDate,
} from "../../utils/reservation";
import { normalizeOperationalRoomStatus } from "../../utils/roomStatus";
import { assignTimelineLanes, getTimelineRange } from "./timeline-layout";
import styles from "./timeline.module.css";

export interface TimelineRoom {
  id: string; number: number; categoryId: string; type: string; capacity: number;
  status: string; price: number; singlePrice?: number | null; couplePrice?: number | null;
}
export const timelineStatus: Record<string, { label: string; tone: string }> = {
  Confirmada: { label: "Confirmada", tone: "confirmed" },
  Pendente: { label: "Pendente", tone: "pending" },
  EmAndamento: { label: "Em andamento", tone: "inProgress" },
  Concluída: { label: "Concluída", tone: "completed" },
  Concluida: { label: "Concluída", tone: "completed" },
  Cancelada: { label: "Cancelada", tone: "cancelled" },
};
export const guestName = (reservation: ReservationDto) => reservation.client?.fullName || reservation.client?.name || "Hóspede não informado";

function sameReservationDay(left: Date, right: Date) {
  return formatReservationCalendarDate(left) === formatReservationCalendarDate(right);
}

function reservationDayOfWeek(date: Date) {
  const [year, month, day] = formatReservationCalendarDate(date).split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

interface Props {
  rooms: TimelineRoom[]; reservations: ReservationDto[]; start: Date; days: number;
  onSelect: (reservation: ReservationDto) => void;
}
export default function TimelineGrid({ rooms, reservations, start, days, onSelect }: Props) {
  const [today, setToday] = useState<Date | null>(null);
  useEffect(() => { setToday(parseReservationDate(formatReservationCalendarDate(new Date()))); }, []);
  const dates = Array.from({ length: days }, (_, i) => addReservationCalendarDays(start, i));
  if (!rooms.length) return <div className={styles.empty} role="status">Nenhum quarto encontrado. Ajuste os filtros ou cadastre um quarto.</div>;
  return <div className={styles.scroll} role="region" aria-label="Mapa de reservas por quarto e dia" tabIndex={0} aria-describedby="timeline-help">
    <table className={styles.grid} style={{ width: `calc(var(--room-width) + ${days} * var(--day-width))` }}>
      <caption className={styles.srOnly}>Reservas de {formatReservationDisplayDate(start, { day: "2-digit", month: "2-digit", year: "numeric" })} a {formatReservationDisplayDate(addReservationCalendarDays(start, days - 1), { day: "2-digit", month: "2-digit", year: "numeric" })}. O dia de saída não ocupa uma diária.</caption>
      <colgroup><col style={{ width: "var(--room-width)" }} />{dates.map(day => <col key={day.toISOString()} style={{ width: "var(--day-width)" }} />)}</colgroup>
      <thead><tr><th scope="col" className={styles.roomHeading}>Quarto <span>Categoria e capacidade</span></th>
        {dates.map(day => <th scope="col" key={day.toISOString()} className={(today && sameReservationDay(day, today)) ? styles.today : undefined}>
          <span>{(today && sameReservationDay(day, today)) ? "Hoje" : formatReservationDisplayDate(day, { weekday: "short" })}</span><strong>{formatReservationDisplayDate(day, { day: "2-digit" })}</strong>
        </th>)}
      </tr></thead>
      <tbody>{rooms.map(room => {
        const stays = assignTimelineLanes(reservations.filter(r => (r.room?.id || r.roomId) === room.id).flatMap(reservation => {
          const range = getTimelineRange(reservation.checkInDate, reservation.checkOutDate, formatReservationCalendarDate(start), days);
          return range ? [{ ...range, reservation }] : [];
        }));
        const laneCount = Math.max(1, ...stays.map(stay => stay.lane + 1));
        return <tr key={room.id}>
          <th scope="row" className={styles.roomHeading}>
            <strong>{String(room.number).padStart(2, "0")}</strong><span>{room.type} · {room.capacity} pessoa(s)</span>
            {normalizeOperationalRoomStatus(room.status) === "Manutencao" && <span className={styles.maintenance}>Manutenção</span>}
          </th>
          <td colSpan={days} className={styles.trackCell}>
            <div className={styles.track} style={{ height: `${laneCount * 64 + 16}px` }}>
              <div className={styles.dayBackgrounds} aria-hidden="true">{dates.map(day => <div key={day.toISOString()} className={(today && sameReservationDay(day, today)) ? styles.todayColumn : [0, 6].includes(reservationDayOfWeek(day)) ? styles.weekend : undefined} />)}</div>
              {stays.map(({ reservation, start: from, end, lane }) => {
                const status = timelineStatus[reservation.status] || { label: reservation.status, tone: "completed" };
                const datesLabel = `${formatReservationDisplayDate(reservation.checkInDate, { day: "2-digit", month: "2-digit" })} a ${formatReservationDisplayDate(reservation.checkOutDate, { day: "2-digit", month: "2-digit" })}`;
                return <button key={reservation.id} type="button" className={`${styles.reservation} ${styles[status.tone]}`}
                  style={{ left: `calc(${from / days * 100}% + 4px)`, width: `calc(${(end - from) / days * 100}% - 8px)`, top: `${lane * 64 + 8}px` }}
                  onClick={() => onSelect(reservation)} title={`${guestName(reservation)} · ${status.label} · ${datesLabel}`}
                  aria-label={`${guestName(reservation)}, quarto ${room.number}, ${status.label}, ${datesLabel}. Abrir detalhes da reserva`}>
                  <strong>{guestName(reservation)}</strong><span>{status.label} · {datesLabel}</span>
                </button>;
              })}
            </div>
          </td>
        </tr>;
      })}</tbody>
    </table>
  </div>;
}
