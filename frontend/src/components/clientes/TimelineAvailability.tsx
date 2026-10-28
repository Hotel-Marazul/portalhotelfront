"use client";

import * as Popover from "@radix-ui/react-popover";
import { useEffect, useState } from "react";
import { BedDouble } from "lucide-react";
import { isValid, startOfDay } from "date-fns";
import apiClient from "../../services/api";
import {
  addReservationCalendarDays,
  formatReservationCalendarDate,
  formatReservationPickerDate,
  parseReservationPickerDate
} from "../../utils/reservation";
import Button, { buttonClasses } from "../ui/Button";
import DatePicker from "../ui/DatePicker";
import Field from "../ui/Field";
import StatusChip from "../ui/StatusChip";
import { roomLabel } from "../agenda/agenda-data";
import type { TimelineRoom } from "./TimelineGrid";

function nextPickerDate(date: Date): Date {
  const nextCalendarDate = addReservationCalendarDays(formatReservationCalendarDate(date), 1);
  return parseReservationPickerDate(formatReservationCalendarDate(nextCalendarDate));
}

// Consulta de quartos livres por período, aberta a partir da barra da Agenda.
export default function TimelineAvailability() {
  const [open, setOpen] = useState(false);
  const [availabilityCheckInDate, setAvailabilityCheckInDate] = useState<Date | null>(() =>
    parseReservationPickerDate(formatReservationCalendarDate(new Date()))
  );
  const [availabilityCheckOutDate, setAvailabilityCheckOutDate] = useState<Date | null>(() =>
    nextPickerDate(parseReservationPickerDate(formatReservationCalendarDate(new Date())))
  );
  const [availableRoomsForDate, setAvailableRoomsForDate] = useState<TimelineRoom[]>([]);
  const [loadingAvailability, setLoadingAvailability] = useState(false);
  const [availabilityError, setAvailabilityError] = useState<string | null>(null);
  const [availabilityRetryNonce, setAvailabilityRetryNonce] = useState(0);

  useEffect(() => {
    if (!availabilityCheckInDate || !availabilityCheckOutDate || !isValid(availabilityCheckInDate) || !isValid(availabilityCheckOutDate)) return;

    const checkIn = startOfDay(availabilityCheckInDate);
    const checkOut = startOfDay(availabilityCheckOutDate);
    if (checkOut <= checkIn) {
      setAvailabilityCheckOutDate(nextPickerDate(checkIn));
    }
  }, [availabilityCheckInDate, availabilityCheckOutDate]);

  useEffect(() => {
    // Só consulta com o painel aberto, para não gastar requisições à toa.
    if (!open) return;
    let cancelled = false;
    setAvailableRoomsForDate([]);
    setAvailabilityError(null);
    setLoadingAvailability(false);
    if (!availabilityCheckInDate || !availabilityCheckOutDate || !isValid(availabilityCheckInDate) || !isValid(availabilityCheckOutDate)) {
      setAvailabilityError("Informe datas válidas para consultar a disponibilidade.");
      return () => { cancelled = true; };
    }

    const checkIn = startOfDay(availabilityCheckInDate);
    const checkOut = startOfDay(availabilityCheckOutDate);

    if (checkOut <= checkIn) {
      setAvailabilityError("Check-out deve ser posterior ao check-in.");
      return () => { cancelled = true; };
    }

    setLoadingAvailability(true);

    apiClient
      .get<TimelineRoom[]>("/api/rooms/availability", {
        params: {
          checkIn: formatReservationPickerDate(checkIn),
          checkOut: formatReservationPickerDate(checkOut),
          guestCount: 1
        }
      })
      .then((response) => {
        if (cancelled) return;
        setAvailableRoomsForDate(Array.isArray(response.data) ? response.data : []);
      })
      .catch(() => {
        if (cancelled) return;
        setAvailableRoomsForDate([]);
        setAvailabilityError("Não foi possível consultar disponibilidade.");
      })
      .finally(() => {
        if (!cancelled) setLoadingAvailability(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, availabilityCheckInDate, availabilityCheckOutDate, availabilityRetryNonce]);

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger className={buttonClasses("outline")}>
        <BedDouble aria-hidden="true" />
        Quartos livres
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={6}
          aria-label="Consultar quartos disponíveis por período"
          className="z-[1300] flex w-[min(360px,calc(100vw-32px))] flex-col gap-3 rounded-block border border-border-soft bg-surface p-4 text-fg shadow-sheet"
        >
          <h2 className="m-0 text-[15px] font-semibold">Quartos livres no período</h2>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Entrada">
              <DatePicker value={availabilityCheckInDate} onChange={setAvailabilityCheckInDate} />
            </Field>
            <Field label="Saída">
              <DatePicker
                value={availabilityCheckOutDate}
                onChange={setAvailabilityCheckOutDate}
                minDate={availabilityCheckInDate ? nextPickerDate(startOfDay(availabilityCheckInDate)) : undefined}
              />
            </Field>
          </div>
          <div role="status" aria-live="polite" className="flex flex-col gap-2">
            <p className="m-0 text-[13px] text-fg-2">
              {loadingAvailability
                ? "Consultando quartos disponíveis..."
                : availabilityError
                  ? "Disponibilidade indisponível."
                  : <>Quartos disponíveis: <span className="font-mono">{availableRoomsForDate.length}</span></>}
            </p>
            {availabilityError ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-danger">{availabilityError}</span>
                <Button size="sm" variant="ghost" onClick={() => setAvailabilityRetryNonce((value) => value + 1)} disabled={loadingAvailability}>
                  Tentar novamente
                </Button>
              </div>
            ) : availableRoomsForDate.length > 0 ? (
              <ul className="m-0 flex max-h-40 list-none flex-wrap gap-1.5 overflow-auto p-0">
                {availableRoomsForDate.map((room) => (
                  <li key={room.id}>
                    <StatusChip tone="accent"><span className="font-mono">{roomLabel(room)}</span>&nbsp;· {room.type}</StatusChip>
                  </li>
                ))}
              </ul>
            ) : (
              !loadingAvailability && <span className="text-xs text-fg-3">Nenhum quarto livre para o período selecionado.</span>
            )}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
