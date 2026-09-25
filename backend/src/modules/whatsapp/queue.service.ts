import { query } from "../../db/client.js";
import { env } from "../../config/env.js";
import type { QueueLevel, ScoreReason } from "./scoring.js";

export type QueueGroup = "lead" | "reserva" | "outros";
export type QueueFilter = "todas" | "lead" | "reserva" | "outros";

interface QueueRow {
  conversation_id: string;
  contact_id: string;
  phone_e164: string;
  push_name: string;
  kind: "guest" | "supplier";
  client_id: string | null;
  client_name: string | null;
  awaiting_since: string | null;
  last_message_at: string | null;
  unread_count: number;
  base_score: number | null;
  score_reasons: ScoreReason[];
  headline: string | null;
  intent: string | null;
  last_direction: "inbound" | "outbound" | null;
  last_body: string | null;
  last_media_type: string | null;
  has_active_reservation: boolean;
}

export interface QueueItemDto {
  conversationId: string;
  contactId: string;
  displayName: string;
  initials: string;
  isKnownClient: boolean;
  level: QueueLevel | null;
  score: number | null;
  headline: string;
  preview: string;
  lastMessageAt: string;
  awaitingSince: string | null;
  unreadCount: number;
  group: QueueGroup;
}

const MEDIA_LABELS: Record<string, string> = {
  image: "Imagem",
  audio: "Áudio",
  video: "Vídeo",
  document: "Documento",
  sticker: "Figurinha",
  location: "Localização",
  contact: "Contato"
};

function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 13 && digits.startsWith("55")) {
    return `+55 (${digits.slice(2, 4)}) ${digits[4]}${digits.slice(5, 9)}-${digits.slice(9)}`;
  }
  if (digits.length === 12 && digits.startsWith("55")) {
    return `+55 (${digits.slice(2, 4)}) ${digits.slice(4, 8)}-${digits.slice(8)}`;
  }
  return phone;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts.at(-1)?.[0] ?? ""}`.toUpperCase();
}

function groupFor(row: QueueRow): QueueGroup {
  if (row.intent === "reserva_nova" || row.intent === "preco") return "lead";
  if (row.has_active_reservation) return "reserva";
  return "outros";
}

function scoreFor(row: QueueRow, now: Date): { score: number; level: QueueLevel; reasons: ScoreReason[] } {
  const base = Math.min(100, Math.max(0, row.base_score ?? 20));
  const since = row.awaiting_since ? new Date(row.awaiting_since).getTime() : now.getTime();
  const minutes = Number.isNaN(since) ? 0 : Math.max(0, Math.floor((now.getTime() - since) / 60_000));
  let score = Math.min(100, base + Math.min(30, minutes));
  if (row.kind === "supplier") score = Math.min(score, 39);

  const reasons = Array.isArray(row.score_reasons) ? [...row.score_reasons] : [];
  if (row.kind === "supplier" && !reasons.some((reason) => reason.text === "Número marcado como fornecedor")) {
    reasons.push({ text: "Número marcado como fornecedor", weight: 0 });
  }
  if (minutes > 0) {
    reasons.push({
      text: `Esperando resposta há ${minutes >= 60 ? `${Math.floor(minutes / 60)} h` : `${minutes} min`}`,
      weight: minutes
    });
  }
  reasons.sort((left, right) => Math.abs(right.weight) - Math.abs(left.weight));
  const level: QueueLevel = score >= 70 ? "agora" : score >= 40 ? "hoje" : "espera";
  return { score, level, reasons: reasons.slice(0, 4) };
}

function toItem(row: QueueRow, now: Date, answered: boolean): QueueItemDto {
  const displayName = row.client_name?.trim() || row.push_name.trim() || formatPhone(row.phone_e164);
  const dynamic = answered ? null : scoreFor(row, now);
  const body = row.last_body?.trim();
  const content = body || MEDIA_LABELS[row.last_media_type ?? ""] || "Mensagem";
  return {
    conversationId: row.conversation_id,
    contactId: row.contact_id,
    displayName,
    initials: initials(displayName),
    isKnownClient: Boolean(row.client_id),
    level: dynamic?.level ?? null,
    score: dynamic?.score ?? null,
    headline: row.headline?.trim() || "Sem leitura da IA",
    preview: row.last_direction === "outbound" ? `Você: ${content}` : content,
    lastMessageAt: row.last_message_at ?? "",
    awaitingSince: row.awaiting_since,
    unreadCount: row.unread_count,
    group: groupFor(row)
  };
}

const queueSelect = `
  SELECT
    c.id AS conversation_id,
    contact.id AS contact_id,
    contact.phone_e164,
    contact.push_name,
    contact.kind,
    contact.client_id,
    client.full_name AS client_name,
    c.awaiting_since::text AS awaiting_since,
    c.last_message_at::text AS last_message_at,
    c.unread_count,
    c.base_score,
    c.score_reasons,
    reading.headline,
    reading.intent,
    last_message.direction AS last_direction,
    last_message.body AS last_body,
    last_message.media_type AS last_media_type,
    EXISTS (
      SELECT 1 FROM reservations active_reservation
      WHERE active_reservation.client_id = contact.client_id
        AND active_reservation.status IN ('Pendente', 'Confirmada', 'EmAndamento')
        AND active_reservation.check_out_date >= CURRENT_DATE
    ) AS has_active_reservation
  FROM whatsapp_conversations c
  JOIN whatsapp_contacts contact ON contact.id = c.contact_id
  LEFT JOIN clients client ON client.id = contact.client_id
  LEFT JOIN whatsapp_ai_readings reading ON reading.id = c.current_reading_id
  LEFT JOIN LATERAL (
    SELECT direction, body, media_type
    FROM whatsapp_messages
    WHERE conversation_id = c.id
    ORDER BY sent_at DESC, id DESC
    LIMIT 1
  ) last_message ON TRUE
