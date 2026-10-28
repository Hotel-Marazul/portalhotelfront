"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, ChevronLeft, PanelRight } from "lucide-react";
import { api } from "../../services/api";
import { useVisiblePolling } from "../../hooks/useVisiblePolling";
import { dedupeDays, initials, keepLatestAiMarker, mergeTimeline } from "../../utils/whatsapp";
import type { ConversationDetail, QueueItem, QueueResponse, Suggestion, TimelineItem } from "../../types/whatsapp";
import ModalHospede, { type HospedeSuccessClient } from "../clientes/ModalHospede";
import ModalNovaReserva, { type ReservationClient } from "../clientes/ModalNovaReserva";
import Sheet from "../ui/Sheet";
import { toast } from "../ui/Toast";
import { cx } from "../ui/cx";
import AiReadingPanel from "./AiReadingPanel";
import ConversationTimeline from "./ConversationTimeline";
import GuestPanel from "./GuestPanel";
import LinkContactDialog from "./LinkContactDialog";
import QueueColumn, { avatarClass, type QueueFilter } from "./QueueColumn";
import ReplyComposer from "./ReplyComposer";
import { appendPrivacyNotice, firstName, remainingGaps } from "./whatsapp-view";

const EMPTY_QUEUE: QueueResponse = {
  waiting: [],
  answered: [],
  counts: { todas: 0, lead: 0, reserva: 0, outros: 0 },
};

function errorMessage(error: unknown): string {
  const response = (error as { response?: { data?: { message?: string } } })?.response;
  return response?.data?.message ?? "Não foi possível carregar o WhatsApp.";
}

function errorCode(error: unknown): string | null {
  return (error as { response?: { data?: { code?: string } } })?.response?.data?.code ?? null;
}

