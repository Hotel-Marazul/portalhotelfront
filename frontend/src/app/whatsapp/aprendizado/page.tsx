"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Check, RefreshCw } from "lucide-react";
import { api } from "../../../services/api";
import { LEVEL_LABELS } from "../../../utils/whatsapp";
import type { Level } from "../../../types/whatsapp";
import Button from "../../../components/ui/Button";
import Segmented from "../../../components/ui/Segmented";
import { Kpi, KpiRow, type KpiStatus } from "../../../components/ui/Kpi";
import { cx } from "../../../components/ui/cx";
import { LEVEL_RAIL } from "../../../components/whatsapp/QueueColumn";
import { percentOf } from "../../../components/whatsapp/whatsapp-view";

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

const TAG_TONES = {
  up: "bg-accent-100 text-accent-700",
  down: "bg-muted text-fg-2",
  reply: "bg-warn-bg text-warn-fg",
} as const;

function RuleKind({ rule }: { rule: { kind: "queue" | "reply"; weight: number | null } }) {
  const tone = rule.kind === "reply" ? "reply" : rule.weight && rule.weight > 0 ? "up" : "down";
  const label = tone === "reply" ? "Resposta" : tone === "up" ? "Sobe na fila" : "Desce na fila";
  return <span className={cx("inline-flex h-[22px] shrink-0 items-center rounded-bar px-2 text-xs font-medium", TAG_TONES[tone])}>{label}</span>;
}

