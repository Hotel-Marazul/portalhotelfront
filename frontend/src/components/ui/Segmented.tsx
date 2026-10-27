"use client";

import * as ToggleGroup from "@radix-ui/react-toggle-group";
import type { ReactNode } from "react";
import { cx } from "./cx";

export interface SegmentedOption<T extends string> {
  value: T;
  label: ReactNode;
  count?: number;
  disabled?: boolean;
}

interface SegmentedProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  options: SegmentedOption<T>[];
  label: string;
  className?: string;
}

// Trilho em --muted: o texto fora da seleção usa --fg-2, porque --fg-3 não passa de 4,5:1 sobre ele.
export const trackClass = "inline-flex rounded-control bg-muted p-[3px]";
export const trackItemClass =
  "inline-flex min-h-[30px] items-center gap-1.5 rounded-bar px-3 text-[13px] text-fg-2 transition-colors hover:text-fg disabled:cursor-not-allowed disabled:opacity-50 data-[state=active]:bg-surface data-[state=active]:font-medium data-[state=active]:text-fg data-[state=active]:shadow-tab data-[state=on]:bg-surface data-[state=on]:font-medium data-[state=on]:text-fg data-[state=on]:shadow-tab";

export default function Segmented<T extends string>({ value, onChange, options, label, className }: SegmentedProps<T>) {
  return (
    <ToggleGroup.Root
      type="single"
      value={value}
      aria-label={label}
      // Clicar no item já escolhido devolve "": a escolha atual continua.
      onValueChange={(next) => { if (next) onChange(next as T); }}
      className={cx(trackClass, className)}
    >
      {options.map((option) => (
        <ToggleGroup.Item key={option.value} value={option.value} disabled={option.disabled} className={trackItemClass}>
          {option.label}
          {option.count !== undefined && <span className="font-mono">{option.count}</span>}
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  );
}
