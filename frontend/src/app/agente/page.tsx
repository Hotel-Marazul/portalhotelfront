"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

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
  evidence?: Array<{
    source: string;
    excerpt?: string | null;
  }>;
  action?: {
    type?: string;
    status?: string;
    resource_id?: string | null;
  };
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

  useEffect(() => {
    const savedConversationId = localStorage.getItem(STORAGE_CONVERSATION_KEY);
    const nextConversationId = savedConversationId || generateConversationId();
    setConversationId(nextConversationId);
    localStorage.setItem(STORAGE_CONVERSATION_KEY, nextConversationId);

    const savedMessages = localStorage.getItem(STORAGE_MESSAGES_KEY);
    if (savedMessages) {
      try {
        const parsed = JSON.parse(savedMessages) as ChatMessage[];
        setMessages(parsed);
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
  }, [messages]);

  const canSend = useMemo(() => messageInput.trim().length > 0 && !isSending, [isSending, messageInput]);

  async function checkHealth() {
    try {
      const response = await fetch("/api/agents/chat", { method: "GET", cache: "no-store" });
      setHealthStatus(response.ok ? "online" : "offline");
    } catch {
      setHealthStatus("offline");
    }
  }

  function startNewConversation() {
    const nextConversationId = generateConversationId();
    setConversationId(nextConversationId);
    localStorage.setItem(STORAGE_CONVERSATION_KEY, nextConversationId);
    setMessages([]);
    localStorage.removeItem(STORAGE_MESSAGES_KEY);
  }

  async function handleSend(event: FormEvent) {
    event.preventDefault();
    if (!canSend) return;

    const text = messageInput.trim();
    setMessageInput("");

    const userMessage: ChatMessage = {
      id: `${Date.now()}-user`,
      role: "user",
      text
    };
    setMessages((current) => [...current, userMessage]);
    setIsSending(true);

    try {
      const payload = {
        conversation_id: conversationId || generateConversationId(),
        user_message: text,
        channel: "web",
        locale: "pt-BR",
        metadata: {
          customer_name: customerName || null,
          phone: phone || null
        }
      };

      const response = await fetch("/api/agents/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorMessage: ChatMessage = {
          id: `${Date.now()}-error`,
          role: "system",
          text: `Falha ao conversar com o agente (${response.status}).`
        };
        setMessages((current) => [...current, errorMessage]);
        return;
      }

      const data = (await response.json()) as AgentChatResponse;
      const missingFields = data.missing_fields?.length
        ? `Campos faltantes: ${data.missing_fields.join(", ")}`
        : "";
      const actionSummary = data.action?.type ? `Acao: ${data.action.type} (${data.action.status || "n/a"})` : "";
      const tools = Array.from(new Set((data.evidence ?? []).map((item) => item.source).filter(Boolean)));

      const assistantMessage: ChatMessage = {
        id: `${Date.now()}-assistant`,
        role: "assistant",
        text: data.reply || "Sem resposta do agente.",
        thought: data.explanation || "",
        tools,
        meta: [data.intent ? `Intent: ${data.intent}` : "", actionSummary, missingFields].filter(Boolean).join(" | ")
      };
      setMessages((current) => [...current, assistantMessage]);
    } catch {
      const errorMessage: ChatMessage = {
        id: `${Date.now()}-network`,
        role: "system",
        text: "Erro de rede ao chamar o agente."
      };
      setMessages((current) => [...current, errorMessage]);
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div className="mx-auto flex h-[calc(100vh-5.5rem)] w-full max-w-5xl flex-col gap-4 p-6">
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl font-semibold text-gray-900">Recepcionista IA - Hotel Marazul</h1>
          <div
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              healthStatus === "online"
                ? "bg-emerald-100 text-emerald-700"
                : healthStatus === "offline"
                  ? "bg-red-100 text-red-700"
                  : "bg-gray-100 text-gray-600"
            }`}
          >
            {healthStatus === "online"
              ? "Agente online"
              : healthStatus === "offline"
                ? "Agente offline"
                : "Verificando conexao"}
          </div>
        </div>
        <p className="mt-2 text-sm text-gray-600">
          Pensamento resumido e tools usadas aparecem em cada resposta.
        </p>
      </div>

      <div className="grid gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm md:grid-cols-3">
        <label className="flex flex-col gap-1 text-sm text-gray-700">
          Nome (opcional)
          <input
            value={customerName}
            onChange={(event) => setCustomerName(event.target.value)}
            className="rounded-md border border-gray-300 px-3 py-2 outline-none ring-0 focus:border-blue-500"
            placeholder="Ex: Maria"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-gray-700">
          Telefone (opcional)
          <input
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            className="rounded-md border border-gray-300 px-3 py-2 outline-none ring-0 focus:border-blue-500"
            placeholder="Ex: +55 11 99999-0000"
          />
        </label>
        <div className="flex flex-col justify-end gap-2 text-sm text-gray-700">
          <span className="truncate">Conversation ID: {conversationId || "-"}</span>
          <button
            type="button"
            onClick={startNewConversation}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-50"
          >
            Nova conversa
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        {messages.length === 0 ? (
          <p className="text-sm text-gray-500">
            Envie uma mensagem para iniciar. Exemplo: &quot;Quero reservar de 2026-04-12 a 2026-04-15 para 2 pessoas&quot;.
          </p>
        ) : (
          <div className="space-y-3">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`rounded-lg px-4 py-3 text-sm ${
                  message.role === "user"
                    ? "ml-auto max-w-[85%] bg-blue-600 text-white"
                    : message.role === "assistant"
                      ? "mr-auto max-w-[90%] border border-gray-200 bg-gray-50 text-gray-900"
                      : "mr-auto max-w-[90%] border border-amber-200 bg-amber-50 text-amber-800"
                }`}
              >
                <p className="whitespace-pre-wrap">{message.text}</p>
                {message.meta ? <p className="mt-2 text-xs opacity-80">{message.meta}</p> : null}
                {message.thought ? (
                  <p className="mt-2 rounded bg-gray-100 px-2 py-1 text-xs text-gray-700">
                    Pensamento resumido: {message.thought}
                  </p>
                ) : null}
                {message.tools && message.tools.length > 0 ? (
                  <p className="mt-2 text-xs text-gray-600">Tools usadas: {message.tools.join(", ")}</p>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>

      <form onSubmit={(event) => void handleSend(event)} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex gap-3">
          <input
            value={messageInput}
            onChange={(event) => setMessageInput(event.target.value)}
            className="flex-1 rounded-md border border-gray-300 px-3 py-2 outline-none ring-0 focus:border-blue-500"
            placeholder="Digite sua mensagem..."
          />
          <button
            type="submit"
            disabled={!canSend}
            className="rounded-md bg-blue-600 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
          >
            {isSending ? "Enviando..." : "Enviar"}
          </button>
        </div>
      </form>
    </div>
  );
}
