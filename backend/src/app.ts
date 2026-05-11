import express from "express";
import { errorHandler } from "./middlewares/error-handler.js";
import { notFoundHandler } from "./middlewares/not-found.js";
import { registerSecurityMiddlewares } from "./middlewares/security.js";
import { apiRouter } from "./routes/index.js";

export function createApp() {
  const app = express();

  registerSecurityMiddlewares(app);

  app.get("/health", (_req, res) => {
    res.json({
      status: "ok",
      uptime: process.uptime()
    });
  });

  app.use("/api", apiRouter);
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
