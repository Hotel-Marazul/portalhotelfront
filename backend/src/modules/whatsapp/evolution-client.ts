import { env } from "../../config/env.js";

export class EvolutionError extends Error {
  constructor(
    public readonly reason: "not_configured" | "timeout" | "invalid_response" | "evolution_4xx" | "evolution_5xx" | "evolution_unavailable" | "too_large",
    public readonly statusCode?: number
  ) {
    super(reason);
  }
}

interface EvolutionClientOptions {
  baseUrl: string;
  apiKey: string;
  instance: string;
  /** Onde a Evolution entrega as mensagens; sem isso a instância nunca avisa o backend. */
  webhook?: { url: string; secret: string };
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

// Os eventos que o evolution-parser trata.
const WEBHOOK_EVENTS = ["MESSAGES_UPSERT", "MESSAGES_UPDATE", "CONNECTION_UPDATE"];

interface EvolutionSendResponse {
  key?: { id?: unknown };
}

export interface EvolutionSendResult {
  providerMessageId: string;
}

export interface EvolutionStateResult {
  state: "open" | "connecting" | "close" | "unknown";
}

export interface EvolutionQrResult extends EvolutionStateResult {
  qrCode: string | null;
}

export interface EvolutionMessagesPage {
  records: UnknownRecord[];
  pages: number;
}

export interface EvolutionContact {
  remoteJid: string;
  pushName: string | null;
}

type UnknownRecord = Record<string, unknown>;

function stateOf(value: unknown): EvolutionStateResult["state"] {
  return value === "open" || value === "connecting" || value === "close" ? value : "unknown";
}

function recordOf(value: unknown): UnknownRecord | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as UnknownRecord
    : null;
}

function nestedRecord(value: UnknownRecord | null, key: string): UnknownRecord | null {
  return recordOf(value?.[key]);
}

function qrImageOf(value: unknown): string | null {
  const body = recordOf(value);
  const qrcode = nestedRecord(body, "qrcode");
  const candidate = body?.base64 ?? qrcode?.base64;
  if (typeof candidate !== "string" || candidate.trim() === "") return null;
  const normalized = candidate.trim();
  if (/^data:image\/(?:png|jpeg);base64,[a-z0-9+/=]+$/i.test(normalized)) return normalized;
  if (/^[a-z0-9+/=]+$/i.test(normalized)) return `data:image/png;base64,${normalized}`;
  return null;
}

function stateFromBody(value: unknown): EvolutionStateResult["state"] {
  const body = recordOf(value);
  const instance = nestedRecord(body, "instance");
  return stateOf(body?.state ?? body?.connectionStatus ?? instance?.state ?? instance?.status);
}

/**
 * Lê o corpo como texto contando os bytes recebidos. Passou de maxBytes, cancela a
 * leitura e lança too_large antes de juntar tudo na memória.
 */
async function readBodyText(response: Response, maxBytes: number | undefined): Promise<string> {
  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (maxBytes !== undefined && total > maxBytes) {
      await reader.cancel().catch(() => undefined);
      throw new EvolutionError("too_large");
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk.buffer, chunk.byteOffset, chunk.byteLength)), total).toString("utf8");
}

