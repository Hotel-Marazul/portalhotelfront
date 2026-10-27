import { FiActivity, FiAlertTriangle, FiCheckCircle, FiCpu, FiInbox, FiMessageCircle, FiRefreshCw, FiShield, FiWifi, FiWifiOff } from "react-icons/fi";
import Image from "next/image";
import type { WhatsappConfiguration } from "../../types/whatsapp";
import styles from "./configuration.module.css";

interface Props {
  configuration: WhatsappConfiguration;
  qrCode: string | null;
  busy: "qr" | "logout" | "history" | null;
  error: string | null;
  feedback: string | null;
  onRequestQr: () => void;
  onRequestLogout: () => void;
  onImportHistory: () => void;
  onRefresh: () => void;
}

const stateCopy = {
  open: { label: "Conectado", detail: "O número está pronto para enviar e receber mensagens." },
  connecting: { label: "Aguardando leitura", detail: "Leia o QR Code para concluir o pareamento." },
  close: { label: "Desconectado", detail: "Gere um QR Code para conectar o número do hotel." },
  unknown: { label: "Estado desconhecido", detail: "Atualize o diagnóstico ou tente conectar novamente." }
} as const;

function formatChangedAt(value: string | null): string {
  if (!value) return "Ainda sem evento de conexão";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

function Metric({ label, value, Icon, note }: { label: string; value: number; Icon: typeof FiInbox; note: string }) {
  return <article className={styles.metric}><div><span>{label}</span><Icon aria-hidden="true" /></div><strong>{value.toLocaleString("pt-BR")}</strong><small>{note}</small></article>;
}

export default function WhatsappConfigurationView({ configuration, qrCode, busy, error, feedback, onRequestQr, onRequestLogout, onImportHistory, onRefresh }: Props) {
  const { connection, agent, metrics } = configuration;
  const copy = stateCopy[connection.state];
  const connected = connection.state === "open";
  const canConnect = connection.enabled && connection.apiConfigured;
  const usagePercent = Math.min(100, Math.round((agent.dailyCalls / Math.max(1, agent.dailyLimit)) * 100));

  return <div className={styles.layout}>
    <section className={`${styles.card} ${styles.connectionCard}`} aria-labelledby="connection-title">
      <div className={styles.cardHeader}><div><p>Conexão</p><h2 id="connection-title">Número do hotel</h2></div><span className={`${styles.status} ${styles[connection.state]}`}>{connected ? <FiWifi aria-hidden="true" /> : <FiWifiOff aria-hidden="true" />}{copy.label}</span></div>
      <p className={styles.lead}>{copy.detail}</p>
      <dl className={styles.details}>
        <div><dt>Instância</dt><dd>{connection.instance}</dd></div>
        <div><dt>Última mudança</dt><dd>{formatChangedAt(connection.stateChangedAt)}</dd></div>
      </dl>
      <div className={styles.checks}>
        <span data-ok={connection.enabled}><FiCheckCircle aria-hidden="true" />Módulo habilitado</span>
        <span data-ok={connection.apiConfigured}><FiCheckCircle aria-hidden="true" />Evolution configurada</span>
        <span data-ok={connection.webhookConfigured}><FiCheckCircle aria-hidden="true" />Segredo do webhook configurado</span>
      </div>
      {!canConnect && <div className={styles.warning}><FiAlertTriangle aria-hidden="true" /><p>Complete as variáveis do WhatsApp no <code>.env</code> e reinicie os serviços para liberar o pareamento.</p></div>}
      {qrCode && <div className={styles.qrArea}><Image unoptimized src={qrCode} width={240} height={240} alt="QR Code temporário para conectar o WhatsApp do hotel" /><div><strong>Leia pelo celular do hotel</strong><ol><li>Abra o WhatsApp e vá em Aparelhos conectados.</li><li>Escolha Conectar um aparelho.</li><li>Aponte a câmera para este código.</li></ol><small>O código expira automaticamente e não fica salvo no portal.</small></div></div>}
      <div className={styles.actions}>
        <button type="button" className={styles.primaryButton} disabled={!canConnect || busy !== null} onClick={onRequestQr}>{busy === "qr" ? "Gerando…" : connected ? "Verificar conexão" : "Gerar QR Code"}</button>
        {connected && <button type="button" className={styles.secondaryButton} disabled={busy !== null} onClick={onImportHistory} title="Traz para a central as conversas que já estavam no celular">{busy === "history" ? "Importando…" : "Importar conversas"}</button>}
        {connected && <button type="button" className={styles.secondaryButton} disabled={busy !== null} onClick={onRequestLogout}>Desconectar</button>}
        <button type="button" className={styles.iconButton} aria-label="Atualizar diagnóstico" disabled={busy !== null} onClick={onRefresh}><FiRefreshCw aria-hidden="true" /></button>
      </div>
      {(error || feedback) && <p className={error ? styles.error : styles.feedback}>{error ?? feedback}</p>}
    </section>

    <aside className={`${styles.card} ${styles.agentCard}`} aria-labelledby="agent-title">
      <div className={styles.cardHeader}><div><p>Agente</p><h2 id="agent-title">IA assistida</h2></div><FiCpu className={styles.featureIcon} aria-hidden="true" /></div>
      <p className={styles.lead}>A IA organiza e sugere. Uma pessoa sempre revisa e envia a resposta.</p>
      <div className={styles.agentState}><span data-ok={agent.available}>{agent.available ? "Disponível" : agent.reason === "daily_limit" ? "Limite diário atingido" : agent.reason === "not_configured" ? "Configuração incompleta" : "Desativada"}</span><small>Modo {agent.mode}</small></div>
      <div className={styles.usage}><div><span>Uso hoje</span><strong>{agent.dailyCalls} de {agent.dailyLimit}</strong></div><progress value={agent.dailyCalls} max={Math.max(1, agent.dailyLimit)} aria-label={`${usagePercent}% da cota diária usada`} /><small>{usagePercent}% da cota diária</small></div>
      <div className={styles.securityNote}><FiShield aria-hidden="true" /><p>Credenciais e chaves continuam protegidas no servidor e nunca são enviadas ao navegador.</p></div>
      <p className={styles.retention}>Retenção das conversas: <strong>{configuration.data.retentionMonths} meses</strong></p>
    </aside>

    <section className={`${styles.card} ${styles.metricsCard}`} aria-labelledby="metrics-title">
      <div className={styles.cardHeader}><div><p>Observabilidade</p><h2 id="metrics-title">Operação do canal</h2></div><FiActivity className={styles.featureIcon} aria-hidden="true" /></div>
      <div className={styles.metrics}>
        <Metric label="Conversas" value={metrics.conversations} Icon={FiMessageCircle} note="histórico total" />
        <Metric label="Na fila" value={metrics.waiting} Icon={FiInbox} note="aguardando resposta" />
        <Metric label="Recebidas hoje" value={metrics.inboundToday} Icon={FiMessageCircle} note="mensagens de hóspedes" />
        <Metric label="Enviadas hoje" value={metrics.outboundToday} Icon={FiCheckCircle} note="portal e celular" />
        <Metric label="Falhas hoje" value={metrics.failedToday} Icon={FiAlertTriangle} note="envios que exigem atenção" />
      </div>
    </section>
  </div>;
}
