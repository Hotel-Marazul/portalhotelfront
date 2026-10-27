import type { ReactNode } from "react";
import type { ReservationStatus } from "../../types/reservations";
import { cx } from "./cx";

// Tons por luminosidade, não só por cor: escuro, destaque, claro com texto escuro e cinza.
export type ChipTone = "neutral" | "accent" | "dark" | "warn" | "danger" | "done";

const TONES: Record<ChipTone, string> = {
  neutral: "bg-muted text-fg-2",
  accent: "bg-accent-100 text-accent-700",
  dark: "bg-fg text-on-dark",
  warn: "bg-warn-bg text-warn-fg",
  danger: "bg-danger-bg text-danger",
  done: "bg-done-bg text-fg-2",
};

interface StatusChipProps {
  tone?: ChipTone;
  className?: string;
  children: ReactNode;
}

export default function StatusChip({ tone = "neutral", className, children }: StatusChipProps) {
  return (
    <span className={cx("inline-flex h-[22px] items-center whitespace-nowrap rounded-bar px-2 text-xs font-medium", TONES[tone], className)}>
      {children}
    </span>
  );
}

const RESERVATION_STATUS: Record<ReservationStatus, { tone: ChipTone; label: string }> = {
  Pendente: { tone: "warn", label: "Pendente" },
  Confirmada: { tone: "accent", label: "Confirmada" },
  EmAndamento: { tone: "dark", label: "Hospedada" },
  Concluída: { tone: "done", label: "Concluída" },
  Concluida: { tone: "done", label: "Concluída" },
  Cancelada: { tone: "danger", label: "Cancelada" },
};

export function ReservationStatusChip({ status, className }: { status: ReservationStatus; className?: string }) {
  const config = RESERVATION_STATUS[status] ?? { tone: "neutral" as const, label: status };
  return <StatusChip tone={config.tone} className={className}>{config.label}</StatusChip>;
}
