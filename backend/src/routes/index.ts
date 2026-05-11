import { Router } from "express";
import { authRouter } from "../modules/auth/auth.routes.js";
import { categoriesRouter } from "../modules/categories/categories.routes.js";
import { clientsRouter } from "../modules/clients/clients.routes.js";
import { pricingRulesRouter } from "../modules/pricing-rules/pricing-rules.routes.js";
import { reservationsRouter } from "../modules/reservations/reservations.routes.js";
import { roomsRouter } from "../modules/rooms/rooms.routes.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";

export const apiRouter = Router();

apiRouter.use(authRouter);
apiRouter.use(authMiddleware);
apiRouter.use(categoriesRouter);
apiRouter.use(clientsRouter);
apiRouter.use(pricingRulesRouter);
apiRouter.use(roomsRouter);
apiRouter.use(reservationsRouter);
