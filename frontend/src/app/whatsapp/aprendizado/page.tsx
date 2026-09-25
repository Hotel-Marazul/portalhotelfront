"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api } from "../../../services/api";

interface Rule {
  id: string;
  kind: "queue" | "reply";
  status: "proposed" | "active";
  title: string;
  weight: number | null;
  instruction: string | null;
  evidenceText: string;
}

interface LearningData {
  period: string;
  readings: { conversations: number; contacts: number };
  leads: { total: number; booked: number; bookedPercent: number; noOutcome: number };
  suggestions: { created: number; edited: number; used: number; dismissed: number; unused: number };
  corrections: number;
  accuracy: Array<{ first_level: string; conversations: number; booked: number; response_minutes: number | null }>;
}

export default function LearningPage() {
  const [period, setPeriod] = useState<"7d" | "30d" | "all">("30d");
  const [learning, setLearning] = useState<LearningData | null>(null);
  const [rules, setRules] = useState<{ proposed: Rule[]; active: Rule[] }>({ proposed: [], active: [] });
  const [isAdmin, setIsAdmin] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [summary, availableRules, session] = await Promise.all([
        api.get<LearningData>("/api/whatsapp/learning/summary", { params: { period } }),
        api.get<{ proposed: Rule[]; active: Rule[] }>("/api/whatsapp/learning/rules"),
        api.get<{ role?: string }>("/api/User/me"),
      ]);
      setLearning(summary.data);
      setRules(availableRules.data);
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

  return (
    <div className="page-content">
      <header className="page-header">
        <div>
          <h1>Aprendizado da IA</h1>
          <p>Veja o que a operação corrigiu e decida o que passa a valer.</p>
        </div>
        <Link href="/whatsapp">Voltar para a fila</Link>
      </header>

      <section aria-label="Período do aprendizado" style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {(["7d", "30d", "all"] as const).map((value) => (
          <button key={value} type="button" aria-pressed={period === value} onClick={() => setPeriod(value)}>
            {value === "all" ? "Tudo" : value}
          </button>
        ))}
      </section>

      {error && <p role="alert">{error}</p>}
      {learning && <section aria-label="Indicadores do aprendizado" style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
        <article><strong>Conversas lidas</strong><p>{learning.readings.conversations} · {learning.readings.contacts} contatos</p></article>
        <article><strong>Leads encontrados</strong><p>{learning.leads.total} · {learning.leads.booked} reservas ({learning.leads.bookedPercent}%)</p></article>
        <article><strong>Sugestões enviadas</strong><p>{learning.suggestions.used} · {learning.suggestions.edited} editadas</p></article>
        <article><strong>Correções na fila</strong><p>{learning.corrections}</p></article>
      </section>}

      <section style={{ marginTop: 28 }} aria-labelledby="propostas-title">
        <h2 id="propostas-title">Esperando sua aprovação</h2>
        {!rules.proposed.length && <p>Nenhuma proposta nova.</p>}
        {rules.proposed.map((rule) => <article key={rule.id} style={{ margin: "12px 0", padding: 16, border: "1px solid var(--border)", borderRadius: 12 }}>
          <strong>{rule.title}</strong><p>{rule.evidenceText}</p><small>{rule.kind === "queue" ? (rule.weight && rule.weight > 0 ? "Sobe" : "Desce") : "Resposta"}</small>
          {isAdmin ? <div style={{ display: "flex", gap: 8, marginTop: 12 }}><button type="button" onClick={() => void decide(rule, "accept")}>Aceitar</button><button type="button" onClick={() => void decide(rule, "ignore")}>Ignorar</button></div> : <p>Só o gerente aceita ou desfaz regras.</p>}
        </article>)}
      </section>

      <section style={{ marginTop: 28 }} aria-labelledby="ativas-title">
        <h2 id="ativas-title">Regras valendo</h2>
        {!rules.active.length && <p>Nenhuma regra ativa.</p>}
        {rules.active.map((rule) => <article key={rule.id} style={{ display: "flex", justifyContent: "space-between", gap: 12, margin: "8px 0", padding: 12, borderBottom: "1px solid var(--border)" }}>
          <span><strong>{rule.title}</strong><br /><small>{rule.kind === "queue" ? `${rule.weight && rule.weight > 0 ? "Sobe" : "Desce"} a prioridade` : rule.instruction}</small></span>
          {isAdmin && <button type="button" onClick={() => void decide(rule, "revert")}>Desfazer</button>}
        </article>)}
      </section>

      <section style={{ marginTop: 28 }} aria-labelledby="accuracy-title">
        <h2 id="accuracy-title">A fila acerta?</h2>
        {!learning?.accuracy.length && <p>Sem dados no período.</p>}
        {learning?.accuracy.map((row) => <p key={row.first_level}>{row.first_level}: {row.booked}/{row.conversations} viraram reserva{row.response_minutes == null ? "" : ` · resposta mediana ${Math.round(row.response_minutes)} min`}</p>)}
      </section>
    </div>
  );
}
