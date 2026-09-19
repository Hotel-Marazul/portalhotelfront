import { Router } from "express";
import { env } from "../../config/env.js";
import { requireRole } from "../../middlewares/require-role.js";

export const whatsappRouter = Router();

whatsappRouter.use(requireRole("admin", "receptionist"));

whatsappRouter.get("/whatsapp/status", (_req, res) => {
  if (!env.WHATSAPP_ENABLED) {
    res.json({ enabled: false });
    return;
  }

  res.json({ enabled: true });
});

whatsappRouter.use((req, res, next) => {
  if (env.WHATSAPP_ENABLED) {
    next();
    return;
  }

  res.status(404).json({ message: "Módulo WhatsApp desligado." });
});
