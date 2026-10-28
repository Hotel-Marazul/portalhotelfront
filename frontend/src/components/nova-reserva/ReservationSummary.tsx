"use client";

import type { ReactNode } from "react";
import type { ReservationPricingDto } from "../../types/reservations";
import { formatCurrency } from "../../utils/format";
import { cx } from "../ui/cx";

interface ReservationSummaryProps {
  rows: Array<{ label: string; value: ReactNode }>;
  pricing: ReservationPricingDto | null;
  pricingPending: boolean;
  pricingError: string | null;
  checks: Array<{ tone: "ok" | "warn"; text: string }>;
  children?: ReactNode;
}

const RATE_LABEL = { single: "solteiro", couple: "casal" } as const;

// Tudo que aparece em valores vem do `quote` do backend.
export default function ReservationSummary({ rows, pricing, pricingPending, pricingError, checks, children }: ReservationSummaryProps) {
  return (
    <aside aria-labelledby="nova-reserva-resumo" className="flex flex-col gap-4 rounded-block bg-bg p-4 md:min-h-0 md:overflow-y-auto md:rounded-none md:border-l md:border-rule md:p-5">
      <h2 id="nova-reserva-resumo" className="m-0 text-[15px] font-semibold">Resumo</h2>
      <dl className="m-0 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-2 text-[13px]">
        {rows.map((row) => (
          <div key={row.label} className="contents">
            <dt className="text-fg-3">{row.label}</dt>
            <dd className="m-0 min-w-0 truncate text-right">{row.value}</dd>
          </div>
        ))}
      </dl>

      <div className="flex flex-col gap-2 border-t border-border-soft pt-3" role="status" aria-live="polite">
        {pricingError ? (
          <p role="alert" className="m-0 text-[13px] text-danger">{pricingError}</p>
        ) : pricing ? (
          <>
            <dl className="m-0 grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1.5 text-[13px]">
              <dt className="text-fg-2">
                Diária {pricing.priceSource === "manual" ? "aplicada" : RATE_LABEL[pricing.rateType]} · <span className="font-mono">{pricing.nights}</span> {pricing.nights === 1 ? "noite" : "noites"}
              </dt>
              <dd className="m-0 text-right font-mono">{formatCurrency(pricing.dailyRate)}</dd>
              {pricing.additionalDailyTotal > 0 && (
                <>
                  <dt className="text-fg-2">Adicionais por diária</dt>
                  <dd className="m-0 text-right font-mono">{formatCurrency(pricing.additionalDailyTotal)}</dd>
                </>
              )}
              {(pricing.additionalStayTotal ?? 0) > 0 && (
                <>
                  <dt className="text-fg-2">Taxas por hospedagem</dt>
                  <dd className="m-0 text-right font-mono">{formatCurrency(pricing.additionalStayTotal)}</dd>
                </>
              )}
              {pricing.discountAmount > 0 && (
                <>
                  <dt className="text-fg-2">Subtotal</dt>
                  <dd className="m-0 text-right font-mono">{formatCurrency(pricing.subtotal)}</dd>
                  <dt className="text-fg-2">Desconto</dt>
                  <dd className="m-0 text-right font-mono">− {formatCurrency(pricing.discountAmount)}</dd>
                </>
              )}
            </dl>
            <div className="flex items-baseline justify-between gap-3 border-t border-rule pt-2">
              <span className="text-sm font-medium">Total</span>
              <span className="font-mono text-[22px] font-medium">{formatCurrency(pricing.totalPrice)}</span>
            </div>
          </>
        ) : (
          <p className="m-0 text-[13px] text-fg-3">{pricingPending ? "Calculando…" : "O total aparece quando cliente, datas e quarto estiverem escolhidos."}</p>
        )}
      </div>

      {checks.length > 0 && (
        <ul className="m-0 flex list-none flex-col gap-1.5 p-0 text-[13px]">
          {checks.map((check) => (
            <li key={check.text} className={cx("flex items-center gap-1.5", check.tone === "ok" ? "text-accent-700" : "text-warn-fg")}>
              <span aria-hidden="true" className={cx("size-1.5 shrink-0 rounded-full", check.tone === "ok" ? "bg-accent" : "bg-warn")} />
              {check.text}
            </li>
          ))}
        </ul>
      )}

      {children}
    </aside>
  );
}
