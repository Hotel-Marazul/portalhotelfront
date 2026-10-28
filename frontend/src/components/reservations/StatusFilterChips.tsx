"use client";

import type { ListStatus } from "../agenda/agenda-data";
import { cx } from "../ui/cx";

const STATUS_STYLE: Record<ListStatus, { label: string; swatch: string }> = {
  Pendente: { label: "Pendente", swatch: "bg-warn-bg shadow-[inset_0_0_0_1px_var(--warn-border)]" },
  Confirmada: { label: "Confirmada", swatch: "bg-accent" },
  EmAndamento: { label: "Hospedado", swatch: "bg-fg" },
  Concluída: { label: "Concluída", swatch: "bg-done-bg shadow-[inset_0_0_0_1px_var(--border)]" },
  Cancelada: { label: "Cancelada", swatch: "bg-danger-bg shadow-[inset_0_0_0_1px_var(--danger)]" },
};

interface Props {
  statuses: readonly ListStatus[];
  selected: readonly ListStatus[];
  onToggle: (status: ListStatus) => void;
  /** Total por status com os outros filtros; null quando a contagem não veio. */
  counts?: Partial<Record<ListStatus, number>> | null;
}

// Filtros que ligam e desligam, cada um com a sua contagem.
export default function StatusFilterChips({ statuses, selected, onToggle, counts }: Props) {
  return (
    <div role="group" aria-label="Filtrar por status" className="flex flex-wrap gap-1.5">
      {statuses.map((status) => {
        const on = selected.includes(status);
        const count = counts?.[status];
        return (
          <button
            key={status}
            type="button"
            aria-pressed={on}
            onClick={() => onToggle(status)}
            className={cx(
              "inline-flex h-[30px] items-center gap-1.5 rounded-full border bg-surface px-2.5 text-[13px] transition-colors",
              on ? "border-fg text-fg" : "border-border text-fg-2 hover:text-fg",
            )}
          >
            <span aria-hidden="true" className={cx("size-2 rounded-[2px]", STATUS_STYLE[status].swatch)} />
            {STATUS_STYLE[status].label}
            {count !== undefined && <span className="font-mono text-xs text-fg-3">{count}</span>}
          </button>
        );
      })}
    </div>
  );
}
