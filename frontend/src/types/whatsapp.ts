export type Level = "agora" | "hoje" | "espera";
export type QueueGroup = "lead" | "reserva" | "outros";
export type ContactKind = "guest" | "supplier";
export type MessageDirection = "inbound" | "outbound";

export interface QueueItem {
  conversationId: string;
  contactId: string;
  displayName: string;
  initials: string;
  isKnownClient: boolean;
  level: Level | null;
  score: number | null;
  headline: string;
  preview: string;
  lastMessageAt: string;
  awaitingSince: string | null;
  unreadCount: number;
  group: QueueGroup;
}

export interface QueueResponse {
  waiting: QueueItem[];
  answered: QueueItem[];
  counts: { todas: number; lead: number; reserva: number; outros: number };
}

export interface ConversationDetail {
  id: string;
  contact: {
    id: string;
    displayName: string;
    phone: string;
    pushName: string;
    kind: ContactKind;
    clientId: string | null;
  };
  level: Level | null;
  score: number | null;
  position: number | null;
  reasons: Array<{ text: string; weight: number }>;
  reading: {
    id: string;
    intent: string;
    model: string;
    checkIn: string | null;
    checkOut: string | null;
    nights: number | null;
    adults: number | null;
    childrenAges: number[];
    requests: string[];
    missingFields: string[];
    availability: Array<{ category: string; roomsFree: number }>;
    prices: Array<{ category: string; total: string }>;
    canCreateReservation: boolean;
  } | null;
  guest: {
    clientId: string;
    fullName: string;
    maskedCpf: string;
    phone: string;
    clientSince: string;
    stays: number;
    reservations: Array<{
      id: string;
      code: string;
      status: string;
      room: string;
      category: string;
      checkIn: string;
      checkOut: string;
    }>;
  } | null;
  episode: { id: string; outcome: string | null; closed: boolean } | null;
  myFeedback: "correct" | "should_be_higher" | "should_be_lower" | null;
  isFirstOutbound: boolean;
  privacyNotice: string;
}

export type MediaStatus = "pending" | "ready" | "failed" | "too_large";

/** Arquivo de foto, áudio, vídeo, documento ou figurinha guardado pelo backend. */
export interface TimelineMedia {
  status: MediaStatus;
  /** Caminho relativo à API, ex.: /api/whatsapp/messages/<id>/media */
  url: string;
  mimetype: string | null;
  fileName: string | null;
  fileLength: number | null;
  seconds: number | null;
  width: number | null;
  height: number | null;
  ptt: boolean;
  /** Miniatura borrada já pronta para `src`: data:image/jpeg;base64,... */
  thumbnail: string | null;
}

export interface TimelineMessage {
  kind: "message";
  id: string;
  direction: MessageDirection;
  origin: string;
  body: string;
  mediaType: string;
  status: string;
  failureReason: string | null;
  sentAt: string;
  sentBy: string | null;
  media: TimelineMedia | null;
}

export interface TimelineDay {
  kind: "day";
  date: string;
}

export interface AiMarker {
  kind: "ai_marker";
  readingId: string;
  text: string;
  at: string;
}

export type TimelineItem = TimelineDay | TimelineMessage | AiMarker;

export interface SuggestionPart {
  text: string;
  gap: boolean;
}

export interface Suggestion {
  id: string;
  parts: SuggestionPart[];
  text: string;
  basis: string[];
  replyToMessageId: string;
}

export type MessageOrigin =
  | "portal_manual"
  | "portal_suggestion"
  | "portal_suggestion_edited";

export interface WhatsappConfiguration {
  connection: {
    enabled: boolean;
    instance: string;
    state: "open" | "connecting" | "close" | "unknown";
    stateChangedAt: string | null;
    apiConfigured: boolean;
    webhookConfigured: boolean;
  };
  agent: {
    enabled: boolean;
    available: boolean;
    reason: "disabled" | "not_configured" | "daily_limit" | null;
    dailyCalls: number;
    dailyLimit: number;
    mode: "assistido";
  };
  data: { retentionMonths: number };
  metrics: {
    conversations: number;
    waiting: number;
    inboundToday: number;
    outboundToday: number;
    failedToday: number;
  };
}

export interface WhatsappQrResponse {
  state: "open" | "connecting" | "close" | "unknown";
  qrCode: string | null;
  expiresInSeconds: number;
  operationId: string;
}

export interface WhatsappHistorySyncResult {
  messagesRead: number;
  messagesImported: number;
  conversations: number;
  conversationsCreated: number;
  waiting: number;
  ignored: number;
  failedConversations: number;
}