const sectionTitle = "m-0 text-[15px] font-semibold";
const HISTORY_TONES: Record<HistoryEntry["action"], string> = {
  accepted: "text-accent-700",
  ignored: "text-fg-3",
  reverted: "text-warn-fg",
};

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
  const kpiStatus: KpiStatus = learning ? "ready" : error ? "error" : "loading";
  const bookedPercent = learning ? percentOf(learning.leads.booked, learning.leads.total) : null;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-5 px-8 pt-[22px] pb-6 max-[899px]:px-4">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-x-5 gap-y-3">
        <div className="flex flex-col gap-0.5">
          <h1 className="m-0 text-[22px] font-semibold tracking-[-0.02em]">Aprendizado da IA</h1>
          <p className="m-0 text-sm text-fg-3">
            A IA propõe a partir do que a recepção corrige; só vale o que a gerência aceitar.
            {learning && <> {learning.lastAnalysisAt ? `Última análise ${relativeTime(learning.lastAnalysisAt)}.` : "Nenhuma análise rodou ainda."}</>}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Segmented<Period>
            label="Período"
            value={period}
            onChange={setPeriod}
            options={(["7d", "30d", "all"] as const).map((value) => ({ value, label: PERIOD_LABELS[value] }))}
          />
          {isAdmin && (
            <Button onClick={() => void analyzeNow()} disabled={analyzing}>
              <RefreshCw aria-hidden="true" className={analyzing ? "animate-spin motion-reduce:animate-none" : undefined} />
              {analyzing ? "Analisando…" : "Analisar agora"}
            </Button>
          )}
        </div>
      </header>

      {error && <p role="alert" className="m-0 shrink-0 text-[13px] text-danger">{error}</p>}

      <h2 className="sr-only">Resultados em {PERIOD_LABELS[period]}</h2>
      <KpiRow>
        <Kpi
          label="Conversas lidas pela IA"
          status={kpiStatus}
          value={learning?.readings.conversations.toLocaleString("pt-BR")}
          note={learning && `de ${learning.readings.contacts} ${learning.readings.contacts === 1 ? "contato" : "contatos"}`}
        />
        <Kpi
          label="Leads que viraram reserva"
          status={kpiStatus}
          value={bookedPercent === null ? "—" : `${bookedPercent}%`}
          note={learning && `${learning.leads.booked} de ${learning.leads.total} · ${learning.leads.noOutcome} sem desfecho`}
        />
        <Kpi
          label="Sugestões enviadas"
          status={kpiStatus}
          value={learning?.suggestions.used.toLocaleString("pt-BR")}
          note={learning && `de ${learning.suggestions.created} · ${learning.suggestions.edited} editadas · ${learning.suggestions.dismissed} descartadas`}
        />
        <Kpi label="Correções de prioridade" status={kpiStatus} value={learning?.corrections.toLocaleString("pt-BR")} />
      </KpiRow>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-10 min-[1100px]:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <div className="flex min-h-0 flex-col gap-6 min-[1100px]:overflow-y-auto">
          <section aria-labelledby="propostas-titulo" className="flex flex-col gap-2.5">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3">
              <h2 id="propostas-titulo" className={sectionTitle}>
                Esperando aprovação {rules.proposed.length > 0 && <span className="font-mono font-normal text-accent">{rules.proposed.length}</span>}
              </h2>
              {!isAdmin && <span className="text-xs text-fg-3">Só o gerente aceita ou desfaz regras.</span>}
            </div>
            {!rules.proposed.length && (
              <p className="m-0 rounded-[10px] bg-bg/60 p-3.5 text-[13px] text-fg-2">
                Nenhuma proposta nova. {pendingSteps.length > 0 ? "Veja ao lado o que falta para a IA ter o que propor." : "A IA propõe algo quando os dados mudarem."}
              </p>
            )}
            {rules.proposed.map((rule) => (
              <article key={rule.id} className="flex flex-col gap-2.5 rounded-block border border-rule p-4">
                <div className="flex flex-wrap items-center justify-between gap-2.5">
                  <RuleKind rule={rule} />
                  {rule.source && <span className="text-xs text-fg-3">{SOURCE_LABELS[rule.source]}</span>}
                </div>
                <h3 className="m-0 text-[15px] leading-snug font-semibold">{rule.title}</h3>
                <p className="m-0 text-[13px] leading-normal text-fg-2">{rule.evidenceText}</p>
                {rule.kind === "reply" && rule.instruction && (
                  <p className="m-0 rounded-control bg-accent-50 px-3 py-2.5 text-[13px] leading-[1.45] text-accent-700">“{rule.instruction}”</p>
                )}
                {isAdmin && (
                  <div className="flex justify-end gap-1.5">
                    <Button size="sm" variant="ghost" onClick={() => void decide(rule, "ignore")}>Ignorar</Button>
                    <Button size="sm" variant="accent" onClick={() => void decide(rule, "accept")}><Check aria-hidden="true" />Aceitar</Button>
                  </div>
                )}
              </article>
            ))}
          </section>

          <section aria-labelledby="ativas-titulo" className="flex flex-col">
            <h2 id="ativas-titulo" className={cx(sectionTitle, "mb-1")}>
              Regras valendo {rules.active.length > 0 && <span className="font-mono font-normal text-fg-3">{rules.active.length}</span>}
            </h2>
            {!rules.active.length && <p className="m-0 py-2 text-[13px] text-fg-2">Nenhuma regra ativa. A fila e as sugestões seguem o comportamento padrão.</p>}
            {rules.active.map((rule) => (
              <div key={rule.id} className="flex min-h-[52px] items-center justify-between gap-3 border-b border-rule py-2">
                <span className="flex min-w-0 items-center gap-2.5">
                  <RuleKind rule={rule} />
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate font-medium" title={rule.title}>{rule.title}</span>
                    <span className="text-xs text-fg-3">
                      {rule.kind === "reply" ? `“${ruleEffect(rule)}”` : ruleEffect(rule)}
                      {rule.decidedAt && <> · desde <span className="font-mono">{new Date(rule.decidedAt).toLocaleDateString("pt-BR")}</span></>}
                    </span>
                  </span>
                </span>
                {isAdmin && <Button size="sm" variant="outline" onClick={() => void decide(rule, "revert")}>Desfazer</Button>}
              </div>
            ))}
          </section>

          {rules.history.length > 0 && (
            <section aria-labelledby="historico-titulo" className="flex flex-col">
              <h2 id="historico-titulo" className={cx(sectionTitle, "mb-1")}>Histórico de decisões</h2>
              <ul className="m-0 list-none p-0">
                {rules.history.map((entry) => (
                  <li key={entry.id} className="grid grid-cols-[72px_minmax(0,1fr)_auto] items-center gap-3 border-b border-rule py-2.5 text-[13px] max-[899px]:grid-cols-[72px_minmax(0,1fr)]">
                    <span className={cx("text-xs font-medium", HISTORY_TONES[entry.action])}>{HISTORY_LABELS[entry.action]}</span>
                    <span className="truncate">{entry.title} <span className="text-fg-3">· {ruleEffect(entry)}</span></span>
                    <span className="text-xs text-fg-3 max-[899px]:col-start-2">{entry.userName ?? "—"} · <span className="font-mono">{new Date(entry.at).toLocaleDateString("pt-BR")}</span></span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <div className="flex min-h-0 flex-col gap-6 min-[1100px]:overflow-y-auto">
          <section aria-labelledby="acerta-titulo" className="flex flex-col gap-1.5">
            <h2 id="acerta-titulo" className={sectionTitle}>A fila acerta?</h2>
            {!learning?.accuracy.length ? <p className="m-0 text-[13px] text-fg-2">Sem atendimentos no período.</p> : (
              <table className="w-full border-collapse text-[13px]">
                <thead>
                  <tr>
                    <th scope="col" className="py-1.5 text-left text-xs font-medium text-fg-3">A IA colocou em</th>
                    <th scope="col" className="py-1.5 text-right text-xs font-medium text-fg-3">Atend.</th>
                    <th scope="col" className="py-1.5 pl-4 text-left text-xs font-medium text-fg-3">Viraram reserva</th>
                    <th scope="col" className="py-1.5 text-right text-xs font-medium text-fg-3">1ª resposta</th>
                  </tr>
                </thead>
                <tbody>
                  {learning.accuracy.map((row) => {
                    const rate = percentOf(row.booked, row.conversations);
                    return (
                      <tr key={row.first_level} className="border-t border-rule">
                        <th scope="row" className="py-2.5 text-left font-medium">
                          <span className="inline-flex items-center gap-2">
                            <span aria-hidden="true" className={cx("h-4 w-[3px] rounded-sm", LEVEL_RAIL[row.first_level] ?? "bg-fg-3")} />
                            {LEVEL_LABELS[row.first_level] ?? row.first_level}
                          </span>
                        </th>
                        <td className="py-2.5 text-right font-mono">{row.conversations}</td>
                        <td className="py-2.5 pl-4">
                          <span className="flex items-center gap-2" title={`${row.booked} de ${row.conversations}`}>
                            <span aria-hidden="true" className="h-1.5 flex-1 overflow-hidden rounded-[3px] bg-muted">
                              <span className="block h-full bg-accent" style={{ width: `${rate ?? 0}%` }} />
                            </span>
                            <span className="w-[34px] text-right font-mono">{rate === null ? "—" : `${rate}%`}</span>
                          </span>
                        </td>
                        <td className="py-2.5 text-right font-mono">{row.response_minutes == null ? "—" : `${Math.round(row.response_minutes)} min`}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
            <p className="m-0 text-xs leading-normal text-fg-2">1ª resposta é a mediana. Se “Agora” não vira mais reserva que “Pode esperar”, a fila está priorizando errado: corrija pela conversa.</p>
          </section>

          <section aria-labelledby="edicoes-titulo" className="flex flex-col">
            <h2 id="edicoes-titulo" className={cx(sectionTitle, "mb-1")}>O que a recepção mais muda nas sugestões</h2>
            {!learning?.topEdits.length ? (
              <p className="m-0 py-2 text-[13px] text-fg-2">A IA resume aqui as edições mais comuns depois que houver pelo menos 5 sugestões editadas.</p>
            ) : learning.topEdits.map((edit) => (
              <div key={edit.description} className="flex min-h-[38px] items-center justify-between gap-3 border-b border-rule text-[13px]">
                <span>{edit.description}</span>
                <span className="font-mono text-fg-2">{edit.count}×</span>
              </div>
            ))}
          </section>

          <section aria-labelledby="falta-titulo" className="flex flex-col gap-1">
            <h2 id="falta-titulo" className={cx(sectionTitle, "mb-1")}>O que falta para a IA aprender</h2>
            <ol className="m-0 flex list-none flex-col p-0">
              {[...pendingSteps, ...doneSteps].map((step) => (
                <li key={step.key} className="flex items-start gap-2.5 py-1.5 text-[13px]">
                  <span aria-hidden="true" className={cx("grid size-[18px] shrink-0 place-items-center rounded-full", step.done ? "bg-accent text-on-dark" : "shadow-[inset_0_0_0_1.5px_var(--border)]")}>
                    {step.done && <Check className="size-2.5" strokeWidth={3} />}
                  </span>
                  <span className="flex flex-1 flex-col gap-px">
                    <span className={cx("font-medium", step.done ? "text-fg-2" : "text-fg")}>
                      {STEP_COPY[step.key].title}
                      <span className="sr-only">{step.done ? " (feito)" : " (pendente)"}</span>
                    </span>
                    <span className="text-xs text-fg-3">{STEP_COPY[step.key].detail(step)}</span>
                  </span>
                  {step.key === "outcomes_pending" && !step.done && (
                    <Link href="/whatsapp" className="shrink-0 text-xs text-accent-700 underline underline-offset-[3px]">Marcar na fila</Link>
                  )}
                </li>
              ))}
            </ol>
          </section>
        </div>
      </div>
    </div>
  );
}
