"use client";

import type { ComponentProps, ReactNode } from "react";
import { useFieldControl } from "./Field";
import { cx } from "./cx";

// Caixa comum a Input, Select e ao gatilho do DatePicker.
export const controlClass =
  "h-9 w-full rounded-control border border-border bg-surface px-3 text-[13px] text-fg placeholder:text-fg-3 disabled:cursor-not-allowed disabled:bg-muted disabled:text-fg-2 aria-[invalid=true]:border-danger";

interface InputProps extends ComponentProps<"input"> {
  icon?: ReactNode;
}

// className vale para a caixa de fora, para largura e posição.
export default function Input({ icon, className, id, required, ...props }: InputProps) {
  const field = useFieldControl();

  return (
    <div className={cx("relative min-w-0", className)}>
      {icon && (
        <span aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 flex -translate-y-1/2 text-fg-3 [&_svg]:size-[15px]">
          {icon}
        </span>
      )}
      <input
        id={id ?? field?.id}
        required={required ?? field?.required}
        aria-invalid={field?.invalid || undefined}
        aria-describedby={field?.describedBy}
        className={cx(controlClass, icon ? "pl-9" : undefined)}
        {...props}
      />
    </div>
  );
}