export class EvolutionClient {
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly options: EvolutionClientOptions) {
    this.timeoutMs = options.timeoutMs ?? 15_000;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  private async request(path: string, init: RequestInit = {}, timeoutMs = this.timeoutMs): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await this.fetchImpl(`${this.options.baseUrl.replace(/\/$/, "")}${path}`, {
        ...init,
        signal: controller.signal,
        headers: {
          apikey: this.options.apiKey,
          ...(init.headers ?? {})
        }
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        throw new EvolutionError("timeout");
      }
      if (error instanceof Error && error.name === "AbortError") throw new EvolutionError("timeout");
      throw new EvolutionError("evolution_unavailable");
    } finally {
      clearTimeout(timer);
    }
  }

  private async responseJson(response: Response): Promise<unknown> {
    if (!response.ok) {
      throw new EvolutionError(response.status >= 500 ? "evolution_5xx" : "evolution_4xx", response.status);
    }
    try {
      return await response.json() as unknown;
    } catch {
      throw new EvolutionError("invalid_response");
    }
  }

  /** destination: telefone (só os dígitos vão) ou JID completo, como os contatos @lid. */
  async sendText(destination: string, text: string): Promise<EvolutionSendResult> {
    const response = await this.request(`/message/sendText/${encodeURIComponent(this.options.instance)}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        number: destination.includes("@") ? destination : destination.replace(/\D/g, ""),
        options: { delay: 1200, presence: "composing" },
        text
      })
    });
    if (!response.ok) {
      throw new EvolutionError(response.status >= 500 ? "evolution_5xx" : "evolution_4xx", response.status);
    }
    let body: EvolutionSendResponse;
    try {
      body = await response.json() as EvolutionSendResponse;
    } catch {
      throw new EvolutionError("invalid_response");
    }
    const id = body.key?.id;
    if (typeof id !== "string" || !id) throw new EvolutionError("invalid_response");
    return { providerMessageId: id };
  }

  /**
   * Baixa e decifra a mídia de uma mensagem que a Evolution guardou. A Evolution tenta
   * de novo sozinha depois de 5 s, por isso o tempo padrão é maior que o das outras rotas.
   * O prazo cobre também a leitura do corpo (não só a chegada dos cabeçalhos). Com maxBytes,
   * o corpo é lido em streaming e a leitura é cortada (too_large) assim que passa do limite,
   * mesmo sem Content-Length (resposta comprimida/chunked).
   */
  async getMediaBase64(
    providerMessageId: string,
    options: { convertToMp4: boolean; timeoutMs?: number; maxBytes?: number }
  ): Promise<{ mimetype: string | null; base64: string }> {
    const timeoutMs = options.timeoutMs ?? Math.max(this.timeoutMs, 30_000);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const isAbort = (error: unknown) => controller.signal.aborted ||
      (error instanceof Error && error.name === "AbortError");
    // base64 ocupa 4/3 do binário; folga para os demais campos do JSON.
    const maxBodyBytes = options.maxBytes === undefined
      ? undefined
      : Math.ceil(options.maxBytes * 4 / 3) + 64 * 1024;

    try {
      let response: Response;
      try {
        response = await this.fetchImpl(
          `${this.options.baseUrl.replace(/\/$/, "")}/chat/getBase64FromMediaMessage/${encodeURIComponent(this.options.instance)}`,
          {
            method: "POST",
            signal: controller.signal,
            headers: {
              apikey: this.options.apiKey,
              "content-type": "application/json",
              // Sem compressão: o tamanho declarado fica confiável e o corpo não infla ao descomprimir.
              "accept-encoding": "identity"
            },
            body: JSON.stringify({ message: { key: { id: providerMessageId } }, convertToMp4: options.convertToMp4 })
          }
        );
      } catch (error) {
        if (isAbort(error)) throw new EvolutionError("timeout");
        throw new EvolutionError("evolution_unavailable");
      }

      if (!response.ok) {
        await response.body?.cancel().catch(() => undefined);
        throw new EvolutionError(response.status >= 500 ? "evolution_5xx" : "evolution_4xx", response.status);
      }
      if (maxBodyBytes !== undefined) {
        const declared = Number(response.headers.get("content-length") ?? NaN);
        if (Number.isFinite(declared) && declared > maxBodyBytes) {
          await response.body?.cancel().catch(() => undefined);
          throw new EvolutionError("too_large");
        }
      }

      let text: string;
      try {
        text = await readBodyText(response, maxBodyBytes);
      } catch (error) {
        if (error instanceof EvolutionError) throw error;
        if (isAbort(error)) throw new EvolutionError("timeout");
        throw new EvolutionError("evolution_unavailable");
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(text) as unknown;
      } catch {
        throw new EvolutionError("invalid_response");
      }
      const body = recordOf(parsed);
      let base64 = typeof body?.base64 === "string" ? body.base64.trim() : "";
      const dataUrl = /^data:[^;,]*;base64,/i.exec(base64);
      if (dataUrl) base64 = base64.slice(dataUrl[0].length);
      if (!base64 || !/^[A-Za-z0-9+/\s]+={0,2}\s*$/.test(base64)) throw new EvolutionError("invalid_response");
      const mimetype = typeof body?.mimetype === "string" && body.mimetype.trim()
        ? body.mimetype.trim().slice(0, 120)
        : null;
      return { mimetype, base64 };
    } finally {
      clearTimeout(timer);
    }
  }

  /** Uma página das mensagens que a Evolution guardou, da mais nova para a mais antiga. */
  async findMessages(page: number, pageSize: number): Promise<EvolutionMessagesPage> {
    const response = await this.request(`/chat/findMessages/${encodeURIComponent(this.options.instance)}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ where: {}, page, offset: pageSize })
    }, Math.max(this.timeoutMs, 60_000));
    const messages = nestedRecord(recordOf(await this.responseJson(response)), "messages");
    if (!messages || !Array.isArray(messages.records)) throw new EvolutionError("invalid_response");
    const pages = typeof messages.pages === "number" && Number.isFinite(messages.pages) ? messages.pages : 1;
    return { records: messages.records.map(recordOf).filter((item): item is UnknownRecord => item !== null), pages };
  }

  async findContacts(): Promise<EvolutionContact[]> {
    const response = await this.request(`/chat/findContacts/${encodeURIComponent(this.options.instance)}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ where: {} })
    }, Math.max(this.timeoutMs, 60_000));
    const body = await this.responseJson(response);
    if (!Array.isArray(body)) throw new EvolutionError("invalid_response");
    return body.flatMap((value) => {
      const item = recordOf(value);
      const remoteJid = item?.remoteJid;
      if (typeof remoteJid !== "string" || !remoteJid) return [];
      return [{ remoteJid, pushName: typeof item?.pushName === "string" ? item.pushName : null }];
    });
  }

  async connectionState(): Promise<EvolutionStateResult> {
    const response = await this.request(`/instance/connectionState/${encodeURIComponent(this.options.instance)}`);
    return { state: stateFromBody(await this.responseJson(response)) };
  }

  private async configuredInstance(): Promise<EvolutionStateResult | null> {
    const path = `/instance/fetchInstances?instanceName=${encodeURIComponent(this.options.instance)}`;
    const response = await this.request(path);
    // Evolution v2.3.7 returns 404 when the requested instance does not exist.
    // That is the expected precondition for first-time creation, not an API failure.
    if (response.status === 404) return null;
    const body = await this.responseJson(response);
    if (!Array.isArray(body)) throw new EvolutionError("invalid_response");

    for (const value of body) {
      const item = recordOf(value);
      const instance = nestedRecord(item, "instance");
      const name = item?.name ?? item?.instanceName ?? instance?.instanceName;
      if (name === this.options.instance) {
        return { state: stateFromBody(item) };
      }
    }
    return null;
  }

  async connectionQr(): Promise<EvolutionQrResult> {
    const configured = await this.configuredInstance();
    if (configured?.state === "open") {
      await this.ensureWebhook();
      return { state: "open", qrCode: null };
    }

    const response = configured
      ? await this.request(`/instance/connect/${encodeURIComponent(this.options.instance)}`)
      : await this.request("/instance/create", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            instanceName: this.options.instance,
            integration: "WHATSAPP-BAILEYS",
            qrcode: true
          })
        });
    const body = await this.responseJson(response);
    const responseBody = recordOf(body);
    if (responseBody?.error === true) throw new EvolutionError("invalid_response");
    await this.ensureWebhook();

    const state = stateFromBody(body);
    if (state === "open") return { state, qrCode: null };
    const qrCode = qrImageOf(body);
    if (!qrCode) throw new EvolutionError("invalid_response");
    return { state: state === "unknown" ? "connecting" : state, qrCode };
  }

  // Idempotente: cadastra ou corrige o webhook da instância a cada QR pedido.
  private async ensureWebhook(): Promise<void> {
    const webhook = this.options.webhook;
    if (!webhook) return;
    const response = await this.request(`/webhook/set/${encodeURIComponent(this.options.instance)}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        webhook: {
          enabled: true,
          url: webhook.url,
          headers: { "x-webhook-secret": webhook.secret },
          byEvents: false,
          base64: false,
          events: WEBHOOK_EVENTS
        }
      })
    });
    await this.responseJson(response);
  }

  async logout(): Promise<void> {
    const response = await this.request(`/instance/logout/${encodeURIComponent(this.options.instance)}`, {
      method: "DELETE"
    });
    await this.responseJson(response);
  }
}

export function createEvolutionClient(): EvolutionClient {
  if (!env.EVOLUTION_API_URL || !env.EVOLUTION_API_KEY) {
    throw new EvolutionError("not_configured");
  }
  return new EvolutionClient({
    baseUrl: env.EVOLUTION_API_URL,
    apiKey: env.EVOLUTION_API_KEY,
    instance: env.EVOLUTION_INSTANCE,
    webhook: env.WHATSAPP_WEBHOOK_URL && env.WHATSAPP_WEBHOOK_SECRET
      ? { url: env.WHATSAPP_WEBHOOK_URL, secret: env.WHATSAPP_WEBHOOK_SECRET }
      : undefined
  });
}