`;

async function loadRows(where = "", params: unknown[] = []): Promise<QueueRow[]> {
  return query<QueueRow>(`${queueSelect} ${where}`, params);
}

function sortWaiting(items: QueueItemDto[]): QueueItemDto[] {
  return items.sort((left, right) => {
    const score = (right.score ?? -1) - (left.score ?? -1);
    if (score) return score;
    const awaiting = (left.awaitingSince ? Date.parse(left.awaitingSince) : Number.MAX_SAFE_INTEGER) -
      (right.awaitingSince ? Date.parse(right.awaitingSince) : Number.MAX_SAFE_INTEGER);
    return awaiting || left.conversationId.localeCompare(right.conversationId);
  });
}

function filterItems(items: QueueItemDto[], filter: QueueFilter): QueueItemDto[] {
  return filter === "todas" ? items : items.filter((item) => item.group === filter);
}

export async function getQueue(filter: QueueFilter = "todas") {
  const rows = await loadRows(
    `WHERE c.awaiting_since IS NOT NULL
       OR (c.awaiting_since IS NULL
           AND last_message.direction = 'outbound'
           AND c.last_message_at >= NOW() - INTERVAL '48 hours')`
  );
  const now = new Date();
  const waiting = sortWaiting(rows.filter((row) => row.awaiting_since !== null).map((row) => toItem(row, now, false)));
  const answered = rows
    .filter((row) => row.awaiting_since === null)
    .sort((left, right) => Date.parse(right.last_message_at ?? "") - Date.parse(left.last_message_at ?? ""))
    .slice(0, 30)
    .map((row) => toItem(row, now, true));
  const counts = { todas: waiting.length, lead: 0, reserva: 0, outros: 0 };
  for (const item of waiting) counts[item.group] += 1;
  return { waiting: filterItems(waiting, filter).slice(0, 100), answered: filterItems(answered, filter), counts };
}

export async function searchConversations(search: string): Promise<{ items: QueueItemDto[] }> {
  const value = search.trim();
  const digitsOnly = /^\d+$/.test(value);
  const rows = await loadRows(
    `WHERE ${digitsOnly
      ? "regexp_replace(contact.phone_e164, '\\D', '', 'g') LIKE '%' || $1 || '%'"
      : "(COALESCE(client.full_name, '') ILIKE '%' || $1 || '%' OR contact.push_name ILIKE '%' || $1 || '%')"}
     ORDER BY c.last_message_at DESC NULLS LAST, c.id
     LIMIT 30`,
    [value]
  );
  const now = new Date();
  return { items: rows.map((row) => toItem(row, now, row.awaiting_since === null)) };
}

export async function getQueueCount(): Promise<number> {
  const rows = await query<{ count: number }>(
    "SELECT COUNT(*)::int AS count FROM whatsapp_conversations WHERE awaiting_since IS NOT NULL"
  );
  return rows[0]?.count ?? 0;
}

interface DetailRow {
  id: string;
  contact_id: string;
  phone_e164: string;
  push_name: string;
  kind: "guest" | "supplier";
  client_id: string | null;
  client_name: string | null;
  awaiting_since: string | null;
  base_score: number | null;
  score_reasons: ScoreReason[];
  reading_id: string | null;
  intent: string | null;
  model: string | null;
  check_in: string | null;
  check_out: string | null;
  adults: number | null;
  children_ages: number[] | null;
  requests: string[] | null;
  missing_fields: string[] | null;
  headline: string | null;
  marker_text: string | null;
  facts: Record<string, unknown> | null;
  reading_reasons: ScoreReason[] | null;
  episode_id: string | null;
  outcome: string | null;
  closed_at: string | null;
}

function maskedCpf(cpf: string): string {
  return `***.***.***-${cpf.replace(/\D/g, "").slice(-2)}`;
}

function nightsBetween(checkIn: string | null, checkOut: string | null): number | null {
  if (!checkIn || !checkOut) return null;
  const nights = (Date.parse(`${checkOut}T00:00:00Z`) - Date.parse(`${checkIn}T00:00:00Z`)) / 86_400_000;
  return Number.isInteger(nights) && nights > 0 ? nights : null;
}

function dayInHotel(value: string, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(value));
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export async function getConversationDetail(conversationId: string, userId: string) {
  const rows = await query<DetailRow>(
    `SELECT
       c.id,
       contact.id AS contact_id,
       contact.phone_e164,
       contact.push_name,
       contact.kind,
       contact.client_id,
       client.full_name AS client_name,
       c.awaiting_since::text AS awaiting_since,
       c.base_score,
       c.score_reasons,
       reading.id AS reading_id,
       reading.intent,
       reading.model,
       reading.check_in::text AS check_in,
       reading.check_out::text AS check_out,
       reading.adults,
       reading.children_ages,
       reading.requests,
       reading.missing_fields,
       reading.headline,
       reading.marker_text,
       reading.facts,
       reading.reasons AS reading_reasons,
       episode.id AS episode_id,
       episode.outcome,
       episode.closed_at::text AS closed_at
     FROM whatsapp_conversations c
     JOIN whatsapp_contacts contact ON contact.id = c.contact_id
     LEFT JOIN clients client ON client.id = contact.client_id
     LEFT JOIN whatsapp_ai_readings reading ON reading.id = c.current_reading_id
     LEFT JOIN whatsapp_episodes episode ON episode.id = c.current_episode_id
     WHERE c.id = $1
     LIMIT 1`,
    [conversationId]
  );
  const row = rows[0];
  if (!row) return null;

  const queue = await getQueue("todas");
  const queueItem = queue.waiting.find((item) => item.conversationId === conversationId);
  const dynamic = queueItem ? scoreFor({
    conversation_id: row.id,
    contact_id: row.contact_id,
    phone_e164: row.phone_e164,
    push_name: row.push_name,
    kind: row.kind,
    client_id: row.client_id,
    client_name: row.client_name,
    awaiting_since: row.awaiting_since,
    last_message_at: null,
    unread_count: 0,
    base_score: row.base_score,
    score_reasons: row.score_reasons,
    headline: row.headline,
    intent: row.intent,
    last_direction: null,
    last_body: null,
    last_media_type: null,
    has_active_reservation: false
  }, new Date()) : null;
  const facts = row.facts ?? {};
  const clientRows = row.client_id
    ? await query<{ full_name: string; cpf: string; fone: string; created_at: string; stays: number }>(
      `SELECT full_name, cpf, fone, created_at::text,
              (SELECT COUNT(*)::int FROM reservations r WHERE r.client_id = $1 AND r.status = 'Concluída') AS stays
       FROM clients WHERE id = $1`,
      [row.client_id]
    )
    : [];
  const reservations = row.client_id
    ? await query<{
        id: string; status: string; room_number: number | null; category_name: string | null;
        check_in: string; check_out: string;
      }>(
        `SELECT r.id, r.status, rm.number AS room_number, cat.name AS category_name,
                r.check_in_date::text AS check_in, r.check_out_date::text AS check_out
         FROM reservations r
         LEFT JOIN rooms rm ON rm.id = r.room_id
         LEFT JOIN categories cat ON cat.id = rm.category_id
         WHERE r.client_id = $1 AND r.status IN ('Pendente', 'Confirmada', 'EmAndamento')
         ORDER BY r.check_in_date ASC, r.created_at DESC
         LIMIT 3`,
        [row.client_id]
      )
    : [];
  const feedback = row.reading_id
    ? await query<{ verdict: "correct" | "should_be_higher" | "should_be_lower" }>(
      `SELECT verdict FROM whatsapp_priority_feedback WHERE reading_id = $1 AND user_id = $2 LIMIT 1`,
      [row.reading_id, userId]
    )
    : [];
  const outbound = await query<{ exists: boolean }>(
    "SELECT EXISTS (SELECT 1 FROM whatsapp_messages WHERE conversation_id = $1 AND direction = 'outbound') AS exists",
    [conversationId]
  );

  const reasons = dynamic?.reasons ?? (row.reading_reasons ?? row.score_reasons ?? []).slice(0, 4);
  const factsAvailability = Array.isArray(facts.availability) ? facts.availability : [];
  const factsPrices = Array.isArray(facts.prices) ? facts.prices : [];
  const guest = clientRows[0];
  return {
    id: row.id,
    contact: {
      id: row.contact_id,
      displayName: row.client_name?.trim() || row.push_name.trim() || formatPhone(row.phone_e164),
      phone: formatPhone(row.phone_e164),
      pushName: row.push_name,
      kind: row.kind,
      clientId: row.client_id
    },
    level: queueItem?.level ?? null,
    score: queueItem?.score ?? null,
    position: queueItem ? queue.waiting.findIndex((item) => item.conversationId === conversationId) + 1 : null,
    reasons,
    reading: row.reading_id && row.intent && row.model
      ? {
          id: row.reading_id,
          intent: row.intent,
          model: row.model,
          checkIn: row.check_in,
          checkOut: row.check_out,
          nights: nightsBetween(row.check_in, row.check_out),
          adults: row.adults,
          childrenAges: row.children_ages ?? [],
          requests: row.requests ?? [],
          missingFields: row.missing_fields ?? [],
          availability: factsAvailability,
          prices: factsPrices,
          canCreateReservation: Boolean(row.client_id && row.check_in && row.check_out && row.adults)
        }
      : null,
    guest: guest && row.client_id
      ? {
          clientId: row.client_id,
          fullName: guest.full_name,
          maskedCpf: maskedCpf(guest.cpf),
          phone: formatPhone(guest.fone),
          clientSince: guest.created_at,
          stays: guest.stays,
          reservations: reservations.map((reservation) => ({
            id: reservation.id,
            code: reservation.id.slice(0, 8).toUpperCase(),
            status: reservation.status,
            room: reservation.room_number === null ? "" : String(reservation.room_number),
            category: reservation.category_name ?? "",
            checkIn: reservation.check_in,
            checkOut: reservation.check_out
          }))
        }
      : null,
    episode: row.episode_id
      ? { id: row.episode_id, outcome: row.outcome, closed: Boolean(row.closed_at) }
      : null,
    myFeedback: feedback[0]?.verdict ?? null,
    isFirstOutbound: !outbound[0]?.exists,
    privacyNotice: env.WHATSAPP_PRIVACY_NOTICE
  };
}

interface MessageRow {
  id: string;
  direction: "inbound" | "outbound";
  origin: string;
  body: string;
  media_type: string;
  status: string;
  failure_reason: string | null;
  sent_at: string;
  sent_by: string | null;
}

export async function getConversationMessages(
  conversationId: string,
  before: string | undefined,
  after: string | undefined,
  limit: number
) {
  const exists = await query<{ id: string }>("SELECT id FROM whatsapp_conversations WHERE id = $1 LIMIT 1", [conversationId]);
  if (!exists[0]) return null;

  const cursor = before ?? after;
  let cursorClause = "";
  const params: unknown[] = [conversationId];
  if (cursor) {
    const cursorRows = await query<{ sent_at: string; id: string }>(
      "SELECT sent_at::text, id FROM whatsapp_messages WHERE id = $1 AND conversation_id = $2 LIMIT 1",
      [cursor, conversationId]
    );
    if (cursorRows[0]) {
      params.push(cursorRows[0].sent_at, cursorRows[0].id);
      cursorClause = after
        ? "AND (m.sent_at, m.id) > ($2::timestamptz, $3::uuid)"
        : "AND (m.sent_at, m.id) < ($2::timestamptz, $3::uuid)";
    }
  }
  params.push(limit + 1);
  const rows = await query<MessageRow>(
    `SELECT m.id, m.direction, m.origin, m.body, m.media_type, m.status,
            m.failure_reason, m.sent_at::text, u.name AS sent_by
     FROM whatsapp_messages m
     LEFT JOIN users u ON u.id = m.sent_by_user_id
     WHERE m.conversation_id = $1 ${cursorClause}
     ORDER BY m.sent_at ${after ? "ASC" : "DESC"}, m.id ${after ? "ASC" : "DESC"}
     LIMIT $${params.length}`,
    params
  );
  const hasMore = rows.length > limit;
  const chronological = (hasMore ? rows.slice(0, limit) : rows).reverse();
  if (after) chronological.reverse();
  const messageIds = chronological.map((row) => row.id);
  const readings = messageIds.length
    ? await query<{ id: string; last_message_id: string; marker_text: string; created_at: string }>(
      `SELECT id, last_message_id, marker_text, created_at::text
       FROM whatsapp_ai_readings
       WHERE conversation_id = $1 AND model <> 'fallback' AND last_message_id = ANY($2::uuid[])
       ORDER BY created_at ASC`,
      [conversationId, messageIds]
    )
    : [];
  const markers = new Map<string, typeof readings>();
  for (const reading of readings) markers.set(reading.last_message_id, [...(markers.get(reading.last_message_id) ?? []), reading]);
  const items: Array<Record<string, unknown>> = [];
  let day = "";
  for (const message of chronological) {
    const messageDay = dayInHotel(message.sent_at, env.HOTEL_TIMEZONE);
    if (messageDay !== day) {
      day = messageDay;
      items.push({ kind: "day", date: day });
    }
    items.push({
      kind: "message",
      id: message.id,
      direction: message.direction,
      origin: message.origin,
      body: message.body,
      mediaType: message.media_type,
      status: message.status,
      failureReason: message.failure_reason,
      sentAt: message.sent_at,
      sentBy: message.sent_by
    });
    for (const marker of markers.get(message.id) ?? []) {
      items.push({ kind: "ai_marker", readingId: marker.id, text: marker.marker_text, at: marker.created_at });
    }
  }
  return { items, hasMore };
}

export function formatContactPhone(phone: string): string {
  return formatPhone(phone);
}
