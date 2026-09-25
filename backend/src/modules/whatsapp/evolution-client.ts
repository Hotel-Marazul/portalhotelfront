import { env } from "../../config/env.js";

export class EvolutionError extends Error {
  constructor(
    public readonly reason: "not_configured" | "timeout" | "invalid_response" | "evolution_4xx" | "evolution_5xx" | "evolution_unavailable",
    public readonly statusCode?: number
  ) {
    super(reason);
  }
}

interface EvolutionClientOptions {
  baseUrl: string;
  apiKey: string;
  instance: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

interface EvolutionSendResponse {
  key?: { id?: unknown };
}

export interface EvolutionSendResult {
  providerMessageId: string;
}

export interface EvolutionStateResult {
  state: "open" | "connecting" | "close" | "unknown";
}

function stateOf(value: unknown): EvolutionStateResult["state"] {
  return value === "open" || value === "connecting" || value === "close" ? value : "unknown";
}

export class EvolutionClient {
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly options: EvolutionClientOptions) {
    this.timeoutMs = options.timeoutMs ?? 15_000;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  private async request(path: string, init: RequestInit = {}): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
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

  async sendText(phone: string, text: string): Promise<EvolutionSendResult> {
    const response = await this.request(`/message/sendText/${encodeURIComponent(this.options.instance)}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        number: phone.replace(/\D/g, ""),
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

  async connectionState(): Promise<EvolutionStateResult> {
    const response = await this.request(`/instance/connectionState/${encodeURIComponent(this.options.instance)}`);
    if (!response.ok) {
      throw new EvolutionError(response.status >= 500 ? "evolution_5xx" : "evolution_4xx", response.status);
    }
    try {
      const body = await response.json() as { state?: unknown; instance?: { state?: unknown } };
      return { state: stateOf(body.state ?? body.instance?.state) };
    } catch {
      throw new EvolutionError("invalid_response");
    }
  }
}

export function createEvolutionClient(): EvolutionClient {
  if (!env.EVOLUTION_API_URL || !env.EVOLUTION_API_KEY) {
    throw new EvolutionError("not_configured");
  }
  return new EvolutionClient({
    baseUrl: env.EVOLUTION_API_URL,
    apiKey: env.EVOLUTION_API_KEY,
    instance: env.EVOLUTION_INSTANCE
  });
}
