import { Router } from "express";
import { authRouter } from "../modules/auth/auth.routes.js";
import { categoriesRouter } from "../modules/categories/categories.routes.js";
import { clientsRouter } from "../modules/clients/clients.routes.js";
import { deactivationRouter } from "../modules/deactivation/deactivation.routes.js";
import { pricingRulesRouter } from "../modules/pricing-rules/pricing-rules.routes.js";
import { reservationsRouter } from "../modules/reservations/reservations.routes.js";
import { roomsRouter } from "../modules/rooms/rooms.routes.js";
import { whatsappRouter } from "../modules/whatsapp/whatsapp.routes.js";
import { whatsappWebhookRouter } from "../modules/whatsapp/whatsapp-webhook.routes.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";

export const apiRouter = Router();

apiRouter.use(authRouter);
apiRouter.use("/whatsapp", whatsappWebhookRouter);
apiRouter.use(authMiddleware);

apiRouter.get("/User/me", (req, res) => {
  if (!req.user) {
    res.status(401).json({ message: "Sessão de usuário não encontrada." });
    return;
  }
  res.json({ id: req.user.id, email: req.user.email, role: req.user.role });
});

apiRouter.use("/whatsapp", whatsappRouter);
apiRouter.use(deactivationRouter);
apiRouter.use(categoriesRouter);
apiRouter.use(clientsRouter);
apiRouter.use(pricingRulesRouter);
apiRouter.use(roomsRouter);
apiRouter.use(reservationsRouter);
