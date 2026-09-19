import { Router } from "express";
import { authRouter } from "../modules/auth/auth.routes.js";
import { categoriesRouter } from "../modules/categories/categories.routes.js";
import { clientsRouter } from "../modules/clients/clients.routes.js";
import { pricingRulesRouter } from "../modules/pricing-rules/pricing-rules.routes.js";
import { reservationsRouter } from "../modules/reservations/reservations.routes.js";
import { roomsRouter } from "../modules/rooms/rooms.routes.js";
import { agentsRouter } from "../modules/agents/agents.routes.js";
import { whatsappRouter } from "../modules/whatsapp/whatsapp.routes.js";
import { whatsappWebhookRouter } from "../modules/whatsapp/whatsapp-webhook.routes.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";

export const apiRouter = Router();

apiRouter.use(authRouter);
apiRouter.use(whatsappWebhookRouter);
apiRouter.use(authMiddleware);
apiRouter.use((req, res, next) => {
  if (!req.isAgentsService) return next();
  const allowed =
    (req.method === "GET" && ["/rooms/availability"].includes(req.path)) ||
    (req.method === "GET" && /^\/reservations\/[0-9a-f-]{36}$/i.test(req.path)) ||
    (req.method === "POST" && ["/reservations", "/reservations/quote"].includes(req.path)) ||
    (req.method === "PUT" && /^\/reservations\/[0-9a-f-]{36}$/i.test(req.path)) ||
    (req.method === "POST" && /^\/reservations\/[0-9a-f-]{36}\/cancel$/i.test(req.path));
  if (!allowed) {
    console.warn(JSON.stringify({
      event: "agent_scope_denied",
      method: req.method,
      path: req.path,
      initiatorId: req.agentInitiatorId ?? null
    }));
    res.status(403).json({ message: "A identidade técnica não tem permissão para esta operação." });
    return;
  }
  next();
});

apiRouter.get("/User/me", (req, res) => {
  if (!req.user) {
    res.status(401).json({ message: "Sessão de usuário não encontrada." });
    return;
  }
  res.json({ id: req.user.id, email: req.user.email, role: req.user.role });
});

apiRouter.use(agentsRouter);
apiRouter.use(whatsappRouter);
apiRouter.use(categoriesRouter);
apiRouter.use(clientsRouter);
apiRouter.use(pricingRulesRouter);
apiRouter.use(roomsRouter);
apiRouter.use(reservationsRouter);
