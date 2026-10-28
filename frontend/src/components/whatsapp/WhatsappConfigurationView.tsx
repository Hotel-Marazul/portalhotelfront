import { useEffect, useRef, type ReactNode } from "react";
import Image from "next/image";
import { Check, RefreshCw, X } from "lucide-react";
import type { WhatsappConfiguration } from "../../types/whatsapp";
import Button from "../ui/Button";
import { cx } from "../ui/cx";

interface Props {
  configuration: WhatsappConfiguration;
  qrCode: string | null;
  busy: "qr" | "logout" | "history" | null;
  error: string | null;
  feedback: string | null;
  confirmingLogout: boolean;
  onRequestQr: () => void;
  onRequestLogout: () => void;
  onCancelLogout: () => void;
  onConfirmLogout: () => void;
  onImportHistory: () => void;
  onRefresh: () => void;
}

const STATE_COPY = {
  open: { label: "Conectado", detail: "O número está pronto para enviar e receber mensagens.", tone: "bg-accent-100 text-accent-700" },
  connecting: { label: "Aguardando leitura", detail: "Leia o QR Code com o celular do hotel para concluir o pareamento.", tone: "bg-warn-bg text-warn-fg" },
  close: { label: "Desconectado", detail: "Gere um QR Code para conectar o número do hotel. Até lá, o envio fica bloqueado na central.", tone: "bg-danger-bg text-danger" },
  unknown: { label: "Estado desconhecido", detail: "Atualize o diagnóstico ou tente conectar novamente.", tone: "bg-muted text-fg-2" },
} as const;

