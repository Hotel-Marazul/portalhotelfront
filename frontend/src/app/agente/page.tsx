"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { FiMessageCircle, FiRefreshCw, FiSend } from "react-icons/fi";
import PageHeader from "../../components/layout/PageHeader";
import PageSection from "../../components/layout/PageSection";

type Role = "user" | "assistant" | "system";

type ChatMessage = {
  id: string;
  role: Role;
  text: string;
  meta?: string;
  thought?: string;
  tools?: string[];
};

type AgentChatResponse = {
  reply: string;
  intent: string;
  explanation: string;
  evidence?: Array<{ source: string; excerpt?: string | null }>;
  action?: { type?: string; status?: string; resource_id?: string | null };
  missing_fields?: string[];
};

const STORAGE_CONVERSATION_KEY = "agents.conversation_id";
const STORAGE_MESSAGES_KEY = "agents.messages";

function generateConversationId() {
  if (typeof window !== "undefined" && window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }
  return `conv-${Date.now()}`;
}

export default function AgentePage() {
  const [conversationId, setConversationId] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messageInput, setMessageInput] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [healthStatus, setHealthStatus] = useState<"checking" | "online" | "offline">("checking");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const savedId = localStorage.getItem(STORAGE_CONVERSATION_KEY);
    const nextId = savedId || generateConversationId();
    setConversationId(nextId);
    localStorage.setItem(STORAGE_CONVERSATION_KEY, nextId);

    const saved = localStorage.getItem(STORAGE_MESSAGES_KEY);
    if (saved) {
      try {
        setMessages(JSON.parse(saved) as ChatMessage[]);
      } catch {
        localStorage.removeItem(STORAGE_MESSAGES_KEY);
      }
    }

    void checkHealth();
  }, []);

  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem(STORAGE_MESSAGES_KEY, JSON.stringify(messages));
    }
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const canSend = useMemo(
    () => messageInput.trim().length > 0 && !isSending,
    [isSending, messageInput]
  );

  async function checkHealth() {
    try {
      const res = await fetch("/api/agents/chat", { method: "GET", cache: "no-store" });
      setHealthStatus(res.ok ? "online" : "offline");
    } catch {
      setHealthStatus("offline");
    }
  }

  function startNewConversation() {
    const nextId = generateConversationId();
    setConversationId(nextId);
    localStorage.setItem(STORAGE_CONVERSATION_KEY, nextId);
    setMessages([]);
    localStorage.removeItem(STORAGE_MESSAGES_KEY);
  }

  async function handleSend(event: FormEvent) {
    event.preventDefault();
    if (!canSend) return;

    const text = messageInput.trim();
    setMessageInput("");

    setMessages((cur) => [
      ...cur,
      { id: `${Date.now()}-user`, role: "user", text },
    ]);
    setIsSending(true);

    try {
      const payload = {
        conversation_id: conversationId || generateConversationId(),
        user_message: text,
        channel: "web",
        locale: "pt-BR",
        metadata: {
          customer_name: customerName || null,
          phone: phone || null,
        },
      };

      const res = await fetch("/api/agents/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        setMessages((cur) => [
          ...cur,
          {
            id: `${Date.now()}-error`,
            role: "system",
            text: `Falha ao conversar com o agente (${res.status}).`,
          },
        ]);
        return;
      }

      const data = (await res.json()) as AgentChatResponse;
      const missingFields = data.missing_fields?.length
        ? `Campos faltantes: ${data.missing_fields.join(", ")}`
        : "";
      const actionSummary = data.action?.type
        ? `Ação: ${data.action.type} (${data.action.status || "n/a"})`
        : "";
      const tools = Array.from(
        new Set((data.evidence ?? []).map((e) => e.source).filter(Boolean))
      );

      setMessages((cur) => [
        ...cur,
        {
          id: `${Date.now()}-assistant`,
          role: "assistant",
          text: data.reply || "Sem resposta do agente.",
          thought: data.explanation || "",
          tools,
          meta: [data.intent ? `Intent: ${data.intent}` : "", actionSummary, missingFields]
            .filter(Boolean)
            .join(" · "),
        },
      ]);
    } catch {
      setMessages((cur) => [
        ...cur,
        {
          id: `${Date.now()}-network`,
          role: "system",
          text: "Erro de rede ao chamar o agente.",
        },
      ]);
    } finally {
      setIsSending(false);
    }
  }

  const statusConfig = {
    online: { label: "Online", color: "#16a34a", bg: "#dcfce7" },
    offline: { label: "Offline", color: "#dc2626", bg: "#fee2e2" },
    checking: { label: "Verificando...", color: "var(--text-muted)", bg: "var(--border)" },
  }[healthStatus];

  return (
    <div
      style={{
        minHeight: "calc(100vh - 64px)",
        display: "flex",
        flexDirection: "column",
        padding: "20px 24px",
        gap: "14px",
        maxWidth: "900px",
        margin: "0 auto",
        width: "100%",
      }}
    >
      <PageHeader
        title="Agente IA"
        description="Canal conversacional para triagem e apoio à recepção, com contexto e histórico local da conversa."
        actions={
          <>
            <Link href="/dashboard" className="rounded-md border border-[var(--border)] px-3 py-2 text-sm text-[var(--text-primary)] no-underline transition-colors hover:bg-slate-50">
              Dashboard
            </Link>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
                padding: "4px 10px",
                borderRadius: "20px",
                fontSize: "0.72rem",
                fontWeight: 600,
                color: statusConfig.color,
                background: statusConfig.bg,
              }}
            >
              <span
                style={{
                  width: "6px",
                  height: "6px",
                  borderRadius: "50%",
                  background: statusConfig.color,
                  flexShrink: 0,
                }}
              />
              {statusConfig.label}
            </span>
            <button
              type="button"
              onClick={startNewConversation}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                padding: "6px 12px",
                borderRadius: "8px",
                border: "1px solid var(--border)",
                background: "var(--surface)",
                color: "var(--text-muted)",
                fontSize: "0.78rem",
                fontFamily: "DM Sans, sans-serif",
                cursor: "pointer",
                transition: "all 0.12s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "var(--accent)";
                e.currentTarget.style.color = "var(--text-primary)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "var(--border)";
                e.currentTarget.style.color = "var(--text-muted)";
              }}
            >
              <FiRefreshCw size={13} />
              Nova conversa
            </button>
          </>
        }
      />

      <PageSection
        title="Contexto da conversa"
        description="Dados opcionais usados para ajudar a triagem e identificar o atendimento."
        actions={
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              padding: "6px 10px",
              borderRadius: "999px",
              border: "1px solid var(--border)",
              color: "var(--text-muted)",
              fontSize: "0.78rem",
              background: "var(--surface-alt)",
            }}
          >
            {conversationId ? conversationId.slice(0, 12) + "…" : "Sem conversa"}
          </span>
        }
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "14px",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <label style={{ fontSize: "0.68rem", fontWeight: 600, color: "var(--text-muted)", letterSpacing: "0.06em", textTransform: "uppercase" }}>
              Nome (opcional)
            </label>
            <input
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Ex: Maria Silva"
              style={inputStyle}
              onFocus={(e) => { e.target.style.borderColor = "var(--accent)"; }}
              onBlur={(e) => { e.target.style.borderColor = "var(--border)"; }}
            />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <label style={{ fontSize: "0.68rem", fontWeight: 600, color: "var(--text-muted)", letterSpacing: "0.06em", textTransform: "uppercase" }}>
              Telefone (opcional)
            </label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+55 11 99999-0000"
              style={inputStyle}
              onFocus={(e) => { e.target.style.borderColor = "var(--accent)"; }}
              onBlur={(e) => { e.target.style.borderColor = "var(--border)"; }}
            />
          </div>
        </div>
      </PageSection>

      <PageSection
        title="Conversa"
        description="Histórico da troca com o recepcionista IA."
        actions={
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "6px 10px",
              borderRadius: "999px",
              border: "1px solid var(--border)",
              color: statusConfig.color,
              fontSize: "0.78rem",
              background: statusConfig.bg,
            }}
          >
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: statusConfig.color }} />
            {statusConfig.label}
          </span>
        }
      >
        <div
          style={{
            minHeight: "360px",
            maxHeight: "54vh",
            overflowY: "auto",
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "12px",
            padding: "20px",
            display: "flex",
            flexDirection: "column",
            gap: "12px",
          }}
        >
          {messages.length === 0 ? (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                height: "100%",
                gap: "12px",
                color: "var(--text-muted)",
              }}
            >
              <FiMessageCircle size={32} style={{ opacity: 0.3 }} />
              <p style={{ margin: 0, fontSize: "0.875rem", textAlign: "center" }}>
                Envie uma mensagem para iniciar.
                <br />
                <span style={{ fontSize: "0.78rem", opacity: 0.7 }}>
                  Exemplo: &ldquo;Quero reservar de 2026-04-12 a 2026-04-15 para 2 pessoas&rdquo;
                </span>
              </p>
            </div>
          ) : (
            messages.map((msg) => <MessageBubble key={msg.id} message={msg} />)
          )}
          <div ref={messagesEndRef} />
        </div>
      </PageSection>

      <PageSection title="Enviar mensagem" description="Digite a solicitação e o agente responde com contexto e ação sugerida.">
        <form
          onSubmit={(e) => void handleSend(e)}
          style={{
            display: "flex",
            gap: "10px",
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <input
            value={messageInput}
            onChange={(e) => setMessageInput(e.target.value)}
            placeholder="Digite sua mensagem..."
            style={{ ...inputStyle, flex: 1, minWidth: "260px" }}
            onFocus={(e) => { e.target.style.borderColor = "var(--accent)"; }}
            onBlur={(e) => { e.target.style.borderColor = "var(--border)"; }}
          />
          <button
            type="submit"
            disabled={!canSend}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "7px",
              padding: "9px 18px",
              borderRadius: "8px",
              background: canSend ? "var(--accent)" : "var(--border)",
              color: canSend ? "#fff" : "var(--text-muted)",
              border: "none",
              fontSize: "0.875rem",
              fontWeight: 600,
              fontFamily: "DM Sans, sans-serif",
              cursor: canSend ? "pointer" : "not-allowed",
              transition: "all 0.12s",
              flexShrink: 0,
            }}
          >
            <FiSend size={15} />
            {isSending ? "Enviando..." : "Enviar"}
          </button>
        </form>
      </PageSection>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  padding: "8px 12px",
  border: "1px solid var(--border)",
  borderRadius: "8px",
  fontSize: "0.875rem",
  fontFamily: "DM Sans, sans-serif",
  color: "var(--text-primary)",
  background: "var(--surface)",
  outline: "none",
  width: "100%",
  boxSizing: "border-box",
  transition: "border-color 0.15s",
};

