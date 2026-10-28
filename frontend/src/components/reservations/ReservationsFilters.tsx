"use client";

import * as Popover from "@radix-ui/react-popover";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import { formatDayMonth } from "../../utils/format";
import { formatReservationPickerDate, parseReservationPickerDate } from "../../utils/reservation";
import { LIST_STATUSES, type ListStatus } from "../agenda/agenda-data";
import Button, { buttonClasses } from "../ui/Button";
import DatePicker from "../ui/DatePicker";
import Field from "../ui/Field";
import Input from "../ui/Input";
import StatusFilterChips from "./StatusFilterChips";

const SEARCH_DELAY = 400;

interface Props {
  search: string;
  /** Chamado depois de uma pausa na digitação, para não consultar a cada tecla. */
  onSearchChange: (text: string) => void;
  checkInFrom?: string;
  checkInTo?: string;
  onPeriodChange: (from: string | undefined, to: string | undefined) => void;
  statuses: readonly ListStatus[];
  onToggleStatus: (status: ListStatus) => void;
  counts?: Partial<Record<ListStatus, number>> | null;
}

function periodLabel(from?: string, to?: string) {
  if (from && to) return `Entrada: ${formatDayMonth(from)} – ${formatDayMonth(to)}`;
  if (from) return `Entrada: a partir de ${formatDayMonth(from)}`;
  if (to) return `Entrada: até ${formatDayMonth(to)}`;
  return "Entrada: qualquer data";
}

export default function ReservationsFiltersComponent({
  search,
  onSearchChange,
  checkInFrom,
  checkInTo,
  onPeriodChange,
  statuses,
  onToggleStatus,
  counts,
}: Props) {
  const [text, setText] = useState(search);
  const lastSent = useRef(search);
  useEffect(() => {
    if (text === lastSent.current) return;
    const timer = window.setTimeout(() => {
      lastSent.current = text;
      onSearchChange(text);
    }, SEARCH_DELAY);
    return () => window.clearTimeout(timer);
  }, [text, onSearchChange]);

  const [periodOpen, setPeriodOpen] = useState(false);
  const fromDate = checkInFrom ? parseReservationPickerDate(checkInFrom) : null;
  const toDate = checkInTo ? parseReservationPickerDate(checkInTo) : null;

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-2">
      <Input
        type="search"
        aria-label="Buscar por hóspede ou quarto"
        placeholder="Hóspede ou número do quarto"
        icon={<Search />}
        value={text}
        onChange={(event) => setText(event.target.value)}
        className="w-full min-[600px]:w-[280px]"
      />
      <Popover.Root open={periodOpen} onOpenChange={setPeriodOpen}>
        <Popover.Trigger className={buttonClasses("outline", "md", "font-normal text-[13px]")}>
          {periodLabel(checkInFrom, checkInTo)}
          <ChevronDown aria-hidden="true" className="text-fg-3" />
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            align="start"
            sideOffset={6}
            aria-label="Período de entrada"
            className="z-[1300] flex w-[min(340px,calc(100vw-32px))] flex-col gap-3 rounded-block border border-border-soft bg-surface p-4 text-fg shadow-sheet"
          >
            <div className="grid grid-cols-2 gap-2">
              <Field label="Entrada a partir de">
                <DatePicker
                  value={fromDate}
                  maxDate={toDate ?? undefined}
                  onChange={(date) => onPeriodChange(date ? formatReservationPickerDate(date) : undefined, checkInTo)}
                />
              </Field>
              <Field label="Entrada até">
                <DatePicker
                  value={toDate}
                  minDate={fromDate ?? undefined}
                  onChange={(date) => onPeriodChange(checkInFrom, date ? formatReservationPickerDate(date) : undefined)}
                />
              </Field>
            </div>
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="ghost" disabled={!checkInFrom && !checkInTo} onClick={() => onPeriodChange(undefined, undefined)}>Qualquer data</Button>
              <Button size="sm" onClick={() => setPeriodOpen(false)}>Fechar</Button>
            </div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
      <span aria-hidden="true" className="mx-1 hidden h-[22px] w-px bg-border-soft min-[600px]:block" />
      <StatusFilterChips statuses={LIST_STATUSES} selected={statuses} onToggle={onToggleStatus} counts={counts} />
    </div>
  );
}
