"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { FiArrowRight, FiCheck, FiCheckCircle, FiChevronDown, FiChevronLeft, FiChevronUp, FiClock, FiSearch, FiSend } from "react-icons/fi";
import { LuSparkles } from "react-icons/lu";
import { api } from "../../services/api";
import { useVisiblePolling } from "../../hooks/useVisiblePolling";
import { dayLabel, dedupeDays, deliveryMark, formatLastMessage, formatWaiting, initials, keepLatestAiMarker, levelLabel, mediaLabel, mergeTimeline, type DeliveryMark } from "../../utils/whatsapp";
import type { ConversationDetail, QueueItem, QueueResponse, Suggestion, TimelineItem } from "../../types/whatsapp";
import ModalHospede, { type HospedeSuccessClient } from "../clientes/ModalHospede";
import ModalNovaReserva, { type ReservationClient } from "../clientes/ModalNovaReserva";
import GuestPanel from "./GuestPanel";
import AiReadingPanel from "./AiReadingPanel";
import LinkContactDialog from "./LinkContactDialog";
import MessageMedia from "./media/MessageMedia";
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

function levelRail(level: QueueItem["level"]): string {
  if (level === "agora") return styles.railNow;
  if (level === "hoje") return styles.railToday;
  if (level === "espera") return styles.railLater;
  return "";
}

