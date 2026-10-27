"use client";

import { FiArrowDown, FiArrowUp, FiCheck } from "react-icons/fi";
import type { ConversationDetail } from "../../types/whatsapp";
import { formatBRL, intentLabel, missingFieldsNotice, readingPeriod, guestSummary } from "../../utils/whatsapp";
import styles from "./whatsapp.module.css";

type Verdict = NonNullable<ConversationDetail["myFeedback"]>;

interface AiReadingPanelProps {
  detail: ConversationDetail;
  onFeedback: (verdict: Verdict) => void;
}

const FEEDBACK: Array<{ verdict: Verdict; label: string; Icon: typeof FiCheck }> = [
  { verdict: "correct", label: "Prioridade certa", Icon: FiCheck },
  { verdict: "should_be_higher", label: "Deveria subir", Icon: FiArrowUp },
  { verdict: "should_be_lower", label: "Deveria descer", Icon: FiArrowDown },
];

export default function AiReadingPanel({ detail, onFeedback }: AiReadingPanelProps) {
  const { reading, reasons, position } = detail;
  const missing = reading ? missingFieldsNotice(reading.missingFields) : null;

  return (
    <section className={styles.readingCard} aria-labelledby="ai-reading-title">
      <header className={styles.cardHeader}>
        <h2 id="ai-reading-title">Leitura da IA</h2>
        {detail.score !== null && <span className={styles.scoreChip}>{detail.score} pts</span>}
      </header>

      {reading ? (
        <>
          <p className={styles.intent}>{intentLabel(reading.intent)}</p>
          <dl className={styles.facts}>
            <div className={styles.factWide}>
              <dt>Período</dt>
              <dd>{readingPeriod(reading.checkIn, reading.checkOut, reading.nights)}</dd>
            </div>
            <div className={styles.factWide}>
              <dt>Hóspedes</dt>
              <dd>{guestSummary(reading.adults, reading.childrenAges)}</dd>
            </div>
            {reading.availability.length > 0 && (
              <div className={styles.factWide}>
                <dt>Livres</dt>
                <dd>
                  {reading.availability
                    .map((item) => `${item.category}: ${item.roomsFree} ${item.roomsFree === 1 ? "quarto" : "quartos"}`)
                    .join(" · ")}
                </dd>
              </div>
            )}
            {reading.prices.length > 0 && (
              <div className={styles.factWide}>
                <dt>Valor total</dt>
                <dd>{reading.prices.map((item) => `${item.category}: ${formatBRL(item.total)}`).join(" · ")}</dd>
              </div>
            )}
          </dl>
          {reading.requests.length > 0 && (
            <ul className={styles.chips} aria-label="Pedidos">
              {reading.requests.map((request) => <li key={request}>{request}</li>)}
            </ul>
          )}
          {missing && <p className={styles.missing}>{missing}</p>}
        </>
      ) : (
        <p className={styles.muted}>Sem leitura da IA.</p>
      )}

      <details className={styles.reasons}>
        <summary>{position ? `Por que está em ${position}º` : "Fora da fila"}</summary>
        {reasons.length > 0 ? (
          <ul>
            {reasons.slice(0, 4).map((reason) => (
              <li key={`${reason.text}-${reason.weight}`}>
                <span>{reason.text}</span>
                <small>{reason.weight > 0 ? `+${reason.weight}` : reason.weight}</small>
              </li>
            ))}
          </ul>
        ) : (
          <p className={styles.muted}>Sem motivos registrados.</p>
        )}
      </details>

      <div className={styles.feedbackRow}>
        <span id="priority-feedback-title">{detail.myFeedback ? "Correção registrada" : "A prioridade está certa?"}</span>
        <div className={styles.feedbackGroup} role="group" aria-labelledby="priority-feedback-title">
          {FEEDBACK.map(({ verdict, label, Icon }) => (
            <button
              key={verdict}
              type="button"
              aria-pressed={detail.myFeedback === verdict}
              aria-label={detail.myFeedback === verdict ? `${label} (clique para desfazer)` : label}
              title={label}
              onClick={() => onFeedback(verdict)}
            >
              <Icon size={13} aria-hidden="true" />
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
