export type WhatsappMediaType =
  | "text"
  | "image"
  | "audio"
  | "video"
  | "document"
  | "sticker"
  | "location"
  | "contact"
  | "other";

export interface WhatsappMediaMeta {
  mimetype?: string;
  fileName?: string;
  fileLength?: number;
  seconds?: number;
  width?: number;
  height?: number;
  ptt?: boolean;
  /** JPEG em base64 (sem prefixo data:), só quando cabe em MAX_THUMBNAIL_BASE64_CHARS. */
  thumbnail?: string;
}

export const FETCHABLE_MEDIA_TYPES = ["image", "audio", "video", "document", "sticker"] as const;
export type FetchableMediaType = typeof FETCHABLE_MEDIA_TYPES[number];
export const MAX_THUMBNAIL_BASE64_CHARS = 12_000;

export function isFetchableMediaType(value: unknown): value is FetchableMediaType {
  return typeof value === "string" && (FETCHABLE_MEDIA_TYPES as readonly string[]).includes(value);
}

export type DeliveryStatus = "sent" | "delivered" | "read" | "failed";
export type IgnoredReason =
  | "invalid_payload"
  | "unknown_instance"
  | "ignored_event"
  | "group"
  | "broadcast"
  | "newsletter"
  | "reaction"
  | "protocol"
  | "unsupported_message";

export type ParsedEvolutionEvent =
  | {
      kind: "message";
      instanceName: string;
      providerMessageId: string;
      remoteJid: string;
      fromMe: boolean;
      pushName: string;
      sentAt: Date;
      mediaType: WhatsappMediaType;
      mediaMeta: WhatsappMediaMeta | null;
      body: string;
      status: "received" | "sent";
    }
  | {
      kind: "status";
      instanceName: string;
      providerMessageId: string;
      remoteJid: string | null;
      fromMe: boolean | null;
      status: DeliveryStatus;
    }
  | {
      kind: "connection";
      instanceName: string;
      state: "open" | "connecting" | "close" | "unknown";
    }
  | {
      kind: "ignored";
      instanceName: string;
      reason: IgnoredReason;
    };

type JsonObject = Record<string, unknown>;

