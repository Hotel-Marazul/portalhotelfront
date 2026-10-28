"use client";

import { ChevronDown, Sparkles } from "lucide-react";
import type { ConversationDetail } from "../../types/whatsapp";
import { formatBRL, guestSummary, intentLabel, missingFieldsNotice, readingPeriod } from "../../utils/whatsapp";
import { cx } from "../ui/cx";
import { availabilityRows } from "./whatsapp-view";

type Verdict = NonNullable<ConversationDetail["myFeedback"]>;

interface AiReadingPanelProps {
  detail: ConversationDetail;
  onFeedback: (verdict: Verdict) => void;
}

const FEEDBACK: Array<{ verdict: Verdict; short: string; label: string }> = [
  { verdict: "correct", short: "Certa", label: "Prioridade certa" },
  { verdict: "should_be_higher", short: "Subir", label: "Deveria subir" },
  { verdict: "should_be_lower", short: "Descer", label: "Deveria descer" },
];

export default function AiReadingPanel({ detail, onFeedback }: AiReadingPanelProps) {
  const { reading, reasons, position } = detail;
  const missing = reading ? missingFieldsNotice(reading.missingFields) : null;
  const rows = reading ? availabilityRows(reading.availability, reading.prices) : [];
  const hasTotals = rows.some((row) => row.total !== null);
  const scoreText = detail.score !== null && position ? `${detail.score} pts · ${position}º na fila` : "fora da fila";

  return (
    <section aria-labelledby="leitura-titulo" className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between gap-2">
        <h2 id="leitura-titulo" className="m-0 inline-flex items-center gap-1.5 text-[13px] font-semibold text-fg-2">
          <Sparkles aria-hidden="true" className="size-[13px] text-accent" />
          Leitura da IA
        </h2>
        <span className="font-mono text-xs text-fg-2">{scoreText}</span>
      </div>

      {reading ? (
        <>
          <p className="m-0 text-[17px] font-semibold tracking-[-0.01em]">{intentLabel(reading.intent)}</p>
          <dl className="m-0 flex flex-col">
            <div className="flex justify-between gap-3 border-b border-rule py-[7px] text-[13px]">
              <dt className="shrink-0 text-fg-3">Período</dt>
              <dd className="m-0 text-right font-medium">{readingPeriod(reading.checkIn, reading.checkOut, reading.nights)}</dd>
            </div>
            <div className="flex justify-between gap-3 border-b border-rule py-[7px] text-[13px]">
              <dt className="shrink-0 text-fg-3">Hóspedes</dt>
              <dd className="m-0 text-right font-medium">{guestSummary(reading.adults, reading.childrenAges)}</dd>
            </div>
          </dl>

          {rows.length > 0 && (
            <table className="w-full border-collapse text-xs">
              {hasTotals && <caption className="pb-1 text-left text-xs text-fg-3">Total da estadia, calculado pelo backend</caption>}
              <thead>
                <tr>
                  <th scope="col" className="py-1 text-left font-medium text-fg-3">Categoria</th>
                  <th scope="col" className="py-1 text-right font-medium text-fg-3">Livres</th>
                  {hasTotals && <th scope="col" className="py-1 text-right font-medium text-fg-3">Total</th>}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.category} className="border-t border-rule">
                    <th scope="row" className="py-1.5 text-left text-[13px] font-medium">{row.category}</th>
                    <td className="py-1.5 text-right font-mono">{row.roomsFree ?? "—"}</td>
                    {hasTotals && <td className="py-1.5 text-right font-mono">{row.total !== null ? formatBRL(row.total) : "—"}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {reading.requests.length > 0 && (
            <ul aria-label="Pedidos" className="m-0 flex list-none flex-wrap gap-1.5 p-0">
              {reading.requests.map((request) => (
                <li key={request} className="inline-flex min-h-6 items-center rounded-bar bg-surface px-2 text-xs shadow-[inset_0_0_0_1px_var(--border)]">{request}</li>
              ))}
            </ul>
          )}
          {missing && <p className="m-0 rounded-control bg-warn-bg px-3 py-2.5 text-[13px] leading-[1.45] text-warn-fg">{missing}</p>}
        </>
      ) : (
        <p className="m-0 text-[13px] text-fg-2">Sem leitura da IA.</p>
      )}

      <details className="group border-t border-rule pt-2">
        <summary className="flex min-h-7 cursor-pointer list-none items-center justify-between text-[13px] font-medium [&::-webkit-details-marker]:hidden">
          {position ? `Por que está em ${position}º` : "Fora da fila"}
          <ChevronDown aria-hidden="true" className="size-3.5 text-fg-3 transition-transform group-open:rotate-180" />
        </summary>
        {reasons.length > 0 ? (
          <ul className="m-0 mt-1.5 flex list-none flex-col gap-1 p-0">
            {reasons.slice(0, 4).map((reason) => (
              <li key={`${reason.text}-${reason.weight}`} className="flex justify-between gap-2.5 text-[13px]">
                <span>{reason.text}</span>
                <span className="shrink-0 font-mono text-accent-700">{reason.weight > 0 ? `+${reason.weight}` : reason.weight}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="m-0 mt-1.5 text-[13px] text-fg-2">Sem motivos registrados.</p>
        )}
      </details>

      <div className="flex flex-col gap-1.5">
        <span id="priority-feedback-title" className="text-xs text-fg-3">
          {detail.myFeedback ? "Correção registrada. Clique de novo para desfazer." : "A prioridade está certa?"}
        </span>
        <div role="group" aria-labelledby="priority-feedback-title" className="grid grid-cols-3 gap-1">
          {FEEDBACK.map(({ verdict, short, label }) => {
            const active = detail.myFeedback === verdict;
            return (
              <button
                key={verdict}
                type="button"
                aria-pressed={active}
                aria-label={active ? `${label} (clique para desfazer)` : label}
                title={label}
                onClick={() => onFeedback(verdict)}
                className={cx(
                  "min-h-[30px] rounded-[7px] text-xs transition-colors",
                  active ? "bg-fg text-on-dark" : "bg-surface text-fg shadow-[inset_0_0_0_1px_var(--border)] hover:bg-bg",
                )}
              >
                {short}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
