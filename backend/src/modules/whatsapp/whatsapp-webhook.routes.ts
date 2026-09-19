import { Router } from "express";
import { env } from "../../config/env.js";

export const whatsappWebhookRouter = Router();

whatsappWebhookRouter.post("/whatsapp/webhook", (_req, res) => {
  if (!env.WHATSAPP_ENABLED) {
    res.status(404).json({ message: "Módulo WhatsApp desligado." });
    return;
  }

  res.status(501).json({ message: "Webhook WhatsApp ainda não configurado." });
});
