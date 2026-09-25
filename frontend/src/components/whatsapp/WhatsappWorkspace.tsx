"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "../../services/api";
import { useVisiblePolling } from "../../hooks/useVisiblePolling";
import { dayLabel, dedupeDays, formatWaiting, levelLabel, mergeTimeline } from "../../utils/whatsapp";
import type { ConversationDetail, QueueItem, QueueResponse, Suggestion, TimelineItem } from "../../types/whatsapp";
import ModalHospede, { type HospedeSuccessClient } from "../clientes/ModalHospede";
import ModalNovaReserva, { type ReservationClient } from "../clientes/ModalNovaReserva";
import GuestPanel from "./GuestPanel";
import AiReadingPanel from "./AiReadingPanel";
import LinkContactDialog from "./LinkContactDialog";
import styles from "./whatsapp.module.css";

const EMPTY_QUEUE: QueueResponse = {
  waiting: [],
  answered: [],
  counts: { todas: 0, lead: 0, reserva: 0, outros: 0 },
};

type Filter = "todas" | "lead" | "reserva" | "outros";

function levelClass(level: QueueItem["level"]): string {
  if (level === "agora") return styles.levelNow;
  if (level === "hoje") return styles.levelToday;
  return styles.levelLater;
}

function errorMessage(error: unknown): string {
  const response = (error as { response?: { data?: { message?: string } } })?.response;
  return response?.data?.message ?? "Não foi possível carregar o WhatsApp.";
}

