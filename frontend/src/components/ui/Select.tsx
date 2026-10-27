"use client";

import type { ComponentProps } from "react";
import { ChevronDown } from "lucide-react";
import { useFieldControl } from "./Field";
import { controlClass } from "./Input";
import { cx } from "./cx";

// Select nativo: teclado, leitor de tela e celular já funcionam sem nada a mais.
export default function Select({ className, id, required, children, ...props }: ComponentProps<"select">) {
  const field = useFieldControl();

  return (
    <div className={cx("relative min-w-0", className)}>
      <select
        id={id ?? field?.id}
        required={required ?? field?.required}
        aria-invalid={field?.invalid || undefined}
        aria-describedby={field?.describedBy}
        className={cx(controlClass, "appearance-none pr-9")}
        {...props}
      >
        {children}
      </select>
      <ChevronDown aria-hidden="true" className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-fg-3" />
    </div>
  );
}