function formatChangedAt(value: string | null): string {
  if (!value) return "Ainda sem evento de conexão";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

function agentState(agent: WhatsappConfiguration["agent"]) {
  if (agent.available) return { label: "Disponível", tone: "bg-accent-100 text-accent-700" };
  if (agent.reason === "daily_limit") return { label: "Limite diário atingido", tone: "bg-warn-bg text-warn-fg" };
  if (agent.reason === "not_configured") return { label: "Configuração incompleta", tone: "bg-warn-bg text-warn-fg" };
  return { label: "Desativada", tone: "bg-muted text-fg-2" };
}

function StateChip({ tone, children }: { tone: string; children: ReactNode }) {
  return (
    <span className={cx("inline-flex h-6 shrink-0 items-center gap-1.5 rounded-[7px] px-2.5 text-xs font-medium", tone)}>
      <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
      {children}
    </span>
  );
}

const columnClass = "flex min-h-0 flex-col gap-3.5 min-[1100px]:overflow-y-auto";
const sectionTitle = "m-0 text-[15px] font-semibold";

export default function WhatsappConfigurationView(props: Props) {
  const { configuration, qrCode, busy, error, feedback, confirmingLogout } = props;
  const { connection, agent, metrics } = configuration;
  const copy = STATE_COPY[connection.state];
  const connected = connection.state === "open";
  const canConnect = connection.enabled && connection.apiConfigured;
  const usagePercent = Math.min(100, Math.round((agent.dailyCalls / Math.max(1, agent.dailyLimit)) * 100));
  const agentChip = agentState(agent);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (confirmingLogout) cancelRef.current?.focus();
  }, [confirmingLogout]);

  const checks = [
    { ok: connection.enabled, label: "Módulo habilitado" },
    { ok: connection.apiConfigured, label: "Evolution configurada" },
    { ok: connection.webhookConfigured, label: "Segredo do webhook configurado" },
  ];
  const channel = [
    { label: "Na fila", value: metrics.waiting },
    { label: "Recebidas hoje", value: metrics.inboundToday },
    { label: "Enviadas hoje", value: metrics.outboundToday },
    { label: "Conversas no total", value: metrics.conversations },
    { label: "Falhas de envio hoje", value: metrics.failedToday, danger: metrics.failedToday > 0 },
  ];

  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 gap-10 min-[1100px]:grid-cols-3">
      <section aria-labelledby="conexao-titulo" className={columnClass}>
        <div className="flex items-center justify-between gap-2.5">
          <h2 id="conexao-titulo" className={sectionTitle}>Número do hotel</h2>
          <StateChip tone={copy.tone}>{copy.label}</StateChip>
        </div>
        <p className="m-0 text-[13px] leading-normal text-fg-2">{copy.detail}</p>

        {qrCode && (
          <div className="flex flex-col items-center gap-2 rounded-block bg-bg/60 p-4">
            <Image unoptimized src={qrCode} width={200} height={200} alt="QR Code temporário para conectar o WhatsApp do hotel" className="rounded-bar bg-surface p-2" />
            <span className="text-center text-[13px] text-fg-2">No celular do hotel: WhatsApp › Aparelhos conectados › Conectar um aparelho.</span>
            <span className="text-xs text-warn">O código expira sozinho e não fica salvo no portal.</span>
          </div>
        )}

        <dl className="m-0 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3.5 gap-y-2 text-[13px]">
          <dt className="text-fg-3">Instância</dt>
          <dd className="m-0 font-mono [overflow-wrap:anywhere]">{connection.instance}</dd>
          <dt className="text-fg-3">Última mudança</dt>
          <dd className="m-0">{formatChangedAt(connection.stateChangedAt)}</dd>
        </dl>
        <ul className="m-0 flex list-none flex-col gap-1.5 p-0 text-[13px]">
          {checks.map((check) => (
            <li key={check.label} className={cx("flex items-center gap-2", !check.ok && "text-fg-2")}>
              <span aria-hidden="true" className={cx("grid size-4 shrink-0 place-items-center rounded-full", check.ok ? "bg-accent text-on-dark" : "bg-danger-bg text-danger")}>
                {check.ok ? <Check className="size-2.5" strokeWidth={3} /> : <X className="size-2.5" strokeWidth={3} />}
              </span>
              {check.label}
              <span className="sr-only">{check.ok ? ": sim" : ": não"}</span>
            </li>
          ))}
        </ul>
        {!canConnect && (
          <p className="m-0 rounded-control bg-warn-bg px-3 py-2.5 text-[13px] leading-normal text-warn-fg">
            Complete as variáveis do WhatsApp no <code className="font-mono">.env</code> e reinicie os serviços para liberar o pareamento.
          </p>
        )}

        <div className="flex flex-wrap items-center gap-1.5">
          <Button size="sm" variant="primary" disabled={!canConnect || busy !== null} onClick={props.onRequestQr}>
            {busy === "qr" ? "Gerando…" : connected ? "Verificar conexão" : "Gerar QR Code"}
          </Button>
          {connected && (
            <Button size="sm" variant="outline" disabled={busy !== null} onClick={props.onImportHistory} title="Traz para a central as conversas que já estavam no celular">
              {busy === "history" ? "Importando…" : "Importar conversas"}
            </Button>
          )}
          {connected && (
            <Button size="sm" variant="ghost" className="text-danger hover:text-danger" disabled={busy !== null} onClick={props.onRequestLogout}>Desconectar</Button>
          )}
          <Button size="sm" variant="ghost" aria-label="Atualizar diagnóstico" title="Atualizar diagnóstico" disabled={busy !== null} onClick={props.onRefresh} className="px-2">
            <RefreshCw aria-hidden="true" />
          </Button>
        </div>

        {confirmingLogout && (
          <div
            role="alertdialog"
            aria-labelledby="logout-titulo"
            aria-describedby="logout-detalhe"
            onKeyDown={(event) => { if (event.key === "Escape" && busy !== "logout") props.onCancelLogout(); }}
            className="flex flex-col gap-2 rounded-[10px] bg-danger-bg p-3.5"
          >
            <strong id="logout-titulo" className="font-semibold text-danger">Desconectar o número?</strong>
            <span id="logout-detalhe" className="text-[13px] leading-[1.45] text-fg">O atendimento para até um novo pareamento. Conversas, vínculos e métricas ficam guardados.</span>
            <span className="flex gap-1.5">
              <Button ref={cancelRef} size="sm" variant="outline" onClick={props.onCancelLogout} disabled={busy === "logout"}>Cancelar</Button>
              <Button size="sm" variant="danger" onClick={props.onConfirmLogout} disabled={busy === "logout"}>{busy === "logout" ? "Desconectando…" : "Desconectar"}</Button>
            </span>
          </div>
        )}

        {error && <p role="alert" className="m-0 text-[13px] text-danger">{error}</p>}
        {!error && feedback && <p className="m-0 rounded-[10px] bg-accent-50 p-3 text-[13px] text-accent-700">{feedback}</p>}
      </section>

      <section aria-labelledby="ia-titulo" className={columnClass}>
        <div className="flex items-center justify-between gap-2.5">
          <h2 id="ia-titulo" className={sectionTitle}>IA assistida</h2>
          <StateChip tone={agentChip.tone}>{agentChip.label}</StateChip>
        </div>
        <p className="m-0 text-[13px] leading-normal text-fg-2">A IA lê, ordena e sugere. Uma pessoa sempre revisa e aperta enviar.</p>
        <div className="flex flex-col gap-1.5">
          <span className="flex justify-between text-[13px]">
            <span className="text-fg-3">Uso hoje</span>
            <span className="font-mono">{agent.dailyCalls} de {agent.dailyLimit}</span>
          </span>
          <div role="img" aria-label={`${agent.dailyCalls} de ${agent.dailyLimit} chamadas usadas hoje`} className="h-1.5 overflow-hidden rounded-[3px] bg-muted">
            <div className="h-full bg-accent" style={{ width: `${usagePercent}%` }} />
          </div>
          <span className="text-xs text-fg-3">{usagePercent}% da cota diária. Ao chegar no limite, a fila continua e as sugestões param até amanhã.</span>
        </div>
        <dl className="m-0 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3.5 gap-y-2 text-[13px]">
          <dt className="text-fg-3">Modo</dt>
          <dd className="m-0"><span className="capitalize">{agent.mode}</span> · nunca envia sozinha</dd>
          <dt className="text-fg-3">Retenção</dt>
          <dd className="m-0">Conversas guardadas por {configuration.data.retentionMonths} meses</dd>
        </dl>
      </section>

      <section aria-labelledby="canal-titulo" className={cx(columnClass, "gap-1.5")}>
        <h2 id="canal-titulo" className={cx(sectionTitle, "mb-1")}>Operação do canal</h2>
        <dl className="m-0 grid grid-cols-2 border-t border-rule">
          {channel.map((metric) => (
            <div key={metric.label} className="flex flex-col-reverse gap-0.5 border-b border-rule py-3">
              <dt className="text-xs text-fg-3">{metric.label}</dt>
              <dd className={cx("m-0 text-[22px] font-medium tracking-[-0.02em]", metric.danger && "text-danger")}>{metric.value.toLocaleString("pt-BR")}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
