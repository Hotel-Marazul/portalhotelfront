// Regras puras da mídia do WhatsApp (tipos servidos, nomes de arquivo, intervalos,
// novas tentativas e download pela Evolution). Nada aqui toca o banco.
import { EvolutionError } from "./evolution-client.js";
import type { FetchableMediaType } from "./evolution-parser.js";

export const MEDIA_MAX_ATTEMPTS = 5;
const RETRY_DELAYS_MS = [30_000, 2 * 60_000, 10 * 60_000, 30 * 60_000];

/** Espera antes da próxima tentativa, dado o total de falhas; null quando deve desistir. */
export function mediaRetryDelayMs(failedAttempts: number): number | null {
  if (failedAttempts >= MEDIA_MAX_ATTEMPTS) return null;
  return RETRY_DELAYS_MS[Math.max(0, failedAttempts - 1)] ?? RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1];
}

const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "audio/ogg": "ogg",
  "audio/mpeg": "mp3",
  "audio/mp4": "m4a",
  "audio/aac": "aac",
  "audio/webm": "webm",
  "audio/amr": "amr",
  "video/mp4": "mp4",
  "video/3gpp": "3gp",
  "application/pdf": "pdf",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.ms-excel": "xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/vnd.ms-powerpoint": "ppt",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
  "application/vnd.oasis.opendocument.text": "odt",
  "application/vnd.oasis.opendocument.spreadsheet": "ods",
  "application/vnd.oasis.opendocument.presentation": "odp",
  "text/plain": "txt",
  "text/csv": "csv"
};

const ALLOWED_TYPES = new Set(Object.keys(EXTENSIONS));
const OCTET_STREAM = "application/octet-stream";
const SAFE_PARAM = /^([a-z0-9_.-]+)=([a-z0-9_.+-]+)$/i;

function baseType(mimetype: string | null | undefined): string {
  return (mimetype ?? "").split(";", 1)[0].trim().toLowerCase();
}

/**
 * Tipo enviado ao navegador. Fora da lista permitida vira application/octet-stream,
 * para que nada (HTML, SVG, script) seja interpretado na origem do backend.
 */
export function servedContentType(mimetype: string | null | undefined): string {
  const base = baseType(mimetype);
  if (!ALLOWED_TYPES.has(base)) return OCTET_STREAM;
  const params = (mimetype ?? "").split(";").slice(1).map((param) => param.trim()).filter(Boolean);
  if (params.length === 0 || !params.every((param) => SAFE_PARAM.test(param))) return base;
  return [base, ...params].join("; ");
}

function isInlineType(contentType: string): boolean {
  const base = baseType(contentType);
  return base === "application/pdf" || /^(image|audio|video)\//.test(base);
}

