import type { ReactNode } from "react";
import { cx } from "./cx";

/** Linha de indicadores sem cartões: divisórias entre eles, régua em cima e embaixo. */
export function KpiRow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <dl className={cx("m-0 grid shrink-0 grid-cols-[repeat(auto-fit,minmax(130px,1fr))] overflow-hidden border-y border-rule", className)}>
      {children}
    </dl>
  );
}

export type KpiStatus = "loading" | "error" | "ready";
export type KpiTone = "neutral" | "accent" | "warn" | "danger";

const NOTE_TONES: Record<KpiTone, string> = {
  neutral: "text-fg-3",
  accent: "text-accent",
  warn: "text-warn",
  danger: "text-danger",
};

interface KpiProps {
  label: ReactNode;
  status: KpiStatus;
  value?: ReactNode;
  note?: ReactNode;
  noteTone?: KpiTone;
  /** Texto curto no lugar do valor quando a rota falha. */
  errorText?: string;
}

// Enquanto carrega, um bloco cinza; se a rota falha, a mensagem de erro. Nunca zero no lugar.
export function Kpi({ label, status, value, note, noteTone = "neutral", errorText = "Não foi possível carregar" }: KpiProps) {
  return (
    <div className="-ml-px flex flex-col-reverse gap-1 border-l border-rule py-4 pl-5">
      <dt className="text-[13px] text-fg-3">{label}</dt>
      <dd className="m-0 min-h-8 text-2xl font-medium tracking-[-0.02em]">
        {status === "loading" && (
          <>
            <span aria-hidden="true" className="mt-1 block h-6 w-14 animate-pulse rounded-bar bg-muted" />
            <span className="sr-only">Carregando</span>
          </>
        )}
        {status === "error" && <span className="text-[13px] font-normal tracking-normal text-danger">{errorText}</span>}
        {status === "ready" && (
          <>
            {value}
            {note && <span className={cx("ml-1.5 text-xs font-normal tracking-normal", NOTE_TONES[noteTone])}>{note}</span>}
          </>
        )}
      </dd>
    </div>
  );
}
