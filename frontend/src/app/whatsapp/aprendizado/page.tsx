"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { FiArrowDown, FiArrowUp, FiCheck, FiMessageSquare, FiRefreshCw } from "react-icons/fi";
import { api } from "../../../services/api";
import { LEVEL_LABELS } from "../../../utils/whatsapp";
import type { Level } from "../../../types/whatsapp";
import styles from "./learning.module.css";

type Period = "7d" | "30d" | "all";

interface Rule {
  id: string;
  kind: "queue" | "reply";
  status: "proposed" | "active";
  title: string;
  weight: number | null;
  instruction: string | null;
  evidenceText: string;
  source?: "outcomes" | "corrections" | "edits";
  proposedAt: string;
  decidedAt: string | null;
}

interface HistoryEntry {
  id: string;
  action: "accepted" | "ignored" | "reverted";
  at: string;
  title: string;
  kind: "queue" | "reply";
  weight: number | null;
  instruction: string | null;
  userName: string | null;
}

interface LearningStep {
  key: "outcomes_pending" | "edited_suggestions" | "corrections" | "outcomes";
  done: boolean;
  current: number;
  target: number | null;
}

interface LearningData {
  period: Period;
  readings: { conversations: number; contacts: number };
  leads: { total: number; booked: number; bookedPercent: number; noOutcome: number };
  suggestions: { created: number; edited: number; used: number; dismissed: number; unused: number };
  corrections: number;
  accuracy: Array<{ first_level: Level; conversations: number; booked: number; response_minutes: number | null }>;
  topEdits: Array<{ description: string; count: number }>;
  lastAnalysisAt: string | null;
  steps: LearningStep[];
}

interface RulesData {
  proposed: Rule[];
  active: Rule[];
  history: HistoryEntry[];
}

const PERIOD_LABELS: Record<Period, string> = { "7d": "7 dias", "30d": "30 dias", all: "Tudo" };

const STEP_COPY: Record<LearningStep["key"], { title: string; detail: (step: LearningStep) => string }> = {
  outcomes_pending: {
    title: "Marcar o desfecho dos leads",
    detail: (step) => step.done
      ? "Todos os leads em aberto têm desfecho."
      : `${step.current} ${step.current === 1 ? "lead em aberto está" : "leads em aberto estão"} sem desfecho. Sem isso a IA não sabe o que virou reserva.`
  },
  edited_suggestions: {
    title: "Editar sugestões antes de enviar",
    detail: (step) => `${step.current} de ${step.target} sugestões editadas nos últimos 30 dias para a IA propor um padrão de resposta.`
  },
  corrections: {
    title: "Corrigir a prioridade da fila",
    detail: (step) => `${step.current} de ${step.target} correções nos últimos 30 dias. A IA propõe uma regra quando ${step.target} correções apontam para o mesmo lado numa mesma situação.`
  },
  outcomes: {
    title: "Acumular atendimentos com desfecho",
    detail: (step) => `${step.current} atendimentos com desfecho nos últimos 90 dias. A IA compara situações com pelo menos ${step.target} casos cada.`
  }
};

const SOURCE_LABELS: Record<NonNullable<Rule["source"]>, string> = {
  outcomes: "Veio dos desfechos",
  corrections: "Veio das correções da fila",
  edits: "Veio das sugestões editadas"
};

const HISTORY_LABELS: Record<HistoryEntry["action"], string> = {
  accepted: "Aceita",
  ignored: "Ignorada",
  reverted: "Desfeita"
};

function percent(part: number, total: number): string {
  return total ? `${Math.round(part * 100 / total)}%` : "—";
}

function relativeTime(value: string): string {
  const minutes = Math.round((Date.now() - Date.parse(value)) / 60000);
  if (minutes < 1) return "agora há pouco";
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `há ${hours} h`;
  const days = Math.round(hours / 24);
  return days === 1 ? "ontem" : `há ${days} dias`;
}

