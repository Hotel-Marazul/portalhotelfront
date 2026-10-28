"use client";

import { useState } from "react";
import apiClient from "../../services/api";
import type { ReservationDto } from "../../types/reservations";
import { apiErrorMessage } from "../../utils/api-error";
import { formatStayPeriod } from "../../utils/format";
import { getIdempotencyAttempt, type IdempotencyAttempt } from "../../utils/idempotency";
import { addReservationCalendarDays, formatReservationCalendarDate, toReservationCalendarDate } from "../../utils/reservation";
import Button from "../ui/Button";
import ConfirmDialog from "../ui/ConfirmDialog";
import Sheet from "../ui/Sheet";
import { toast } from "../ui/Toast";
import { roomLabel } from "./agenda-data";
import { buildMovePayload, type Gap, type GapNeighbor } from "./gaps";

interface GapRoomInfo {
  id: string;
  number: number;
  displayNumber?: string;
  capacity: number;
  categoryId: string;
  type: string;
}

interface GapSheetProps {
  gap: Gap<ReservationDto> | null;
  rooms: GapRoomInfo[];
  periodStart: string;
  onClose: () => void;
  onOpenReservation: (reservation: ReservationDto) => void;
  /** Depois de mover (ou de a reserva ter mudado), o mapa recarrega. */
  onMoved: () => void;
}

const guest = (reservation: ReservationDto) => reservation.client?.fullName || reservation.client?.name || "Hóspede";
const nightsText = (nights: number) => `${nights} ${nights === 1 ? "noite" : "noites"}`;
const neighborName = (neighbor: GapNeighbor) => (neighbor.kind === "maintenance" ? "a manutenção" : guest(neighbor.reservation as ReservationDto));

export default function GapSheet({ gap, rooms, periodStart, onClose, onOpenReservation, onMoved }: GapSheetProps) {
  const [confirming, setConfirming] = useState<ReservationDto | null>(null);
  const [moving, setMoving] = useState(false);
  const [attempt, setAttempt] = useState<IdempotencyAttempt | null>(null);

  const room = gap ? rooms.find((item) => item.id === gap.roomId) : undefined;
  const roomOf = (reservation: ReservationDto) => rooms.find((item) => item.id === (reservation.room?.id || reservation.roomId));
  const day = (offset: number) => formatReservationCalendarDate(addReservationCalendarDays(periodStart, offset));

  async function move(reservation: ReservationDto) {
    const origin = roomOf(reservation);
    if (!gap || !room || !origin) return;
    setMoving(true);
    try {
      // O mapa pode estar desatualizado: o detalhe traz version, hóspedes e preço atuais.
      const { data: detail } = await apiClient.get<ReservationDto>(`/api/reservations/${reservation.id}`);
      const payload = buildMovePayload(
        detail,
        { id: room.id, categoryId: room.categoryId, label: roomLabel(room) },
        { categoryId: origin.categoryId, label: roomLabel(origin) },
      );
      const next = getIdempotencyAttempt(attempt, payload);
      setAttempt(next);
      await apiClient.put(`/api/reservations/${reservation.id}`, { ...payload, idempotencyKey: next.key });
      setAttempt(null);
      toast.success(`${guest(reservation)} foi para o ${roomLabel(room)}. O ${roomLabel(origin)} ficou livre nessas datas.`);
      setConfirming(null);
      onMoved();
      onClose();
    } catch (error) {
      toast.error(apiErrorMessage(error, "Não foi possível mover a reserva."));
      setConfirming(null);
      onMoved();
    } finally {
      setMoving(false);
    }
  }

  const confirmingOrigin = confirming ? roomOf(confirming) : undefined;
  const sameCategory = Boolean(room && confirmingOrigin && room.categoryId === confirmingOrigin.categoryId);

  return (
    <>
      <Sheet
        open={Boolean(gap && room)}
        onOpenChange={(open) => { if (!open) onClose(); }}
        title={gap && room ? `${roomLabel(room)} livre de ${formatStayPeriod(day(gap.start), day(gap.end))}` : "Brecha"}
        description={gap && room
          ? `Brecha de ${nightsText(gap.nights)} · ${room.type}, até ${room.capacity} ${room.capacity === 1 ? "pessoa" : "pessoas"} · entre ${neighborName(gap.before)} e ${neighborName(gap.after)}`
          : undefined}
      >
        {gap && room && (gap.candidates.length > 0 ? (
          <section aria-labelledby="brecha-cabe" className="flex flex-col gap-3">
            <h3 id="brecha-cabe" className="m-0 text-[13px] font-semibold text-fg-2">Cabe aqui</h3>
            {gap.candidates.map((reservation) => {
              const origin = roomOf(reservation);
              const people = 1 + (reservation.guests?.length ?? 0);
              const exact = toReservationCalendarDate(reservation.checkInDate) === day(gap.start) && toReservationCalendarDate(reservation.checkOutDate) === day(gap.end);
              return (
                <article key={reservation.id} className="flex flex-col gap-2.5 rounded-block border border-rule p-3.5">
                  <div className="flex items-baseline justify-between gap-3">
                    <strong className="font-semibold">{guest(reservation)}</strong>
                    <span className="text-xs text-fg-3">{people} {people === 1 ? "pessoa" : "pessoas"}</span>
                  </div>
                  <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[13px]">
                    <dt className="text-fg-3">Hoje</dt>
                    <dd className="m-0">{origin ? `${roomLabel(origin)} · ${origin.type}, até ${origin.capacity}` : "—"}</dd>
                    <dt className="text-fg-3">Datas</dt>
                    <dd className="m-0">{formatStayPeriod(reservation.checkInDate, reservation.checkOutDate)}{exact ? " · mesmas datas" : ""}</dd>
                  </dl>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="accent" disabled={moving} onClick={() => setConfirming(reservation)}>Mover para o {roomLabel(room)}</Button>
                    <Button size="sm" variant="ghost" onClick={() => onOpenReservation(reservation)}>Ver reserva</Button>
                  </div>
                </article>
              );
            })}
          </section>
        ) : (
          <p className="m-0 text-[13px] text-fg-2">Nenhuma reserva do período cabe nesta brecha.</p>
        ))}
      </Sheet>

      <ConfirmDialog
        open={Boolean(confirming)}
        onOpenChange={(open) => { if (!open && !moving) setConfirming(null); }}
        title={confirming && room ? `Mover ${guest(confirming)} para o ${roomLabel(room)}?` : "Mover reserva"}
        description={sameCategory
          ? "Mesma categoria: só o quarto muda. Avise o hóspede da troca."
          : "Outra categoria: a diária que o hóspede reservou é mantida como diária manual, com o motivo da troca. Avise o hóspede."}
        confirmLabel="Mover"
        busy={moving}
        onConfirm={() => { if (confirming) void move(confirming); }}
      />
    </>
  );
}
