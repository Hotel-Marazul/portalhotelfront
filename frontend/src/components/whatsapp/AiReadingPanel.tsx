"use client";

import type { ConversationDetail } from "../../types/whatsapp";
import { intentLabel, missingFieldsNotice, readingPeriod, guestSummary } from "../../utils/whatsapp";
import styles from "./whatsapp.module.css";

interface AiReadingPanelProps {
  detail: ConversationDetail;
}

export default function AiReadingPanel({ detail }: AiReadingPanelProps) {
  const { reading, reasons, position } = detail;
  const posicao = position ? `Por que está em ${position}º` : "Fora da fila";

  return (
    <section className={styles.detailSection} aria-labelledby="ai-reading-title">
      <h2 id="ai-reading-title">Leitura da IA</h2>
      {reading ? (
        <dl className={styles.reading}>
          <div>
            <dt>Intenção</dt>
            <dd>{intentLabel(reading.intent)}</dd>
          </div>
          <div>
            <dt>Período</dt>
            <dd>{readingPeriod(reading.checkIn, reading.checkOut, reading.nights)}</dd>
          </div>
          <div>
            <dt>Hóspedes</dt>
            <dd>{guestSummary(reading.adults, reading.childrenAges)}</dd>
          </div>
          {reading.requests.length > 0 && (
            <div>
              <dt>Pedidos</dt>
              <dd>{reading.requests.join(", ")}</dd>
            </div>
          )}
          {reading.availability.length > 0 && (
            <div>
              <dt>Disponibilidade</dt>
              <dd>
                {reading.availability
                  .map((item) => `${item.category}: ${item.roomsFree} ${item.roomsFree === 1 ? "quarto" : "quartos"}`)
                  .join(" · ")}
              </dd>
            </div>
          )}
          {reading.prices.length > 0 && (
            <div>
              <dt>Valor total</dt>
              <dd>{reading.prices.map((item) => `${item.category}: ${item.total}`).join(" · ")}</dd>
            </div>
          )}
        </dl>
      ) : (
        <p>Sem leitura da IA.</p>
      )}
      {reading && missingFieldsNotice(reading.missingFields) && (
        <p className={styles.notice}>{missingFieldsNotice(reading.missingFields)}</p>
      )}
      <h3>{posicao}</h3>
      {reasons.length > 0 ? (
        <ul className={styles.reasonList}>
          {reasons.slice(0, 4).map((reason) => (
            <li key={`${reason.text}-${reason.weight}`}>
              {reason.text} <small>{reason.weight > 0 ? `+${reason.weight}` : reason.weight}</small>
            </li>
          ))}
        </ul>
      ) : (
        <p>Sem motivos registrados.</p>
      )}
      {detail.score !== null && <p className={styles.scoreLine}>{detail.score} pontos</p>}
    </section>
  );
}