function object(value: unknown): JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as JsonObject
    : {};
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function eventName(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function instanceName(payload: JsonObject): string {
  return text(payload.instance) ?? "";
}

function ignored(payload: JsonObject, reason: IgnoredReason): ParsedEvolutionEvent {
  return { kind: "ignored", instanceName: instanceName(payload), reason };
}

function remoteJid(data: JsonObject): string | null {
  const key = object(data.key);
  const jid = text(key.remoteJid) ?? text(data.remoteJid);
  // Com @lid, a Evolution manda o telefone em remoteJidAlt (ou senderPn) quando o conhece.
  if (jid?.endsWith("@lid")) {
    const alt = text(key.remoteJidAlt) ?? text(key.senderPn) ?? text(data.senderPn);
    if (alt?.endsWith("@s.whatsapp.net")) return alt;
  }
  return jid;
}

function providerMessageId(data: JsonObject): string | null {
  const key = object(data.key);
  return text(key.id) ?? text(data.messageId) ?? text(data.keyId);
}

function fromMe(data: JsonObject): boolean {
  const key = object(data.key);
  return key.fromMe === true || data.fromMe === true;
}

function sentAt(data: JsonObject): Date | null {
  const raw = data.messageTimestamp;
  const seconds = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : NaN;
  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  const value = new Date(seconds * 1000);
  return Number.isNaN(value.getTime()) ? null : value;
}

function unwrapMessage(value: unknown): JsonObject {
  let current = object(value);
  for (let i = 0; i < 3; i += 1) {
    const nested = ["ephemeralMessage", "viewOnceMessage", "documentWithCaptionMessage"]
      .map((key) => object(current[key]).message)
      .find(Boolean);
    if (!nested) return current;
    current = object(nested);
  }
  return current;
}

function finiteNumber(value: unknown): number | undefined {
  const parsed = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : NaN;
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

/** Baileys serializa inteiros de 64 bits (Long) como número, string ou { low, high }. */
function longValue(value: unknown): number | undefined {
  const direct = finiteNumber(value);
  if (direct !== undefined) return Math.floor(direct);
  const long = object(value);
  if (typeof long.low !== "number" || typeof long.high !== "number") return undefined;
  const combined = (long.high >>> 0) * 2 ** 32 + (long.low >>> 0);
  return Number.isSafeInteger(combined) ? combined : undefined;
}

/** Bytes chegam como string base64, array, { type: "Buffer", data } ou objeto { "0": 255, ... }. */
function base64Bytes(value: unknown): string | undefined {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed && /^[A-Za-z0-9+/]+={0,2}$/.test(trimmed) ? trimmed : undefined;
  }
  let bytes: unknown[] | null = null;
  if (Array.isArray(value)) bytes = value;
  else {
    const record = object(value);
    if (record.type === "Buffer" && Array.isArray(record.data)) bytes = record.data;
    else {
      const keys = Object.keys(record);
      if (keys.length > 0 && keys.every((key, index) => key === String(index))) bytes = keys.map((key) => record[key]);
    }
  }
  if (!bytes || bytes.length === 0) return undefined;
  // Evita montar um buffer inteiro para miniaturas que serão descartadas pelo limite.
  if (Math.ceil(bytes.length / 3) * 4 > MAX_THUMBNAIL_BASE64_CHARS) return undefined;
  if (!bytes.every((byte) => Number.isInteger(byte) && (byte as number) >= 0 && (byte as number) <= 255)) return undefined;
  return Buffer.from(bytes as number[]).toString("base64");
}

function cleanString(value: unknown, max: number): string | undefined {
  if (typeof value !== "string") return undefined;
  // Remove controles (Cc) e formatação invisível (Cf: bidi U+202E/U+2066..., zero-width),
  // que permitiriam disfarçar a extensão de um arquivo ("reserva\u202Efdp.exe").
  const cleaned = value.replace(/[\p{Cc}\p{Cf}]/gu, "").trim().slice(0, max);
  return cleaned || undefined;
}

/** Lê do nó de mídia do WhatsApp (imageMessage, audioMessage...) só o que a tela precisa. */
export function extractMediaMeta(node: unknown): WhatsappMediaMeta {
  const media = object(node);
  const meta: WhatsappMediaMeta = {};
  const mimetype = cleanString(media.mimetype, 120);
  if (mimetype) meta.mimetype = mimetype;
  const fileName = cleanString(media.fileName, 255) ?? cleanString(media.title, 255);
  if (fileName) meta.fileName = fileName;
  const fileLength = longValue(media.fileLength);
  if (fileLength !== undefined) meta.fileLength = fileLength;
  const seconds = finiteNumber(media.seconds);
  if (seconds !== undefined) meta.seconds = Math.round(seconds);
  const width = finiteNumber(media.width);
  if (width) meta.width = Math.round(width);
  const height = finiteNumber(media.height);
  if (height) meta.height = Math.round(height);
  if (typeof media.ptt === "boolean") meta.ptt = media.ptt;
  const thumbnail = base64Bytes(media.jpegThumbnail);
  if (thumbnail && thumbnail.length <= MAX_THUMBNAIL_BASE64_CHARS) meta.thumbnail = thumbnail;
  return meta;
}

function parseMessage(data: JsonObject, payload: JsonObject): ParsedEvolutionEvent {
  const jid = remoteJid(data);
  const id = providerMessageId(data);
  const at = sentAt(data);
  if (!jid || !id || !at) return ignored(payload, "unsupported_message");

  if (jid.endsWith("@g.us")) return ignored(payload, "group");
  if (jid === "status@broadcast") return ignored(payload, "broadcast");
  if (jid.endsWith("@newsletter")) return ignored(payload, "newsletter");

  const message = unwrapMessage(data.message);
  if (message.reactionMessage) return ignored(payload, "reaction");
  if (message.protocolMessage || message.senderKeyDistributionMessage) return ignored(payload, "protocol");

  const candidates: Array<[WhatsappMediaType, string | null]> = [
    ["text", text(message.conversation) ?? text(object(message.extendedTextMessage).text)],
    ["image", text(object(message.imageMessage).caption)],
    ["video", text(object(message.videoMessage).caption)],
    ["document", text(object(message.documentMessage).caption)],
    ["audio", null],
    ["sticker", null],
    ["location", null],
    ["contact", null]
  ];
  const match = candidates.find(([type]) =>
    type === "text" ? message.conversation || object(message.extendedTextMessage).text : message[`${type}Message`]
  );
  const [mediaType, body] = match ?? (["other", null] as const);
  const hasKnownMedia = mediaType !== "other";
  if (!hasKnownMedia) return ignored(payload, "unsupported_message");

  const inbound = !fromMe(data);
  const mediaMeta = isFetchableMediaType(mediaType) ? extractMediaMeta(message[`${mediaType}Message`]) : null;
  return {
    kind: "message",
    instanceName: instanceName(payload),
    providerMessageId: id,
    remoteJid: jid,
    fromMe: !inbound,
    pushName: text(data.pushName) ?? "",
    sentAt: at,
    mediaType,
    mediaMeta,
    body: body ?? "",
    status: inbound ? "received" : "sent"
  };
}

function parseStatus(data: JsonObject, payload: JsonObject): ParsedEvolutionEvent {
  const id = providerMessageId(data);
  if (!id) return ignored(payload, "unsupported_message");

  const raw = text(data.status)?.toUpperCase();
  const status: DeliveryStatus | null =
    raw === "READ" || raw === "PLAYED" ? "read" :
    raw === "DELIVERY_ACK" || raw === "DELIVERED" ? "delivered" :
    raw === "ERROR" || raw === "FAILED" ? "failed" :
    raw === "SERVER_ACK" || raw === "SENT" || raw === "PENDING" ? "sent" : null;
  if (!status) return ignored(payload, "unsupported_message");

  return {
    kind: "status",
    instanceName: instanceName(payload),
    providerMessageId: id,
    remoteJid: remoteJid(data),
    fromMe: typeof data.fromMe === "boolean" ? data.fromMe : null,
    status
  };
}

export function parseEvolutionEvent(payload: unknown, expectedInstance?: string): ParsedEvolutionEvent {
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
    return { kind: "ignored", instanceName: "", reason: "invalid_payload" };
  }

  const body = payload as JsonObject;
  const instance = instanceName(body);
  if (expectedInstance && instance !== expectedInstance) return ignored(body, "unknown_instance");

  switch (eventName(body.event)) {
    case "messages.upsert":
      return parseMessage(object(body.data), body);
    case "messages.update":
      return parseStatus(object(body.data), body);
    case "connection.update": {
      const raw = text(object(body.data).state) ?? text(body.state);
      const state = raw === "open" || raw === "connecting" || raw === "close" ? raw : "unknown";
      return { kind: "connection", instanceName: instance, state };
    }
    default:
      return ignored(body, "ignored_event");
  }
}
