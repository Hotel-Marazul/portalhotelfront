import { Router } from "express";
import rateLimit from "express-rate-limit";
import { validate } from "../../middlewares/validate.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { loginBodySchema } from "./auth.schema.js";
import { login } from "./auth.service.js";
import { env } from "../../config/env.js";

const loginRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { flag: false, message: "Muitas tentativas de login. Tente novamente em 15 minutos." }
});

export const authRouter = Router();

authRouter.post(
  "/User/login",
  loginRateLimit,
  validate({ body: loginBodySchema }),
  asyncHandler(async (req, res) => {
    const result = await login(req.body.email, req.body.password);

    res.cookie(env.AUTH_COOKIE_NAME, result.token, {
      httpOnly: true,
      sameSite: "lax",
      secure: env.NODE_ENV === "production",
      path: "/"
    });

    res.status(200).json(result);
  })
);

authRouter.post("/User/logout", (_req, res) => {
  res.clearCookie(env.AUTH_COOKIE_NAME, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.NODE_ENV === "production",
    path: "/"
  });

  res.status(200).json({ flag: true, message: "Logout realizado com sucesso." });
});
