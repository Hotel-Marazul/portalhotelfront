import cors from "cors";
import express, { Express } from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import morgan from "morgan";
import { corsOptions } from "../config/cors.js";

export function registerSecurityMiddlewares(app: Express): void {
  app.use(helmet());
  app.use(cors(corsOptions));
  app.use(express.json({ limit: "100kb" }));
  app.use(
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 200,
      standardHeaders: "draft-7",
      legacyHeaders: false
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