function ruleEffect(rule: { kind: "queue" | "reply"; weight: number | null; instruction: string | null }): string {
  if (rule.kind === "reply") return rule.instruction ?? "Padrão de resposta";
  return rule.weight && rule.weight > 0 ? "Sobe na fila" : "Desce na fila";
}

function RuleKind({ rule }: { rule: { kind: "queue" | "reply"; weight: number | null } }) {
  if (rule.kind === "reply") return <span className={styles.tag}><FiMessageSquare size={12} aria-hidden="true" />Resposta</span>;
  const up = Boolean(rule.weight && rule.weight > 0);
  return <span className={`${styles.tag} ${up ? styles.tagUp : styles.tagDown}`}>{up ? <FiArrowUp size={12} aria-hidden="true" /> : <FiArrowDown size={12} aria-hidden="true" />}{up ? "Sobe na fila" : "Desce na fila"}</span>;
}

export default function LearningPage() {
  const [period, setPeriod] = useState<Period>("30d");
  const [learning, setLearning] = useState<LearningData | null>(null);
  const [rules, setRules] = useState<RulesData>({ proposed: [], active: [], history: [] });
  const [isAdmin, setIsAdmin] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [summary, availableRules, session] = await Promise.all([
        api.get<LearningData>("/api/whatsapp/learning/summary", { params: { period } }),
        api.get<RulesData>("/api/whatsapp/learning/rules"),
        api.get<{ role?: string }>("/api/User/me"),
      ]);
      setLearning(summary.data);
      setRules({ ...availableRules.data, history: availableRules.data.history ?? [] });
      setIsAdmin(session.data.role === "admin");
      setError(null);
    } catch {
      setError("Não foi possível carregar o aprendizado da IA.");
    }
  }, [period]);

  useEffect(() => { void load(); }, [load]);

  const decide = async (rule: Rule, action: "accept" | "ignore" | "revert") => {
    try {
      await api.post(`/api/whatsapp/learning/rules/${rule.id}/${action}`);
      await load();
    } catch {
      setError("A regra mudou antes da sua decisão. Atualize a página.");
    }
  };

  const analyzeNow = async () => {
    setAnalyzing(true);
    try {
      await api.post("/api/whatsapp/learning/recompute");
      await load();
    } catch {
      setError("A análise já rodou nos últimos 10 minutos. Tente de novo mais tarde.");
    } finally {
      setAnalyzing(false);
    }
  };

  const pendingSteps = learning?.steps.filter((step) => !step.done) ?? [];
  const doneSteps = learning?.steps.filter((step) => step.done) ?? [];

  return (
    <div className={styles.page}>
      <header className={styles.top}>
        <div>
          <h1>Aprendizado da IA</h1>
          <p>
            O que a recepção corrigiu vira proposta. Só passa a valer o que o gerente aceitar.
            {learning && <> {learning.lastAnalysisAt ? `Última análise ${relativeTime(learning.lastAnalysisAt)}.` : "Nenhuma análise rodou ainda."}</>}
          </p>
        </div>
        <div className={styles.topActions}>
          <div className={styles.segmented} role="group" aria-label="Período">
            {(["7d", "30d", "all"] as const).map((value) => (
              <button key={value} type="button" aria-pressed={period === value} onClick={() => setPeriod(value)}>{PERIOD_LABELS[value]}</button>
            ))}
          </div>
          {isAdmin && (
            <button type="button" className={styles.secondaryButton} onClick={() => void analyzeNow()} disabled={analyzing}>
              <FiRefreshCw size={14} aria-hidden="true" className={analyzing ? styles.spinning : undefined} />
              {analyzing ? "Analisando…" : "Analisar agora"}
            </button>
          )}
        </div>
      </header>

      {error && <p role="alert" className={styles.error}>{error}</p>}

      {learning && (
        <section className={styles.stats} aria-label={`Resultados em ${PERIOD_LABELS[period]}`}>
          <div>
            <span className={styles.statLabel}>Conversas lidas pela IA</span>
            <strong className={styles.statValue}>{learning.readings.conversations}</strong>
            <span className={styles.statSub}>de {learning.readings.contacts} {learning.readings.contacts === 1 ? "contato" : "contatos"}</span>
          </div>
          <div>
            <span className={styles.statLabel}>Leads que viraram reserva</span>
            <strong className={styles.statValue}>{learning.leads.booked} <small>de {learning.leads.total}</small></strong>
            <span className={styles.statSub}>{percent(learning.leads.booked, learning.leads.total)} · {learning.leads.noOutcome} sem desfecho</span>
          </div>
          <div>
            <span className={styles.statLabel}>Sugestões enviadas</span>
            <strong className={styles.statValue}>{learning.suggestions.used} <small>de {learning.suggestions.created}</small></strong>
            <span className={styles.statSub}>{learning.suggestions.edited} editadas antes · {learning.suggestions.dismissed} descartadas</span>
          </div>
          <div>
            <span className={styles.statLabel}>Correções de prioridade</span>
            <strong className={styles.statValue}>{learning.corrections}</strong>
            <span className={styles.statSub}>vezes que a recepção subiu ou desceu uma conversa</span>
          </div>
        </section>
      )}

      <div className={styles.columns}>
        <div className={styles.main}>
          <section className={styles.section} aria-labelledby="propostas-title">
            <header className={styles.sectionHeader}>
              <h2 id="propostas-title">Esperando aprovação {rules.proposed.length > 0 && <span className={styles.count}>{rules.proposed.length}</span>}</h2>
              {!isAdmin && <span className={styles.muted}>Só o gerente aceita ou desfaz regras.</span>}
            </header>
            {!rules.proposed.length && (
              <p className={styles.empty}>
                Nenhuma proposta nova. {pendingSteps.length > 0 ? "Veja ao lado o que falta para a IA ter o que propor." : "A IA propõe algo novo quando os dados mudarem."}
              </p>
            )}
            <ul className={styles.ruleList}>
              {rules.proposed.map((rule) => (
                <li key={rule.id} className={styles.proposal}>
                  <div className={styles.ruleBody}>
                    <div className={styles.ruleMeta}>
                      <RuleKind rule={rule} />
                      {rule.source && <span className={styles.muted}>{SOURCE_LABELS[rule.source]}</span>}
                    </div>
                    <strong>{rule.title}</strong>
                    {rule.kind === "reply" && rule.instruction && <p className={styles.instruction}>“{rule.instruction}”</p>}
                    <p className={styles.evidence}>{rule.evidenceText}</p>
                  </div>
                  {isAdmin && (
                    <div className={styles.ruleActions}>
                      <button type="button" className={styles.ghostButton} onClick={() => void decide(rule, "ignore")}>Ignorar</button>
                      <button type="button" className={styles.primaryButton} onClick={() => void decide(rule, "accept")}><FiCheck size={14} aria-hidden="true" />Aceitar</button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </section>

          <section className={styles.section} aria-labelledby="ativas-title">
            <header className={styles.sectionHeader}>
              <h2 id="ativas-title">Regras valendo {rules.active.length > 0 && <span className={styles.count}>{rules.active.length}</span>}</h2>
            </header>
            {!rules.active.length && <p className={styles.empty}>Nenhuma regra ativa. A fila e as sugestões seguem o comportamento padrão.</p>}
            <ul className={styles.ruleList}>
              {rules.active.map((rule) => (
                <li key={rule.id} className={styles.activeRule}>
                  <div className={styles.ruleBody}>
                    <div className={styles.ruleMeta}><RuleKind rule={rule} />{rule.decidedAt && <span className={styles.muted}>desde {new Date(rule.decidedAt).toLocaleDateString("pt-BR")}</span>}</div>
                    <strong>{rule.title}</strong>
                    {rule.kind === "reply" && <p className={styles.instruction}>“{ruleEffect(rule)}”</p>}
                  </div>
                  {isAdmin && <button type="button" className={styles.ghostButton} onClick={() => void decide(rule, "revert")}>Desfazer</button>}
                </li>
              ))}
            </ul>
          </section>

          <section className={styles.section} aria-labelledby="accuracy-title">
            <header className={styles.sectionHeader}><h2 id="accuracy-title">A fila acerta?</h2></header>
            {!learning?.accuracy.length ? <p className={styles.empty}>Sem atendimentos no período.</p> : (
              <table className={styles.table}>
                <thead>
                  <tr><th scope="col">A IA colocou em</th><th scope="col">Atendimentos</th><th scope="col">Viraram reserva</th><th scope="col">Primeira resposta</th></tr>
                </thead>
                <tbody>
                  {learning.accuracy.map((row) => (
                    <tr key={row.first_level}>
                      <th scope="row">{LEVEL_LABELS[row.first_level] ?? row.first_level}</th>
                      <td>{row.conversations}</td>
                      <td>{row.booked} <span className={styles.muted}>({percent(row.booked, row.conversations)})</span></td>
                      <td>{row.response_minutes == null ? "—" : `${Math.round(row.response_minutes)} min (mediana)`}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <p className={styles.hint}>Se “Agora” não vira mais reserva que “Pode esperar”, a fila está priorizando errado. Corrija pela conversa.</p>
          </section>

          {rules.history.length > 0 && (
            <section className={styles.section} aria-labelledby="historico-title">
              <header className={styles.sectionHeader}><h2 id="historico-title">Histórico de decisões</h2></header>
              <ul className={styles.history}>
                {rules.history.map((entry) => (
                  <li key={entry.id}>
                    <span className={`${styles.historyAction} ${styles[`history_${entry.action}`]}`}>{HISTORY_LABELS[entry.action]}</span>
                    <span className={styles.historyTitle}>{entry.title} <span className={styles.muted}>· {ruleEffect(entry)}</span></span>
                    <span className={styles.muted}>{entry.userName ?? "—"} · {new Date(entry.at).toLocaleDateString("pt-BR")}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <aside className={styles.side}>
          <section className={styles.section} aria-labelledby="falta-title">
            <header className={styles.sectionHeader}><h2 id="falta-title">O que falta para a IA aprender</h2></header>
            <ol className={styles.steps}>
              {[...pendingSteps, ...doneSteps].map((step) => (
                <li key={step.key} className={step.done ? styles.stepDone : undefined}>
                  <span className={styles.stepMark} aria-hidden="true">{step.done ? <FiCheck size={12} /> : null}</span>
                  <div>
                    <strong>{STEP_COPY[step.key].title}</strong>
                    <p>{STEP_COPY[step.key].detail(step)}</p>
                    {step.target != null && !step.done && (
                      <div className={styles.progress} role="progressbar" aria-valuemin={0} aria-valuemax={step.target} aria-valuenow={step.current}>
                        <span style={{ width: `${Math.min(100, step.current * 100 / step.target)}%` }} />
                      </div>
                    )}
                    {step.key === "outcomes_pending" && !step.done && <Link href="/whatsapp" className={styles.stepLink}>Marcar na fila →</Link>}
                  </div>
                </li>
              ))}
            </ol>
          </section>

          <section className={styles.section} aria-labelledby="edicoes-title">
            <header className={styles.sectionHeader}><h2 id="edicoes-title">O que a recepção mais muda</h2></header>
            {!learning?.topEdits.length ? (
              <p className={styles.empty}>A IA resume aqui as edições mais comuns depois que houver pelo menos 5 sugestões editadas.</p>
            ) : (
              <ul className={styles.edits}>
                {learning.topEdits.map((edit) => <li key={edit.description}><span>{edit.description}</span><span className={styles.count}>{edit.count}×</span></li>)}
              </ul>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
