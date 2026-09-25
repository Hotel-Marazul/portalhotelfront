import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import express, { Request, Response, Router } from "express";
import rateLimit from "express-rate-limit";
import { env } from "../../config/env.js";
import { pool } from "../../db/client.js";
import { processWebhookEvent } from "./webhook.worker.js";

export const whatsappWebhookRouter = Router();

const webhookRateLimit = rateLimit({
  windowMs: 60 * 1000,
  limit: 600,
  standardHeaders: "draft-7",
  legacyHeaders: false
});
const webhookBodyParser = express.json({ limit: "2mb" });

type WebhookPayload = Record<string, unknown>;

function asObject(value: unknown): WebhookPayload {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as WebhookPayload
    : {};
}

function readSecret(req: Request): string {
  const header = req.get("x-webhook-secret");
  if (header) return header;
  return typeof req.query.token === "string" ? req.query.token : "";
}

function hasValidSecret(req: Request): boolean {
  const expected = env.WHATSAPP_WEBHOOK_SECRET;
  if (!expected) return false;

  const digest = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(readSecret(req)), digest(expected));
}

function requireModuleEnabled(_req: Request, res: Response, next: () => void): void {
  if (!env.WHATSAPP_ENABLED) {
    res.status(404).json({ message: "Módulo WhatsApp desligado." });
    return;
  }
  next();
}

function requireWebhookSecret(req: Request, res: Response, next: () => void): void {
  if (!hasValidSecret(req)) {
    res.status(401).json({ message: "Segredo do webhook inválido." });
    return;
  }
  next();
}

export async function storeWebhookEvent(payload: unknown): Promise<string> {
  const body = asObject(payload);
  const id = randomUUID();
  await pool.query(
    `INSERT INTO whatsapp_webhook_events (id, instance_name, event_type, payload)
     VALUES ($1, $2, $3, $4::jsonb)`,
    [
      id,
      typeof body.instance === "string" ? body.instance : "",
      typeof body.event === "string" ? body.event : "unknown",
      JSON.stringify(payload ?? {})
    ]
  );
  return id;
}

whatsappWebhookRouter.post(
  "/webhook",
  requireModuleEnabled,
  webhookRateLimit,
  requireWebhookSecret,
  webhookBodyParser,
  async (req, res) => {
    try {
      const id = await storeWebhookEvent(req.body);
      res.status(200).json({ received: true });
      setImmediate(() => {
        void processWebhookEvent(id).catch(() => undefined);
      });
    } catch {
      res.status(503).json({ message: "Não foi possível registrar o evento do WhatsApp." });
    }
  }
);