// O id evita repetir o mesmo aviso a cada rodada do polling.
function showError(message: string) {
  toast.error(message, { id: message });
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
  const [queueError, setQueueError] = useState<string | null>(null);
  const [filter, setFilter] = useState<QueueFilter>("todas");
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
  const [suggestionCollapsed, setSuggestionCollapsed] = useState(false);
  const [conversationChanged, setConversationChanged] = useState(false);
  const [retryingMessageId, setRetryingMessageId] = useState<string | null>(null);
  const [guestModalOpen, setGuestModalOpen] = useState(false);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [reservationModalOpen, setReservationModalOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLDivElement>(null);
  const previousLastMessageId = useRef<string | null>(null);
  const loadedConversationRef = useRef<string | null>(null);

  const loadQueue = useCallback(async () => {
    try {
      const response = await api.get<QueueResponse>("/api/whatsapp/queue", { params: { filter } });
      setQueue(response.data);
      setQueueError(null);
    } catch (requestError) {
      setQueueError(errorMessage(requestError));
    }
  }, [filter]);

  const loadStatus = useCallback(async () => {
    try {
      const response = await api.get("/api/whatsapp/status");
      setStatus(response.data);
    } catch {
      // O erro da fila já diz mais que um erro de estado.
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
      showError(errorMessage(requestError));
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
      showError(errorMessage(requestError));
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
        showError(errorMessage(requestError));
      }
    }, 250);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    if (conversationId) setLoading(false);
    setDetailsOpen(false);
  }, [conversationId]);

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
      showError(errorMessage(requestError));
    }
  };

  const dismissConversation = async () => {
    if (!conversationId) return;
    try {
      await api.post(`/api/whatsapp/conversations/${conversationId}/dismiss`);
      await loadQueue();
      router.push("/whatsapp");
    } catch (requestError) {
      showError(errorMessage(requestError));
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
      showError(errorMessage(requestError));
    }
  };

  const retryMessage = async (messageId: string) => {
    setRetryingMessageId(messageId);
    try {
      await api.post(`/api/whatsapp/messages/${messageId}/retry`);
      await loadConversation();
    } catch (requestError) {
      showError(errorMessage(requestError));
    } finally {
      setRetryingMessageId(null);
    }
  };

  // Trechos da sugestão usada que continuam no texto; o backend recusa o envio com eles.
  const gaps = remainingGaps(text, suggestionId && suggestion?.id === suggestionId ? suggestion.parts : null);

  const send = async (force = false) => {
    if (!conversationId || !text.trim()) return;
    if (gaps.length) {
      showError("Complete os trechos destacados pela sugestão antes de enviar.");
      return;
    }
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
        showError("Alguém respondeu enquanto você escrevia. Revise a conversa antes de enviar.");
      } else if (code === "unfilled_gap") {
        showError("Complete os trechos destacados pela sugestão antes de enviar.");
      } else if (code === "whatsapp_disconnected") {
        showError("O número está desconectado. A mensagem foi preservada para você tentar depois.");
      } else {
        showError(errorMessage(requestError));
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
      showError(errorMessage(requestError));
    }
  };

  const linkCreatedGuest = async (client?: HospedeSuccessClient) => {
    setGuestModalOpen(false);
    if (!client || !detail) return;
    try {
      await api.put(`/api/whatsapp/contacts/${detail.contact.id}/link`, { clientId: client.id });
      await loadConversation();
    } catch (requestError) {
      showError(errorMessage(requestError));
    }
  };

  // A reserva não marca o desfecho sozinha: a recepção confirma pelo aviso.
  const reservationCreated = () => {
    toast.success("Reserva criada.", {
      duration: Infinity,
      action: { label: "Marcar como “Virou reserva”", onClick: () => void updateOutcome("booked") },
    });
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
        conversationName: detail?.contact.pushName || guest?.fullName,
        adults: reading.adults ?? undefined,
        childAges: reading.childrenAges,
      }
    : undefined, [reading, reservationClient, detail, guest]);

  const sendBlocked = status.enabled === false || (status.connectionState !== undefined && status.connectionState !== "open");
  const statusNotice = status.enabled === false
    ? { title: "WhatsApp desligado.", hint: "Ative o módulo para receber e enviar mensagens." }
    : status.connectionState && status.connectionState !== "open"
      ? { title: "Número desconectado · envio bloqueado.", hint: "Mensagens novas podem não chegar. Peça ao gerente para reconectar em Configurações." }
      : null;
  const aiNotice = status.ai && !status.ai.available
    ? `IA ${status.ai.reason === "disabled" ? "desligada" : status.ai.reason === "daily_limit" ? "no limite diário" : "indisponível"}`
    : null;
  const renderedTimeline = keepLatestAiMarker(timeline);
  const privacyNotice = detail?.privacyNotice?.trim() ?? "";

  const detailsContent = detail ? (
    <>
      <AiReadingPanel detail={detail} onFeedback={(verdict) => void submitFeedback(verdict)} />
      <GuestPanel
        detail={detail}
        onCreateGuest={() => setGuestModalOpen(true)}
        onLinkGuest={() => setLinkDialogOpen(true)}
        onNewReservation={() => setReservationModalOpen(true)}
      />
    </>
  ) : null;

  return (
    <section
      aria-label="Central do WhatsApp"
      className="relative flex min-h-0 flex-1 max-[899px]:min-h-[70dvh] min-[900px]:grid min-[900px]:grid-cols-[280px_minmax(0,1fr)] min-[1200px]:grid-cols-[288px_minmax(0,1fr)_296px] min-[1440px]:grid-cols-[316px_minmax(0,1fr)_320px]"
    >
      <QueueColumn
        className={cx("max-[899px]:flex-1", conversationId && "max-[899px]:hidden")}
        queue={queue}
        queueError={queueError}
        filter={filter}
        onFilter={setFilter}
        search={search}
        onSearch={setSearch}
        searchResults={searchResults}
        conversationId={conversationId}
        nextConversation={nextConversation}
        aiNotice={aiNotice}
        onOpen={openConversation}
      />

      <section aria-labelledby={detail ? "conversa-nome" : undefined} aria-label={detail ? undefined : "Conversa"} className={cx("flex min-h-0 min-w-0 flex-col max-[899px]:flex-1", !conversationId && "max-[899px]:hidden")}>
        {detail ? (
          <>
            <header className="flex shrink-0 flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-rule px-5 py-3 max-[899px]:px-3">
              <div className="flex min-w-0 items-center gap-3">
                <button type="button" onClick={() => router.push("/whatsapp")} aria-label="Voltar para a fila" className="-ml-1.5 grid size-9 place-items-center rounded-control text-fg hover:bg-muted min-[900px]:hidden">
                  <ChevronLeft aria-hidden="true" className="size-[18px]" />
                </button>
                <span aria-hidden="true" className={cx("grid size-[38px] shrink-0 place-items-center rounded-full text-[13px] font-semibold max-[899px]:hidden", avatarClass(Boolean(detail.guest)))}>
                  {initials(detail.contact.displayName)}
                </span>
                <span className="flex min-w-0 flex-col">
                  <h2 id="conversa-nome" className="m-0 truncate text-base font-semibold">{detail.contact.displayName}</h2>
                  <span className="font-mono text-xs text-fg-3">{detail.contact.phone}</span>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <label className="relative">
                  <span className="sr-only">Desfecho do atendimento</span>
                  <select
                    value={detail.episode?.outcome ?? ""}
                    onChange={(event) => void updateOutcome(event.target.value || null)}
                    className="h-8 cursor-pointer rounded-control border border-border bg-surface px-2.5 text-[13px] text-fg"
                  >
                    <option value="">Em andamento</option>
                    <option value="booked">Virou reserva</option>
                    <option value="not_booked">Não fechou</option>
                    <option value="not_lead">Não era lead</option>
                  </select>
                </label>
                <button type="button" onClick={() => void dismissConversation()} title="Tirar da fila sem responder" className="h-8 rounded-control px-2.5 text-[13px] text-fg-2 transition-colors hover:bg-muted hover:text-fg">
                  Não precisa resposta
                </button>
                <button type="button" onClick={() => setDetailsOpen(true)} className="inline-flex h-8 items-center gap-1.5 rounded-control border border-border px-2.5 text-[13px] text-fg transition-colors hover:bg-bg min-[1200px]:hidden">
                  <PanelRight aria-hidden="true" className="size-3.5" />
                  Detalhes
                </button>
              </div>
            </header>
            {statusNotice && <StatusNotice {...statusNotice} />}
            <ConversationTimeline
              ref={timelineRef}
              items={renderedTimeline}
              hasMore={hasMoreMessages}
              onLoadOlder={() => void loadOlderMessages()}
              retryingMessageId={retryingMessageId}
              onRetry={(messageId) => void retryMessage(messageId)}
            />
            <ReplyComposer
              ref={composerRef}
              contactName={detail.contact.displayName}
              firstName={firstName(detail.contact.displayName)}
              textareaRef={textareaRef}
              text={text}
              onTextChange={(value) => { setText(value); if (!value) setSuggestionVisible(true); }}
              onSend={() => void send()}
              sendBlocked={sendBlocked}
              remainingGaps={gaps.length}
              suggestion={suggestion && suggestionVisible ? suggestion : null}
              suggestionCollapsed={suggestionCollapsed}
              onToggleSuggestion={() => setSuggestionCollapsed((value) => !value)}
              onUseSuggestion={useSuggestion}
              onDismissSuggestion={() => void dismissSuggestion()}
              showFirstContact={detail.isFirstOutbound}
              onInsertPrivacyNotice={privacyNotice ? () => {
                setText((current) => appendPrivacyNotice(current, privacyNotice));
                window.requestAnimationFrame(() => textareaRef.current?.focus());
              } : null}
              conversationChanged={conversationChanged}
              onForceSend={() => void send(true)}
            />
          </>
        ) : (
          <>
            {statusNotice && <StatusNotice {...statusNotice} />}
            <div className="grid flex-1 place-items-center content-center gap-2 p-8 text-center text-fg-2">
              <strong className="text-[15px] font-semibold text-fg">{conversationId ? "Abrindo conversa…" : "Escolha uma conversa"}</strong>
              <span className="text-sm">A fila mostra primeiro quem precisa de resposta agora.</span>
              {nextConversation && (
                <button type="button" onClick={() => openConversation(nextConversation.conversationId)} className="mt-2 inline-flex min-h-9 items-center gap-2 rounded-control bg-fg px-3.5 text-sm font-medium text-on-dark transition-colors hover:bg-fg/85">
                  Atender {nextConversation.displayName}
                  <ArrowRight aria-hidden="true" className="size-3.5" />
                </button>
              )}
              <small className="text-xs">
                Atalho: <kbd className="rounded border border-b-2 border-border bg-surface px-1.5 font-mono text-[11px]">Alt</kbd> + <kbd className="rounded border border-b-2 border-border bg-surface px-1.5 font-mono text-[11px]">N</kbd>
              </small>
            </div>
          </>
        )}
      </section>

      <aside aria-label="Detalhes da conversa" className="hidden min-h-0 flex-col gap-4 overflow-y-auto border-l border-rule bg-bg/50 px-[18px] py-4 min-[1200px]:flex">
        {/* Com a gaveta aberta, o conteúdo fica só nela, sem ids repetidos. */}
        {detailsOpen ? null : detailsContent ?? <p className="m-0 text-[13px] text-fg-2">A leitura da IA aparece ao abrir uma conversa.</p>}
      </aside>

      {detail && (
        <Sheet open={detailsOpen} onOpenChange={setDetailsOpen} title={detail.contact.displayName} description="Leitura da IA e cadastro do contato">
          <div className="flex flex-col gap-4">{detailsContent}</div>
        </Sheet>
      )}
      {detail && <ModalHospede open={guestModalOpen} onClose={() => setGuestModalOpen(false)} onSuccess={linkCreatedGuest} mode="adicionar" initialValues={{ fullName: detail.contact.pushName, fone: detail.contact.phone }} />}
      {detail && <LinkContactDialog open={linkDialogOpen} contactId={detail.contact.id} onClose={() => setLinkDialogOpen(false)} onLinked={() => void loadConversation()} />}
      {reservationClient && <ModalNovaReserva open={reservationModalOpen} onClose={() => setReservationModalOpen(false)} onSuccess={reservationCreated} initialValues={reservationInitialValues} />}
      {loading && <span className="absolute top-2 right-3 text-[11px] text-fg-3" aria-live="polite">Carregando…</span>}
    </section>
  );
}

function StatusNotice({ title, hint }: { title: string; hint: string }) {
  return (
    <div role="status" className="flex shrink-0 flex-wrap items-center gap-x-2.5 gap-y-1 bg-danger-bg px-5 py-2.5 text-[13px] text-danger">
      <strong className="font-semibold">{title}</strong>
      <span>{hint}</span>
    </div>
  );
}
