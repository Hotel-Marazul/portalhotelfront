import type { Level, MessageOrigin, TimelineItem } from "../types/whatsapp";

export const LEVEL_LABELS: Record<Level, string> = {
  agora: "Agora",
  hoje: "Hoje",
  espera: "Pode esperar",
};

export function levelLabel(level: Level | null): string {
  return level ? LEVEL_LABELS[level] : "Respondida";
}

export function levelClass(level: Level | null): string {
  return level ? `level-${level}` : "";
}

export function formatWaiting(
  since: string | Date | null,
  now: Date = new Date(),
): string {
  if (!since) return "—";
  const date = since instanceof Date ? since : new Date(since);
  if (Number.isNaN(date.getTime())) return "—";
  const minutes = Math.max(0, Math.floor((now.getTime() - date.getTime()) / 60000));
  if (minutes >= 60) return `há ${Math.floor(minutes / 60)} h`;
  return `há ${minutes} min`;
}

const MEDIA_LABELS: Record<string, string> = {
  image: "Imagem",
  audio: "Áudio",
  video: "Vídeo",
  document: "Documento",
  sticker: "Figurinha",
  location: "Localização",
  contact: "Contato",
};

export function messagePreview(message: {
  direction: "inbound" | "outbound";
  body?: string | null;
  mediaType?: string | null;
}): string {
  const body = message.body?.trim();
  const content = body || MEDIA_LABELS[message.mediaType ?? ""] || "Mensagem";
  const clipped = content.length > 96 ? `${content.slice(0, 93)}…` : content;
  return message.direction === "outbound" ? `Você: ${clipped}` : clipped;
}

export function initials(displayName: string): string {
  const parts = displayName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts.at(-1)?.[0] ?? ""}`.toUpperCase();
}

export function extractGaps(text: string): string[] {
  return text.match(/\[[^\]\n]{1,60}\]/g) ?? [];
}

export function hasUnfilledGap(text: string): boolean {
  return extractGaps(text).length > 0;
}

function normalizeForComparison(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export function expectedMessageOrigin(text: string, suggestionText?: string | null): MessageOrigin {
  if (!suggestionText) return "portal_manual";
  return normalizeForComparison(text) === normalizeForComparison(suggestionText)
    ? "portal_suggestion"
    : "portal_suggestion_edited";
}

const DAY_FORMATTER = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "long", year: "numeric" });

function civilDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

/** Rótulo do separador de dia: "Hoje", "Ontem" ou a data por extenso. */
export function dayLabel(date: string, now: Date = new Date()): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
  if (date === civilDate(now)) return "Hoje";
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date === civilDate(yesterday)) return "Ontem";
  const [year, month, day] = date.split("-").map(Number);
  return DAY_FORMATTER.format(new Date(year, month - 1, day));
}

/** Remove separadores de dia repetidos depois de juntar páginas da conversa. */
export function dedupeDays(items: TimelineItem[]): TimelineItem[] {
  let lastDay: string | null = null;
  return items.filter((item) => {
    if (item.kind !== "day") return true;
    if (item.date === lastDay) return false;
    lastDay = item.date;
    return true;
  });
}

/**
 * Junta a página mais recente vinda do polling com o que já estava na tela,
 * preservando as mensagens antigas que a pessoa carregou com "Carregar anteriores".
 */
export function mergeTimeline(current: TimelineItem[], incoming: TimelineItem[]): TimelineItem[] {
  if (!current.length) return dedupeDays(incoming);
  const firstIncoming = incoming.find((item) => item.kind === "message");
  if (!firstIncoming) return dedupeDays(incoming);
  const cut = current.findIndex((item) => item.kind === "message" && item.id === firstIncoming.id);
  if (cut < 1) return dedupeDays(incoming);
  return dedupeDays([...current.slice(0, cut), ...incoming]);
}

const INTENT_LABELS: Record<string, string> = {
  reserva_nova: "Pedido de reserva",
  preco: "Pergunta de preço",
  alteracao_reserva: "Quer alterar a reserva",
  cancelamento: "Quer cancelar a reserva",
  duvida_estadia: "Dúvida sobre a estadia",
  problema_estadia: "Problema durante a estadia",
  agradecimento: "Agradecimento",
  fornecedor: "Fornecedor",
  outro: "Outro assunto",
  desconhecida: "Sem assunto claro",
};

export function intentLabel(intent: string): string {
  return INTENT_LABELS[intent] ?? "Outro assunto";
}

function shortDate(value: string): string {
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

export function readingPeriod(checkIn: string | null, checkOut: string | null, nights: number | null): string {
  if (!checkIn || !checkOut) return "Sem datas";
  const noites = nights && nights > 0 ? ` · ${nights} ${nights === 1 ? "noite" : "noites"}` : "";
  return `${shortDate(checkIn)} a ${shortDate(checkOut)}${noites}`;
}

export function guestSummary(adults: number | null, childrenAges: number[] = []): string {
  if (!adults && childrenAges.length === 0) return "Sem número de pessoas";
  const partes: string[] = [];
  if (adults) partes.push(`${adults} ${adults === 1 ? "adulto" : "adultos"}`);
  if (childrenAges.length) {
    partes.push(`${childrenAges.length} ${childrenAges.length === 1 ? "criança" : "crianças"} (${childrenAges.join(", ")} anos)`);
  }
  return partes.join(" e ");
}

const MISSING_FIELD_LABELS: Record<string, string> = {
  dates: "datas",
  guests: "número de pessoas",
};

export function missingFieldsNotice(missingFields: string[]): string | null {
  const rotulos = missingFields.map((field) => MISSING_FIELD_LABELS[field] ?? field);
  if (!rotulos.length) return null;
  if (rotulos.length === 1) return `Faltam ${rotulos[0]}.`;
  return `Faltam ${rotulos.slice(0, -1).join(", ")} e ${rotulos.at(-1)}.`;
}
