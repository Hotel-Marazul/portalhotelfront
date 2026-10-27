"use client";

import * as SwitchPrimitive from "@radix-ui/react-switch";
import { useId, type ReactNode } from "react";
import { cx } from "./cx";

interface SwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: ReactNode;
  disabled?: boolean;
  className?: string;
}

// O rótulo faz parte do alvo de clique, para o controle pequeno do desenho ser fácil de acertar.
export default function Switch({ checked, onCheckedChange, label, disabled, className }: SwitchProps) {
  const id = useId();

  return (
    <span className={cx("inline-flex min-h-9 items-center gap-2 text-[13px] text-fg", disabled && "opacity-50", className)}>
      <SwitchPrimitive.Root
        id={id}
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        className="inline-flex h-4 w-7 shrink-0 items-center rounded-full bg-fg-3 p-0.5 transition-colors disabled:cursor-not-allowed data-[state=checked]:bg-accent"
      >
        <SwitchPrimitive.Thumb className="size-3 rounded-full bg-on-dark transition-transform data-[state=checked]:translate-x-3" />
      </SwitchPrimitive.Root>
      <label htmlFor={id} className={cx("cursor-pointer", disabled && "cursor-not-allowed")}>{label}</label>
    </span>
  );
}
