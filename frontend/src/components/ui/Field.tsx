"use client";

import { createContext, useContext, useId, type ReactNode } from "react";
import { cx } from "./cx";

interface FieldControl {
  id: string;
  labelId: string;
  describedBy?: string;
  invalid: boolean;
  required: boolean;
}

const FieldContext = createContext<FieldControl | null>(null);

// Input, Select e DatePicker leem daqui o id, a descrição e o erro do campo em volta.
export function useFieldControl() {
  return useContext(FieldContext);
}

interface FieldProps {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  className?: string;
  children: ReactNode;
}

export default function Field({ label, hint, error, required = false, className, children }: FieldProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const control: FieldControl = {
    id,
    labelId: `${id}-label`,
    describedBy: [hintId, errorId].filter(Boolean).join(" ") || undefined,
    invalid: Boolean(error),
    required,
  };

  return (
    <div className={cx("flex min-w-0 flex-col gap-1.5", className)}>
      <label id={control.labelId} htmlFor={id} className="text-xs font-medium text-fg-3">
        {label}
        {required && <span aria-hidden="true"> *</span>}
      </label>
      <FieldContext.Provider value={control}>{children}</FieldContext.Provider>
      {hint && <p id={hintId} className="m-0 text-xs text-fg-3">{hint}</p>}
      {error && <p id={errorId} className="m-0 text-xs font-medium text-danger">{error}</p>}
    </div>
  );
}
