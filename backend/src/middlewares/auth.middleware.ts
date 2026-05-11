import { NextFunction, Request, Response } from "express";
import { env } from "../config/env.js";
import { verifyAccessToken } from "../utils/jwt.js";

function getCookieValue(cookieHeader: string | undefined, cookieName: string): string | null {
  if (!cookieHeader) return null;

  const cookies = cookieHeader.split(";").map((part) => part.trim());
  const found = cookies.find((cookie) => cookie.startsWith(`${cookieName}=`));
  if (!found) return null;

  const [, value = ""] = found.split("=");
  return decodeURIComponent(value);
}

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  const cookieToken = getCookieValue(req.headers.cookie, env.AUTH_COOKIE_NAME);

  let token: string | null = null;

  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.slice("Bearer ".length);
  } else if (cookieToken) {
    token = cookieToken;
  }

  if (!token) {
    res.status(401).json({ message: "Token nÃ£o informado." });
    return;
  }

  try {
    req.user = verifyAccessToken(token);
    next();
  } catch {
    res.clearCookie(env.AUTH_COOKIE_NAME, {
      httpOnly: true,
      sameSite: "lax",
      secure: env.NODE_ENV === "production",
      path: "/"
    });
    res.status(401).json({ message: "Token invÃ¡lido ou expirado." });
  }
}
