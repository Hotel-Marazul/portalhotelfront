"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import type { ReservationDto } from "../../types/reservations";
import { calculateNights, formatCurrency, formatNights, formatReservationId, formatStayPeriod } from "../../utils/format";
import Button from "../ui/Button";
import { ReservationStatusChip } from "../ui/StatusChip";

interface ReservationsTableProps {
  reservations: ReservationDto[];
  status: "loading" | "error" | "ready";
  error?: string | null;
  /** Mensagem quando a consulta não tem resultado. */
  empty: string;
  total: number;
  /** Página atual, começando em 0. */
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onOpen: (reservation: ReservationDto) => void;
  onRetry?: () => void;
}

const thClass = "sticky top-0 z-[1] bg-surface py-2.5 text-left text-xs font-medium text-fg-3";

function roomNumber(reservation: ReservationDto) {
  return reservation.room?.displayNumber ?? (reservation.room?.number !== undefined ? String(reservation.room.number) : "—");
}

export default function ReservationsTable({ reservations, status, error, empty, total, page, pageSize, onPageChange, onOpen, onRetry }: ReservationsTableProps) {
  const first = total === 0 ? 0 : page * pageSize + 1;
  const last = Math.min(total, (page + 1) * pageSize);
  const lastPage = Math.max(0, Math.ceil(total / pageSize) - 1);

  return (
    <>
      <div className="min-h-[240px] flex-1 overflow-auto border-t border-rule">
        {status === "loading" ? (
          <div aria-busy="true" className="flex flex-col gap-2 pt-3">
            <span className="sr-only">Carregando reservas</span>
            {[0, 1, 2, 3, 4].map((row) => <span key={row} aria-hidden="true" className="h-10 animate-pulse rounded-bar bg-muted" />)}
          </div>
        ) : status === "error" ? (
          <div role="alert" className="flex flex-wrap items-center gap-3 py-6 text-[13px] text-danger">
            {error}
            {onRetry && <Button size="sm" onClick={onRetry}>Tentar novamente</Button>}
          </div>
        ) : reservations.length === 0 ? (
          <p className="m-0 py-6 text-[13px] text-fg-3">{empty}</p>
        ) : (
          <table className="w-full min-w-[760px] border-collapse" aria-label="Lista de reservas">
            <thead>
              <tr>
                <th scope="col" className={thClass}>Código</th>
                <th scope="col" className={thClass}>Hóspede</th>
                <th scope="col" className={thClass}>Quarto</th>
                <th scope="col" className={thClass}>Período</th>
                <th scope="col" className={thClass}>Status</th>
                <th scope="col" className={`${thClass} text-right`}>Total</th>
                <th scope="col" className={thClass}><span className="sr-only">Ação</span></th>
              </tr>
            </thead>
            <tbody>
              {reservations.map((reservation) => {
                const name = reservation.client?.fullName ?? reservation.client?.name ?? "Hóspede não informado";
                const people = 1 + (reservation.guests?.length ?? 0);
                const nights = calculateNights(reservation.checkInDate, reservation.checkOutDate);
                return (
                  <tr key={reservation.id} className="border-t border-rule">
                    <td className="py-2.5 pr-3 font-mono text-[13px] text-fg-2">{formatReservationId(reservation.id)}</td>
                    <td className="py-2.5 pr-3">
                      <span className="flex flex-col">
                        <span className="font-medium">{name}</span>
                        <span className="text-xs text-fg-3">{reservation.detailsPending ? "Ocupação a definir no check-in" : `${people} ${people === 1 ? "pessoa" : "pessoas"}`}</span>
                      </span>
                    </td>
                    <td className="py-2.5 pr-3">
                      <span className="flex flex-col">
                        <span className="font-mono text-[13px]">{roomNumber(reservation)}</span>
                        {reservation.room?.type && <span className="text-xs text-fg-3">{reservation.room.type}</span>}
                      </span>
                    </td>
                    <td className="py-2.5 pr-3">
                      <span className="flex flex-col">
                        <span className="font-mono text-[13px]">{formatStayPeriod(reservation.checkInDate, reservation.checkOutDate)}</span>
                        <span className="text-xs text-fg-3">{formatNights(nights)}</span>
                      </span>
                    </td>
                    <td className="py-2.5 pr-3"><ReservationStatusChip status={reservation.status} /></td>
                    <td className="py-2.5 text-right font-mono text-[13px]">
                      {reservation.detailsPending ? "A definir" : typeof reservation.totalPrice === "number" ? formatCurrency(reservation.totalPrice) : "—"}
                    </td>
                    <td className="py-2.5 pl-4 text-right">
                      <Button size="sm" onClick={() => onOpen(reservation)} aria-label={`Abrir reserva de ${name}`}>Abrir</Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      <div className="flex shrink-0 items-center justify-between gap-3 text-[13px] text-fg-3">
        <span aria-live="polite">
          {status === "ready" && (total > 0
            ? <><span className="font-mono">{first}–{last}</span> de <span className="font-mono">{total}</span> {total === 1 ? "reserva" : "reservas"}</>
            : "Nenhuma reserva")}
        </span>
        <span className="inline-flex gap-1">
          <Button size="sm" className="w-8 px-0" aria-label="Página anterior" disabled={status !== "ready" || page === 0} onClick={() => onPageChange(page - 1)}>
            <ChevronLeft aria-hidden="true" />
          </Button>
          <Button size="sm" className="w-8 px-0" aria-label="Próxima página" disabled={status !== "ready" || page >= lastPage} onClick={() => onPageChange(page + 1)}>
            <ChevronRight aria-hidden="true" />
          </Button>
        </span>
      </div>
    </>
  );
}