function sanitizeFileName(value: string): string {
  const cleaned = value
    // Controles e formatação invisível (bidi, zero-width) disfarçam extensões.
    .replace(/[\p{Cc}\p{Cf}]/gu, "")
    .replace(/[\\/"]/g, "_")
    .replace(/^[\s._]+/, "")
    .trim();
  if (cleaned.length <= 150) return cleaned;
  const dot = cleaned.lastIndexOf(".");
  const extension = dot > 0 && cleaned.length - dot <= 10 ? cleaned.slice(dot) : "";
  return `${cleaned.slice(0, 150 - extension.length)}${extension}`;
}

function rfc5987(value: string): string {
  return encodeURIComponent(value).replace(/['()*!]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
}

/** Content-Disposition com nome saneado (fallback ASCII + filename* RFC 5987). */
export function contentDispositionFor(
  contentType: string,
  fileName: string | null | undefined,
  messageId: string,
  forceDownload: boolean
): string {
  const type = forceDownload || !isInlineType(contentType) ? "attachment" : "inline";
  let name = fileName ? sanitizeFileName(fileName) : "";
  if (!name) {
    if (type === "inline") return "inline";
    name = `whatsapp-${messageId.replace(/[^a-z0-9]/gi, "").slice(0, 8)}.${EXTENSIONS[baseType(contentType)] ?? "bin"}`;
  }
  const ascii = name.replace(/[^\x20-\x7e]/g, "_");
  return `${type}; filename="${ascii}"; filename*=UTF-8''${rfc5987(name)}`;
}

const STRICT_MEDIA_CSP = "default-src 'none'; sandbox";
// O visualizador de PDF do navegador (plugin/MIME handler) não roda em documento com
// `sandbox` nem com object-src 'none'. Para PDF aberto inline libera só isso; nosniff e
// o tipo da lista permitida continuam impedindo que o arquivo vire HTML/script.
const INLINE_PDF_CSP = "default-src 'none'; object-src 'self'";

/** CSP da resposta de mídia: estrita para tudo, exceto PDF exibido inline. */
export function mediaContentSecurityPolicy(contentType: string, contentDisposition: string): string {
  return baseType(contentType) === "application/pdf" && /^inline\b/.test(contentDisposition)
    ? INLINE_PDF_CSP
    : STRICT_MEDIA_CSP;
}

export type ByteRange = { start: number; end: number };

/**
 * Interpreta um único intervalo `bytes=`. Cabeçalho inválido ou com vários intervalos
 * devolve null (o servidor responde 200 com tudo, como a RFC 9110 permite).
 */
export function parseByteRange(header: string | undefined, size: number): ByteRange | "unsatisfiable" | null {
  if (!header) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match) return null;
  const [, rawStart, rawEnd] = match;
  if (!rawStart && !rawEnd) return null;
  if (!rawStart) {
    const suffix = Number(rawEnd);
    if (suffix === 0 || size === 0) return "unsatisfiable";
    return { start: Math.max(0, size - suffix), end: size - 1 };
  }
  const start = Number(rawStart);
  const end = rawEnd ? Number(rawEnd) : size - 1;
  if (rawEnd && end < start) return null;
  if (start >= size) return "unsatisfiable";
  return { start, end: Math.min(end, size - 1) };
}

export function formatDurationSeconds(totalSeconds: number): string {
  const total = Math.max(0, Math.round(totalSeconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = String(total % 60).padStart(2, "0");
  return hours > 0 ? `${hours}:${String(minutes).padStart(2, "0")}:${seconds}` : `${minutes}:${seconds}`;
}

export function formatAudioPreview(seconds: number | null | undefined): string {
  return typeof seconds === "number" && Number.isFinite(seconds) && seconds > 0
    ? `Áudio (${formatDurationSeconds(seconds)})`
    : "Áudio";
}

export interface MediaFetchClient {
  getMediaBase64(
    providerMessageId: string,
    options: { convertToMp4: boolean; timeoutMs?: number; maxBytes?: number }
  ): Promise<{ mimetype: string | null; base64: string }>;
}

export type MediaDownload =
  | { status: "ready"; mimetype: string | null; data: Buffer }
  | { status: "too_large" };

/**
 * Baixa a mídia pela Evolution. Áudio pede conversão para MP4 (toca em todos os
 * navegadores); se a conversão falhar, tenta de novo com o arquivo original.
 * Erros de rede/tempo sobem para quem chamou decidir a nova tentativa.
 */
export async function downloadMedia(
  client: MediaFetchClient,
  input: { providerMessageId: string; mediaType: FetchableMediaType; maxBytes: number; deadlineMs?: number }
): Promise<MediaDownload> {
  const started = Date.now();
  const remaining = () => input.deadlineMs === undefined
    ? undefined
    : Math.max(1_000, input.deadlineMs - (Date.now() - started));
  const fetchOnce = (convertToMp4: boolean) => client.getMediaBase64(input.providerMessageId, {
    convertToMp4,
    timeoutMs: remaining(),
    maxBytes: input.maxBytes
  });

  let result: { mimetype: string | null; base64: string };
  try {
    try {
      result = await fetchOnce(input.mediaType === "audio");
    } catch (error) {
      const conversionFailed = input.mediaType === "audio" && error instanceof EvolutionError &&
        ["evolution_4xx", "evolution_5xx", "invalid_response"].includes(error.reason);
      if (!conversionFailed) throw error;
      result = await fetchOnce(false);
    }
  } catch (error) {
    if (error instanceof EvolutionError && error.reason === "too_large") return { status: "too_large" };
    throw error;
  }

  const data = Buffer.from(result.base64, "base64");
  if (data.length === 0) throw new EvolutionError("invalid_response");
  if (data.length > input.maxBytes) return { status: "too_large" };
  return { status: "ready", mimetype: result.mimetype, data };
}
