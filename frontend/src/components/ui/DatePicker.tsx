"use client";

import * as Popover from "@radix-ui/react-popover";
import { format } from "date-fns";
import { CalendarDays } from "lucide-react";
import { useId, useState } from "react";
import { DayPicker, type Matcher } from "react-day-picker";
import { ptBR } from "react-day-picker/locale";
import { useFieldControl } from "./Field";
import { controlClass } from "./Input";
import { cx } from "./cx";

interface DatePickerProps {
  value: Date | null;
  onChange: (date: Date | null) => void;
  minDate?: Date;
  maxDate?: Date;
  placeholder?: string;
  disabled?: boolean;
  id?: string;
  // Fora de um Field, o nome do campo vem daqui.
  "aria-label"?: string;
  className?: string;
}

// O dia é estilizado pelos atributos data-* que o DayPicker põe na célula, sem o CSS da biblioteca.
const dayButtonClass = [
  "grid size-9 place-items-center rounded-control font-mono text-[13px] text-fg transition-colors hover:bg-muted",
  "disabled:cursor-not-allowed disabled:text-fg-3 disabled:opacity-50 disabled:hover:bg-transparent",
  "[[data-outside]>&]:text-fg-3",
  "[[data-today]:not([data-selected])>&]:font-semibold [[data-today]:not([data-selected])>&]:text-accent",
  "[[data-selected]>&]:bg-accent [[data-selected]>&]:text-on-dark [[data-selected]>&]:hover:bg-accent-700",
].join(" ");

const navButtonClass = "grid size-8 place-items-center rounded-control text-fg-2 hover:bg-muted hover:text-fg disabled:opacity-40 disabled:hover:bg-transparent";

export default function DatePicker({ value, onChange, minDate, maxDate, placeholder = "dd/mm/aaaa", disabled, id, "aria-label": ariaLabel, className }: DatePickerProps) {
  const field = useFieldControl();
  const valueId = useId();
  const [open, setOpen] = useState(false);
  const disabledDays: Matcher[] = [];
  if (minDate) disabledDays.push({ before: minDate });
  if (maxDate) disabledDays.push({ after: maxDate });

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        id={id ?? field?.id}
        disabled={disabled}
        aria-label={field ? undefined : ariaLabel}
        // O leitor de tela lê o rótulo do Field e a data escolhida.
        aria-labelledby={field ? `${field.labelId} ${valueId}` : undefined}
        aria-describedby={field?.describedBy}
        aria-invalid={field?.invalid || undefined}
        className={cx(controlClass, "flex items-center justify-between gap-2 text-left", className)}
      >
        <span id={valueId} className={cx("font-mono", !value && "text-fg-3")}>
          {value ? format(value, "dd/MM/yyyy") : placeholder}
        </span>
        <CalendarDays aria-hidden="true" className="size-4 shrink-0 text-fg-3" />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align="start" sideOffset={6} className="z-[1400] rounded-block border border-border-soft bg-surface p-3 text-fg shadow-sheet">
          <DayPicker
            mode="single"
            locale={ptBR}
            selected={value ?? undefined}
            defaultMonth={value ?? minDate}
            disabled={disabledDays}
            autoFocus
            onSelect={(date) => {
              onChange(date ?? null);
              setOpen(false);
            }}
            classNames={{
              root: "relative text-[13px]",
              months: "flex gap-4",
              month: "flex flex-col gap-2",
              month_caption: "flex h-8 items-center px-1",
              caption_label: "font-medium first-letter:uppercase",
              nav: "absolute top-0 right-0 flex gap-1",
              button_previous: navButtonClass,
              button_next: navButtonClass,
              chevron: "size-4 fill-current",
              month_grid: "border-collapse",
              weekday: "size-9 text-xs font-medium text-fg-3",
              day: "p-0 text-center",
              day_button: dayButtonClass,
              hidden: "invisible",
            }}
          />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
