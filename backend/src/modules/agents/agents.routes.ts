import { createHmac } from "crypto";
import { Router } from "express";
import { env } from "../../config/env.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { HttpError } from "../../utils/http-error.js";

export const agentsRouter = Router();

function gatewayConfig() {
  if (!env.AGENTS_API_URL || !env.AGENTS_API_KEY) {
    throw new HttpError(503, "O serviço de agentes não está configurado.");
  }
  return { baseUrl: env.AGENTS_API_URL.replace(/\/+$/, ""), apiKey: env.AGENTS_API_KEY };
}

function contextHeaders(userId: string | undefined, apiKey: string) {
  if (!userId) throw new HttpError(401, "Usuário não autenticado.");
  return {
    "X-Agent-Initiator": userId,
    "X-Agent-Context-Signature": createHmac("sha256", apiKey).update(userId).digest("hex")
  };
}

async function callAgents(path: string, init: RequestInit = {}) {
  const config = gatewayConfig();
  try {
    return await fetch(`${config.baseUrl}${path}`, {
      ...init,
      headers: {
        "X-API-Key": config.apiKey,
        ...(init.headers ?? {})
      },
      signal: init.signal ?? AbortSignal.timeout(15_000)
    });
  } catch {
    throw new HttpError(502, "O serviço de agentes está indisponível.");
  }
}

agentsRouter.get("/agent/health", asyncHandler(async (_req, res) => {
  const response = await callAgents("/health");
  if (!response.ok) throw new HttpError(502, "O serviço de agentes está indisponível.");
  res.json(await response.json());
}));

agentsRouter.post("/agent/chat", asyncHandler(async (req, res) => {
  const config = gatewayConfig();
  const response = await callAgents("/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...contextHeaders(req.user?.id, config.apiKey)
    },
    body: JSON.stringify(req.body)
  });
  const body = await response.text();
  if (!response.ok) {
    throw new HttpError(response.status >= 500 ? 502 : response.status, "Falha ao processar a solicitação do agente.");
  }
  res.type("application/json").send(body);
}));
