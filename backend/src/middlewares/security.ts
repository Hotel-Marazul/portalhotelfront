import cors from "cors";
import express, { Express } from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import morgan from "morgan";
import { corsOptions } from "../config/cors.js";

export function registerSecurityMiddlewares(app: Express): void {
  app.use(helmet());
  app.use(cors(corsOptions));
  app.use((req, res, next) => {
    if (req.path === "/api/whatsapp/webhook") {
      next();
      return;
    }
    express.json({ limit: "100kb" })(req, res, next);
  });
  // A central do WhatsApp consulta fila, status e conversa em segundo plano enquanto
  // a aba fica aberta, o que estoura o limitador global em poucos minutos. Ela tem
  // limitador próprio, mais alto e por minuto, como o webhook.
  const whatsappPortalLimit = rateLimit({
    windowMs: 60 * 1000,
    limit: 600,
    standardHeaders: "draft-7",
    legacyHeaders: false
  });
  app.use("/api/whatsapp", (req, res, next) => {
    if (req.path === "/webhook") {
      next();
      return;
    }
    whatsappPortalLimit(req, res, next);
  });
  app.use(
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 200,
      standardHeaders: "draft-7",
      legacyHeaders: false,
      skip: (req) => req.path.startsWith("/api/whatsapp")
    })
  );
  app.use(morgan((tokens, req, res) => {
    const path = tokens.url(req, res)?.split("?", 1)[0] ?? "-";
    return [
      tokens["remote-addr"](req, res),
      tokens.method(req, res),
      path,
      tokens.status(req, res),
      tokens["res"](req, res, "content-length"),
      `${tokens["response-time"](req, res)} ms`
    ].join(" ");
  }));
}