const FILTER_LABELS: Record<Filter, string> = { todas: "Todas", lead: "Leads", reserva: "Reserva", outros: "Outros" };

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
  const composerRef = useRef<HTMLDivElement>(null);
  const [suggestionCollapsed, setSuggestionCollapsed] = useState(false);
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

  useEffect(() => { setSuggestionCollapsed(false); }, [suggestion?.id]);

  // Quando a caixa de resposta cresce (sugestão, texto longo), a conversa encolhe;
  // quem estava no fim continua vendo a última mensagem.
  useEffect(() => {
    const composer = composerRef.current;
    const container = timelineRef.current;
    if (!composer || !container) return;
    let nearBottom = true;
    const track = () => { nearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 160; };
    container.addEventListener("scroll", track, { passive: true });
    const observer = new ResizeObserver(() => {
      if (nearBottom) requestAnimationFrame(() => container.scrollTo({ top: container.scrollHeight }));
    });
    observer.observe(composer);
    return () => {
      container.removeEventListener("scroll", track);
      observer.disconnect();
    };
  }, [detail?.contact.id]);

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

  const openConversation = useCallback((id: string) => {
    setLoading(true);
    router.push(`/whatsapp?c=${encodeURIComponent(id)}`);
  }, [router]);

  // Alt+N abre a próxima conversa da fila sem tirar a mão do teclado.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!event.altKey || event.key.toLowerCase() !== "n" || !nextConversation) return;
      event.preventDefault();
      openConversation(nextConversation.conversationId);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [nextConversation, openConversation]);

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

  const sendBlocked = status.enabled === false || (status.connectionState !== undefined && status.connectionState !== "open");
  const statusNotice = status.enabled === false
    ? { tone: styles.statusDanger, text: "WhatsApp desligado", hint: "Ative o módulo para receber e enviar mensagens." }
    : status.connectionState && status.connectionState !== "open"
      ? { tone: styles.statusDanger, text: "Número desconectado · envio bloqueado", hint: "Mensagens novas podem não chegar e o envio está bloqueado." }
      : null;
  const aiNotice = status.ai && !status.ai.available
    ? `IA ${status.ai.reason === "disabled" ? "desligada" : status.ai.reason === "daily_limit" ? "no limite diário" : "indisponível"}`
    : null;
  const renderedTimeline = keepLatestAiMarker(timeline);

  return (
    <section className={`${styles.workspace} ${conversationId ? styles.hasConversation : ""}`} aria-label="Central do WhatsApp">
      <aside className={styles.queue} aria-label="Fila de atendimento">
        <div className={styles.queueTop}>
          {(statusNotice || aiNotice) && (
            <div className={styles.statusStrip} role="status">
              {statusNotice && <span className={statusNotice.tone} title={statusNotice.hint}>{statusNotice.text}</span>}
              {aiNotice && <span className={styles.statusWarn}>{aiNotice}</span>}
            </div>
          )}
          <div className={styles.panelHeader}>
            <h2>Fila <span>{queue.counts.todas}</span></h2>
            <button type="button" className={styles.nextButton} onClick={() => nextConversation && openConversation(nextConversation.conversationId)} disabled={!nextConversation} title="Atalho: Alt+N">
              {nextConversation ? "Atender próximo" : "Fila vazia"}
              <FiArrowRight size={14} aria-hidden="true" />
            </button>
          </div>
          <label className={styles.search}>
            <span className="sr-only">Buscar conversa</span>
            <FiSearch size={14} aria-hidden="true" />
            <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar nome ou telefone" />
          </label>
          <div className={styles.filters} role="group" aria-label="Filtros da fila">
            {(["todas", "lead", "reserva", "outros"] as Filter[]).map((value) => (
              <button key={value} type="button" aria-pressed={filter === value} onClick={() => setFilter(value)}>
                {FILTER_LABELS[value]}
                {!searchResults && <small>{queue.counts[value]}</small>}
              </button>
            ))}
          </div>
        </div>
        <div className={styles.queueList}>
          <h3>{searchResults ? "Resultados" : "Aguardando resposta"}</h3>
          {visibleWaiting.map((item) => <QueueButton key={item.conversationId} item={item} active={item.conversationId === conversationId} onOpen={openConversation} />)}
          {!visibleWaiting.length && <p className={styles.empty}>Nenhuma conversa encontrada.</p>}
          {!searchResults && visibleAnswered.length > 0 && <h3>Conversas recentes</h3>}
          {visibleAnswered.map((item) => <QueueButton key={item.conversationId} item={item} active={item.conversationId === conversationId} onOpen={openConversation} />)}
        </div>
      </aside>

      <main className={styles.conversation} aria-live="polite">
        {detail ? (
          <>
            <header className={styles.conversationHeader}>
              <button type="button" className={styles.backButton} onClick={() => router.push("/whatsapp")} aria-label="Voltar para a fila"><FiChevronLeft size={18} aria-hidden="true" /></button>
              <span className={styles.headerAvatar} aria-hidden="true">{initials(detail.contact.displayName)}</span>
              <div className={styles.contactName}>
                <h2>{detail.contact.displayName}</h2>
                <p>{detail.contact.phone}</p>
              </div>
              {detail.level && <span className={levelClass(detail.level)}>{levelLabel(detail.level)}</span>}
              <div className={styles.headerActions}>
                <label className={styles.outcomeSelect}>
                  <span className="sr-only">Desfecho do atendimento</span>
                  <select value={detail.episode?.outcome ?? ""} onChange={(event) => void updateOutcome(event.target.value || null)}>
                    <option value="">Em andamento</option>
                    <option value="booked">Virou reserva</option>
                    <option value="not_booked">Não fechou</option>
                    <option value="not_lead">Não era lead</option>
                  </select>
                </label>
                <button type="button" className={styles.dismissButton} onClick={() => void dismissConversation()} title="Tirar da fila sem responder">
                  <FiCheckCircle size={14} aria-hidden="true" />
                  <span>Não precisa resposta</span>
                </button>
              </div>
            </header>
            <div className={styles.timeline} ref={timelineRef}>
              {hasMoreMessages && <button type="button" className={styles.loadOlder} onClick={() => void loadOlderMessages()}>Carregar anteriores</button>}
              {renderedTimeline.map((item, index) => {
                if (item.kind === "day") return <div key={`${item.kind}-${item.date}`} className={styles.day}>{dayLabel(item.date)}</div>;
                if (item.kind === "ai_marker") return <p key={`${item.kind}-${item.readingId}`} className={styles.aiMarker}><LuSparkles size={12} aria-hidden="true" />{item.text}</p>;
                const failed = item.status === "failed";
                const outbound = item.direction === "outbound";
                const media = item.media ?? null;
                const sticker = media && item.mediaType === "sticker" && !item.body;
                const previous = renderedTimeline[index - 1];
                // Mensagens seguidas do mesmo lado ficam juntas, como no WhatsApp.
                const grouped = previous?.kind === "message" && previous.direction === item.direction;
                return <article key={item.id} className={`${outbound ? styles.outboundBubble : styles.inboundBubble} ${grouped ? styles.grouped : ""} ${media ? styles.mediaBubble : ""} ${sticker ? styles.stickerBubble : ""} ${failed ? styles.outboundFailed : ""}`}>
                  {media && <MessageMedia messageId={item.id} mediaType={item.mediaType} media={media} caption={item.body} />}
                  {item.body ? <p>{item.body}</p> : !media && <p className={styles.mediaPlaceholder}>{mediaLabel(item.mediaType)}</p>}
                  <small className={styles.bubbleMeta}>
                    {outbound && <span>{item.origin === "phone" ? "Pelo celular" : item.sentBy ?? "Portal"}</span>}
                    <time dateTime={item.sentAt}>{new Date(item.sentAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</time>
                    <DeliveryIcon mark={deliveryMark(item.direction, item.status)} />
                  </small>
                  {failed && <><small className={styles.failureText}>{item.failureReason ?? "Falha no envio."}</small><button type="button" className={styles.detailActionSecondary} onClick={() => void retryMessage(item.id)} disabled={retryingMessageId === item.id}>{retryingMessageId === item.id ? "Reenviando…" : "Reenviar"}</button></>}
                </article>;
              })}
              {!timeline.length && <p className={styles.empty}>Nenhuma mensagem.</p>}
            </div>
            <div className={styles.composer} ref={composerRef}>
              {detail.isFirstOutbound && <p className={styles.notice}>Primeiro contato: inclua o aviso de registro.</p>}
              {conversationChanged && <p className={styles.notice}>A conversa mudou. <button type="button" className={styles.noticeAction} onClick={() => void send(true)}>Enviar mesmo assim</button></p>}
              {suggestion && suggestionVisible && <section className={styles.suggestion} aria-label="Sugestão da IA">
                <header className={styles.suggestionHeader}>
                  <button type="button" className={styles.suggestionToggle} aria-expanded={!suggestionCollapsed} onClick={() => setSuggestionCollapsed((value) => !value)}>
                    <LuSparkles size={13} aria-hidden="true" />
                    <strong>Sugestão</strong>
                    {suggestionCollapsed && <span className={styles.suggestionPreview}>{suggestion.text}</span>}
                    {suggestionCollapsed ? <FiChevronUp size={14} aria-hidden="true" /> : <FiChevronDown size={14} aria-hidden="true" />}
                  </button>
                  <div className={styles.suggestionActions}>
                    <button type="button" className={styles.suggestionDismiss} onClick={() => void dismissSuggestion()}>Descartar</button>
                    <button type="button" className={styles.suggestionUse} onClick={useSuggestion}>Usar e editar</button>
                  </div>
                </header>
                {!suggestionCollapsed && <>
                  <p className={styles.suggestionText}>{suggestion.parts.map((part, index) => part.gap ? <mark key={`${part.text}-${index}`}>{part.text}</mark> : <span key={`${part.text}-${index}`}>{part.text}</span>)}</p>
                  {suggestion.basis.length > 0 && <small className={styles.suggestionBasis}>Baseada em: {suggestion.basis.join(" · ")}</small>}
                </>}
              </section>}
              <div className={styles.replyRow}>
                <textarea ref={textareaRef} aria-label={`Resposta para ${detail.contact.displayName}`} placeholder={sendBlocked ? "Envio bloqueado enquanto o número estiver desconectado" : `Responder ${detail.contact.displayName}…`} rows={1} value={text} onChange={(event) => { setText(event.target.value); if (!event.target.value) setSuggestionVisible(true); }} onKeyDown={(event) => { if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return; event.preventDefault(); void send(); }} />
                <button type="button" className={styles.sendButton} onClick={() => void send()} disabled={!text.trim() || sendBlocked} aria-label="Enviar"><FiSend size={15} aria-hidden="true" /></button>
              </div>
            </div>
          </>
        ) : (
          <div className={styles.emptyState}>
            <strong>Escolha uma conversa</strong>
            <span>A fila mostra primeiro quem precisa de resposta agora.</span>
            {nextConversation && <button type="button" className={styles.nextButton} onClick={() => openConversation(nextConversation.conversationId)}>Atender {nextConversation.displayName}<FiArrowRight size={14} aria-hidden="true" /></button>}
            <small>Atalho: <kbd>Alt</kbd> + <kbd>N</kbd></small>
          </div>
        )}
      </main>

      <aside className={styles.details} aria-label="Detalhes da conversa">
        {detail ? <>
          <AiReadingPanel detail={detail} onFeedback={(verdict) => void submitFeedback(verdict)} />
          <GuestPanel
            detail={detail}
            onCreateGuest={() => setGuestModalOpen(true)}
            onLinkGuest={() => setLinkDialogOpen(true)}
            onNewReservation={() => setReservationModalOpen(true)}
          />
        </> : <p className={styles.empty}>A leitura da IA aparece ao abrir uma conversa.</p>}
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
  const when = item.awaitingSince ? formatWaiting(item.awaitingSince) : formatLastMessage(item.lastMessageAt);
  // A urgência vira uma barra de cor à esquerda; o texto fica para leitores de tela.
  return <button type="button" className={`${styles.queueItem} ${levelRail(item.level)} ${active ? styles.active : ""} ${item.unreadCount > 0 ? styles.unread : ""}`} aria-current={active ? "true" : undefined} onClick={() => onOpen(item.conversationId)}>
    <span className={styles.avatar} aria-hidden="true">{item.initials}</span>
    <span className={styles.queueCopy}>
      <span className={styles.queueLine}><strong>{item.displayName}</strong><time>{when.replace(/^há /, "")}</time></span>
      <span className={styles.queueLine}><small>{item.preview}</small>{item.unreadCount > 0 && <b aria-label={`${item.unreadCount} não lidas`}>{item.unreadCount}</b>}</span>
      {item.level && <span className="sr-only">Prioridade: {levelLabel(item.level)}</span>}
    </span>
  </button>;
}

const DELIVERY_LABELS: Record<NonNullable<DeliveryMark>, string> = {
  pending: "Enviando",
  sent: "Enviada",
  delivered: "Entregue",
  read: "Lida",
  failed: "Não enviada",
};

function DeliveryIcon({ mark }: { mark: DeliveryMark }) {
  if (!mark || mark === "failed") return null;
  const label = DELIVERY_LABELS[mark];
  if (mark === "pending") return <FiClock size={11} aria-label={label} title={label} />;
  return (
    <span className={`${styles.delivery} ${mark === "read" ? styles.deliveryRead : ""}`} aria-label={label} title={label}>
      <FiCheck size={12} aria-hidden="true" />
      {mark !== "sent" && <FiCheck size={12} aria-hidden="true" className={styles.secondCheck} />}
    </span>
  );
}