function errorCode(error: unknown): string | null {
  return (error as { response?: { data?: { code?: string } } })?.response?.data?.code ?? null;
}

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export default function WhatsappWorkspace() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const conversationId = searchParams.get("c");
  const [queue, setQueue] = useState(EMPTY_QUEUE);
  const [filter, setFilter] = useState<Filter>("todas");
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<QueueItem[] | null>(null);
  const [detail, setDetail] = useState<ConversationDetail | null>(null);
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [status, setStatus] = useState<{ enabled?: boolean; connectionState?: string; ai?: { available: boolean; reason: string | null } }>({});
  const [text, setText] = useState("");
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  const [suggestionVisible, setSuggestionVisible] = useState(true);
  const [suggestionId, setSuggestionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [conversationChanged, setConversationChanged] = useState(false);
  const [retryingMessageId, setRetryingMessageId] = useState<string | null>(null);
  const [guestModalOpen, setGuestModalOpen] = useState(false);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [reservationModalOpen, setReservationModalOpen] = useState(false);
  const [reservationSuccess, setReservationSuccess] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const previousLastMessageId = useRef<string | null>(null);
  const loadedConversationRef = useRef<string | null>(null);
  const [loading, setLoading] = useState(false);

  const loadQueue = useCallback(async () => {
    try {
      const response = await api.get<QueueResponse>("/api/whatsapp/queue", { params: { filter } });
      setQueue(response.data);
      setError(null);
    } catch (requestError) {
      setError(errorMessage(requestError));
    }
  }, [filter]);

  const loadStatus = useCallback(async () => {
    try {
      const response = await api.get("/api/whatsapp/status");
      setStatus(response.data);
    } catch {
      // The queue error is more useful than replacing it with a status error.
    }
  }, []);

  const loadConversation = useCallback(async () => {
    if (!conversationId) {
      loadedConversationRef.current = null;
      previousLastMessageId.current = null;
      setDetail(null);
      setTimeline([]);
      setHasMoreMessages(false);
      setSuggestion(null);
      setSuggestionId(null);
      return;
    }
    try {
      const [conversation, messages] = await Promise.all([
        api.get<ConversationDetail>(`/api/whatsapp/conversations/${conversationId}`),
        api.get<{ items: TimelineItem[]; hasMore: boolean }>(`/api/whatsapp/conversations/${conversationId}/messages`, {
          params: { limit: 50 },
        }),
      ]);
      setDetail(conversation.data);
      if (loadedConversationRef.current === conversationId) {
        setTimeline((current) => mergeTimeline(current, messages.data.items));
      } else {
        loadedConversationRef.current = conversationId;
        previousLastMessageId.current = null;
        setTimeline(dedupeDays(messages.data.items));
        setHasMoreMessages(messages.data.hasMore);
      }
      if (!text.trim() && !suggestionId) {
        try {
          const suggestionResponse = await api.post<Suggestion>(`/api/whatsapp/conversations/${conversationId}/suggestion`);
          setSuggestion(suggestionResponse.status === 200 ? suggestionResponse.data : null);
          setSuggestionVisible(true);
        } catch {
          setSuggestion(null);
        }
      }
      await api.post(`/api/whatsapp/conversations/${conversationId}/read`);
    } catch (requestError) {
      setError(errorMessage(requestError));
    }
  }, [conversationId, suggestionId, text]);

  useVisiblePolling(loadQueue, 10_000);
  useVisiblePolling(loadStatus, 30_000);
  useVisiblePolling(loadConversation, 4_000, Boolean(conversationId));

  const loadOlderMessages = async () => {
    if (!conversationId || !hasMoreMessages) return;
    const firstMessage = timeline.find((item) => item.kind === "message");
    if (!firstMessage) return;
    try {
      const response = await api.get<{ items: TimelineItem[]; hasMore: boolean }>(`/api/whatsapp/conversations/${conversationId}/messages`, {
        params: { before: firstMessage.id, limit: 50 },
      });
      setTimeline((current) => dedupeDays([...response.data.items, ...current]));
      setHasMoreMessages(response.data.hasMore);
    } catch (requestError) {
      setError(errorMessage(requestError));
    }
  };

  useEffect(() => {
    const lastMessage = [...timeline].reverse().find((item) => item.kind === "message");
    if (!lastMessage || previousLastMessageId.current === lastMessage.id) return;
    const first = previousLastMessageId.current === null;
    previousLastMessageId.current = lastMessage.id;
    const container = timelineRef.current;
    if (!container) return;
    // A rolagem só acompanha quem já estava no fim da conversa.
    const nearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 160;
    if (!first && !nearBottom) return;
    container.scrollTo({ top: container.scrollHeight, behavior: first ? "auto" : "smooth" });
  }, [timeline]);

  useEffect(() => {
    const value = search.trim();
    if (value.length < 2) {
      setSearchResults(null);
      return;
    }
    const timer = window.setTimeout(async () => {
      try {
        const response = await api.get<{ items: QueueItem[] }>("/api/whatsapp/conversations", { params: { search: value } });
        setSearchResults(response.data.items);
      } catch (requestError) {
        setError(errorMessage(requestError));
      }
    }, 250);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    if (conversationId) setLoading(false);
  }, [conversationId]);

  const visibleWaiting = searchResults ?? queue.waiting;
  const visibleAnswered = searchResults ? [] : queue.answered;
  const nextConversation = useMemo(
    () => queue.waiting.find((item) => item.conversationId !== conversationId),
    [conversationId, queue.waiting],
  );

  const openConversation = (id: string) => {
    setLoading(true);
    router.push(`/whatsapp?c=${encodeURIComponent(id)}`);
  };

  const updateOutcome = async (outcome: string | null) => {
    if (!conversationId) return;
    try {
      await api.put(`/api/whatsapp/conversations/${conversationId}/outcome`, { outcome });
      await loadConversation();
      await loadQueue();
    } catch (requestError) {
      setError(errorMessage(requestError));
    }
  };

  const dismissConversation = async () => {
    if (!conversationId) return;
    try {
      await api.post(`/api/whatsapp/conversations/${conversationId}/dismiss`);
      await loadQueue();
      router.push("/whatsapp");
    } catch (requestError) {
      setError(errorMessage(requestError));
    }
  };

  const useSuggestion = () => {
    if (!suggestion) return;
    setText(suggestion.text);
    setSuggestionId(suggestion.id);
    setSuggestionVisible(false);
    window.requestAnimationFrame(() => textareaRef.current?.focus());
  };

  const dismissSuggestion = async () => {
    if (!suggestion) return;
    try {
      await api.post(`/api/whatsapp/suggestions/${suggestion.id}/dismiss`);
      setSuggestion(null);
      setSuggestionVisible(false);
    } catch (requestError) {
      setError(errorMessage(requestError));
    }
  };

  const retryMessage = async (messageId: string) => {
    setRetryingMessageId(messageId);
    try {
      await api.post(`/api/whatsapp/messages/${messageId}/retry`);
      await loadConversation();
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setRetryingMessageId(null);
    }
  };

  const send = async (force = false) => {
    if (!conversationId || !text.trim()) return;
    const body = text;
    const lastMessage = [...timeline].reverse().find((item) => item.kind === "message");
    try {
      await api.post(`/api/whatsapp/conversations/${conversationId}/messages`, {
        text: body,
        clientRequestId: crypto.randomUUID(),
        suggestionId,
        lastSeenMessageId: lastMessage?.kind === "message" ? lastMessage.id : null,
        force,
      });
      setText("");
      setSuggestionId(null);
      setConversationChanged(false);
      await loadConversation();
    } catch (requestError) {
      const code = errorCode(requestError);
      if (code === "conversation_changed") {
        setConversationChanged(true);
        setError("Alguém respondeu enquanto você escrevia. Revise a conversa antes de enviar.");
      } else if (code === "unfilled_gap") {
        setError("Complete os trechos destacados pela sugestão antes de enviar.");
      } else if (code === "whatsapp_disconnected") {
        setError("O número está desconectado. A mensagem foi preservada para você tentar depois.");
      } else {
        setError(errorMessage(requestError));
      }
    }
  };

  const submitFeedback = async (verdict: "correct" | "should_be_higher" | "should_be_lower") => {
    if (!conversationId || !detail) return;
    try {
      if (detail.myFeedback === verdict) {
        await api.delete(`/api/whatsapp/conversations/${conversationId}/priority-feedback`);
      } else {
        await api.post(`/api/whatsapp/conversations/${conversationId}/priority-feedback`, { verdict });
      }
      await loadConversation();
    } catch (requestError) {
      setError(errorMessage(requestError));
    }
  };

  const linkCreatedGuest = async (client?: HospedeSuccessClient) => {
    setGuestModalOpen(false);
    if (!client || !detail) return;
    try {
      await api.put(`/api/whatsapp/contacts/${detail.contact.id}/link`, { clientId: client.id });
      await loadConversation();
    } catch (requestError) {
      setError(errorMessage(requestError));
    }
  };

  const guest = detail?.guest;
  const reading = detail?.reading;
  const reservationClient = useMemo<ReservationClient | null>(() => guest
    ? { id: guest.clientId, fullName: guest.fullName, cpf: guest.maskedCpf, email: "" }
    : null, [guest]);
  const reservationInitialValues = useMemo(() => reading && reservationClient
    ? {
        client: reservationClient,
        checkInDate: parseDate(reading.checkIn),
        checkOutDate: parseDate(reading.checkOut),
      }
    : undefined, [reading, reservationClient]);

  return (
    <section className={`${styles.workspace} ${conversationId ? styles.hasConversation : ""}`} aria-label="Central do WhatsApp">
      <aside className={styles.queue} aria-label="Fila de atendimento">
        <div className={styles.panelHeader}>
          <div>
            <p className={styles.eyebrow}>Operação</p>
            <h2>WhatsApp <span>{queue.counts.todas}</span></h2>
          </div>
          <button type="button" onClick={() => nextConversation && openConversation(nextConversation.conversationId)} disabled={!nextConversation}>
            {nextConversation ? "Atender próximo" : "Fila vazia"}
          </button>
        </div>
        <label className={styles.searchLabel}>
          <span>Buscar conversa</span>
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nome ou telefone" />
        </label>
        <div className={styles.filters} role="group" aria-label="Filtros da fila">
          {(["todas", "lead", "reserva", "outros"] as Filter[]).map((value) => (
            <button key={value} type="button" aria-pressed={filter === value} onClick={() => setFilter(value)}>
              {value === "todas" ? "Todas" : value === "lead" ? "Leads" : value === "reserva" ? "Com reserva" : "Outros"}
              {!searchResults && <small>{queue.counts[value]}</small>}
            </button>
          ))}
        </div>
        <div className={styles.queueList}>
          <h3>{searchResults ? "Resultados" : "Aguardando resposta"}</h3>
          {visibleWaiting.map((item) => <QueueButton key={item.conversationId} item={item} active={item.conversationId === conversationId} onOpen={openConversation} />)}
          {!visibleWaiting.length && <p className={styles.empty}>Nenhuma conversa encontrada.</p>}
          {!searchResults && visibleAnswered.length > 0 && <h3>Respondidas · esperando o hóspede</h3>}
          {visibleAnswered.map((item) => <QueueButton key={item.conversationId} item={item} active={item.conversationId === conversationId} onOpen={openConversation} />)}
        </div>
      </aside>

      <main className={styles.conversation} aria-live="polite">
        {!status.enabled && status.enabled !== undefined && <div className={styles.banner}>WhatsApp está desligado. Ative o módulo para receber e enviar mensagens.</div>}
        {status.enabled !== false && status.connectionState && status.connectionState !== "open" && <div className={styles.banner}>Número desconectado. Mensagens novas podem não chegar e o envio está bloqueado.</div>}
        {status.ai && !status.ai.available && <div className={styles.aiBanner}>IA: {status.ai.reason === "disabled" ? "desligada" : status.ai.reason === "daily_limit" ? "limite diário atingido" : "indisponível no momento"}.</div>}
        {detail ? (
          <>
            <header className={styles.conversationHeader}>
              <button type="button" className={styles.backButton} onClick={() => router.push("/whatsapp")}>Voltar</button>
              <div><h2>{detail.contact.displayName}</h2><p>{detail.contact.phone}</p></div>
              {detail.level && <span className={levelClass(detail.level)}>{levelLabel(detail.level)}</span>}
              <label className={styles.outcomeSelect}><span>Desfecho</span><select value={detail.episode?.outcome ?? ""} onChange={(event) => void updateOutcome(event.target.value || null)}><option value="">Em andamento</option><option value="booked">Virou reserva</option><option value="not_booked">Não fechou</option><option value="not_lead">Não era lead</option></select></label>
              <button type="button" className={styles.dismissButton} onClick={() => void dismissConversation()}>Não precisa resposta</button>
            </header>
            <div className={styles.timeline} ref={timelineRef}>
              {hasMoreMessages && <button type="button" className={styles.detailActionSecondary} onClick={() => void loadOlderMessages()}>Carregar anteriores</button>}
              {timeline.map((item) => {
                if (item.kind === "day") return <div key={`${item.kind}-${item.date}`} className={styles.day}>{dayLabel(item.date)}</div>;
                if (item.kind === "ai_marker") return <div key={`${item.kind}-${item.readingId}`} className={styles.aiMarker}>{item.text}</div>;
                const failed = item.status === "failed";
                return <article key={item.id} className={`${item.direction === "outbound" ? styles.outboundBubble : styles.inboundBubble} ${failed ? styles.outboundFailed : ""}`}>
                  <p>{item.body || item.mediaType}</p>
                  <small>{item.origin === "phone" ? "pelo celular" : item.sentBy ?? item.origin} · {new Date(item.sentAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} · {item.status}</small>
                  {failed && <><small className={styles.failureText}>{item.failureReason ?? "Falha no envio."}</small><button type="button" className={styles.detailActionSecondary} onClick={() => void retryMessage(item.id)} disabled={retryingMessageId === item.id}>{retryingMessageId === item.id ? "Reenviando…" : "Reenviar"}</button></>}
                </article>;
              })}
              {!timeline.length && <p className={styles.empty}>Nenhuma mensagem.</p>}
            </div>
            <div className={styles.composer}>
              {detail.isFirstOutbound && <p className={styles.notice}>Primeiro contato: inclua o aviso de registro.</p>}
              {conversationChanged && <p className={styles.notice}>A conversa mudou. <button type="button" className={styles.toastAction} onClick={() => void send(true)}>Revisar e enviar mesmo assim</button></p>}
              {suggestion && suggestionVisible && <div className={styles.suggestionCard}>
                <strong>Sugestão da IA</strong><small>Usou: {suggestion.basis.join(", ")}</small>
                <p>{suggestion.parts.map((part, index) => part.gap ? <mark key={`${part.text}-${index}`}>{part.text}</mark> : <span key={`${part.text}-${index}`}>{part.text}</span>)}</p>
                <div><button type="button" onClick={useSuggestion}>Usar e editar</button><button type="button" onClick={() => void dismissSuggestion()}>Descartar</button></div>
              </div>}
              <label><span>Resposta para {detail.contact.displayName}</span><textarea ref={textareaRef} value={text} onChange={(event) => { setText(event.target.value); if (!event.target.value) setSuggestionVisible(true); }} onKeyDown={(event) => { if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return; event.preventDefault(); void send(); }} /></label>
              <button type="button" onClick={() => void send()} disabled={!text.trim() || status.enabled === false || (status.connectionState !== undefined && status.connectionState !== "open")}>Enviar</button>
            </div>
          </>
        ) : (
          <div className={styles.emptyState}><strong>Escolha uma conversa</strong><span>A fila mostra o que precisa de resposta agora.</span></div>
        )}
      </main>

      <aside className={styles.details} aria-label="Detalhes da conversa">
        {detail ? <>
          <AiReadingPanel detail={detail} />
          <section className={styles.detailSection} aria-labelledby="priority-feedback-title">
            <h3 id="priority-feedback-title">Prioridade</h3>
            <div className={styles.feedbackGroup} role="group" aria-label="Corrigir prioridade">
              {(["correct", "should_be_higher", "should_be_lower"] as const).map((verdict) => (
                <button key={verdict} type="button" aria-pressed={detail.myFeedback === verdict} onClick={() => void submitFeedback(verdict)}>
                  {verdict === "correct" ? "Sim" : verdict === "should_be_higher" ? "Subir" : "Descer"}
                </button>
              ))}
            </div>
            {detail.myFeedback && <p>Correção registrada. Clique novamente para desfazer.</p>}
          </section>
          <GuestPanel
            detail={detail}
            onCreateGuest={() => setGuestModalOpen(true)}
            onLinkGuest={() => setLinkDialogOpen(true)}
            onNewReservation={() => setReservationModalOpen(true)}
          />
        </> : <p className={styles.empty}>Os detalhes aparecem ao abrir uma conversa.</p>}
      </aside>
      {detail && <ModalHospede open={guestModalOpen} onClose={() => setGuestModalOpen(false)} onSuccess={linkCreatedGuest} mode="adicionar" initialValues={{ fullName: detail.contact.pushName, fone: detail.contact.phone }} />}
      {detail && <LinkContactDialog open={linkDialogOpen} contactId={detail.contact.id} onClose={() => setLinkDialogOpen(false)} onLinked={() => void loadConversation()} />}
      {reservationClient && <ModalNovaReserva open={reservationModalOpen} onClose={() => setReservationModalOpen(false)} onSuccess={() => setReservationSuccess(true)} initialValues={reservationInitialValues} />}
      {error && <div className={styles.toast} role="alert">{error} <button type="button" onClick={() => setError(null)}>Fechar</button></div>}
      {reservationSuccess && <div className={styles.toast} role="status">Reserva criada. <button type="button" className={styles.toastAction} onClick={() => { setReservationSuccess(false); void updateOutcome("booked"); }}>Marcar atendimento como &quot;Virou reserva&quot;</button><button type="button" onClick={() => setReservationSuccess(false)}>Fechar</button></div>}
      {loading && <span className={styles.loading} aria-live="polite">Carregando…</span>}
    </section>
  );
}

function QueueButton({ item, active, onOpen }: { item: QueueItem; active: boolean; onOpen: (id: string) => void }) {
  return <button type="button" className={`${styles.queueItem} ${active ? styles.active : ""}`} aria-current={active ? "true" : undefined} onClick={() => onOpen(item.conversationId)}>
    <span className={styles.avatar}>{item.initials}</span>
    <span className={styles.queueCopy}><strong>{item.displayName}</strong><small>{item.preview}</small><small>{item.awaitingSince ? formatWaiting(item.awaitingSince) : "Respondida"}</small></span>
    <span className={styles.queueMeta}>{item.level && <span className={levelClass(item.level)}>{levelLabel(item.level)}</span>}{item.unreadCount > 0 && <b>{item.unreadCount}</b>}</span>
  </button>;
}