function MessageBubble({ message }: { message: { role: string; text: string; meta?: string; thought?: string; tools?: string[] } }) {
  const isUser = message.role === "user";
  const isSystem = message.role === "system";

  if (isUser) {
    return (
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <div
          style={{
            maxWidth: "80%",
            background: "var(--sidebar-bg)",
            color: "#f1f5f9",
            borderRadius: "12px 12px 2px 12px",
            padding: "10px 16px",
            fontSize: "0.875rem",
            lineHeight: 1.5,
          }}
        >
          <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{message.text}</p>
        </div>
      </div>
    );
  }

  if (isSystem) {
    return (
      <div
        style={{
          background: "#fef3c7",
          border: "1px solid #fde68a",
          borderRadius: "10px",
          padding: "10px 14px",
          fontSize: "0.8rem",
          color: "#92400e",
        }}
      >
        {message.text}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", justifyContent: "flex-start" }}>
      <div
        style={{
          maxWidth: "88%",
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderLeft: "3px solid var(--accent)",
          borderRadius: "2px 12px 12px 12px",
          padding: "12px 16px",
          fontSize: "0.875rem",
          lineHeight: 1.6,
          color: "var(--text-primary)",
        }}
      >
        <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{message.text}</p>
        {message.meta && (
          <p
            style={{
              margin: "8px 0 0",
              fontSize: "0.7rem",
              color: "var(--text-muted)",
              borderTop: "1px solid var(--border)",
              paddingTop: "6px",
            }}
          >
            {message.meta}
          </p>
        )}
        {message.thought && (
          <div
            style={{
              marginTop: "8px",
              padding: "6px 10px",
              background: "var(--surface-alt)",
              borderRadius: "6px",
              fontSize: "0.72rem",
              color: "var(--text-muted)",
            }}
          >
            <span style={{ fontWeight: 600 }}>Pensamento: </span>
            {message.thought}
          </div>
        )}
        {message.tools && message.tools.length > 0 && (
          <p style={{ margin: "6px 0 0", fontSize: "0.7rem", color: "var(--text-muted)" }}>
            <span style={{ fontWeight: 600 }}>Tools: </span>
            {message.tools.join(", ")}
          </p>
        )}
      </div>
    </div>
  );
}
