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
  return text(key.remoteJid) ?? text(data.remoteJid);
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
  return {
    kind: "message",
    instanceName: instanceName(payload),
    providerMessageId: id,
    remoteJid: jid,
    fromMe: !inbound,
    pushName: text(data.pushName) ?? "",
    sentAt: at,
    mediaType,
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
