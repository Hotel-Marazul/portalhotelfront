import { NextFunction, Request, Response } from "express";
import { createHmac, timingSafeEqual } from "crypto";
import { env } from "../config/env.js";
import { query } from "../db/client.js";
import { verifyAccessToken } from "../utils/jwt.js";

function getCookieValue(cookieHeader: string | undefined, cookieName: string): string | null {
  if (!cookieHeader) return null;

  const cookies = cookieHeader.split(";").map((part) => part.trim());
  const prefix = `${cookieName}=`;
  const found = cookies.find((cookie) => cookie.startsWith(prefix));
  if (!found) return null;

  try {
    return decodeURIComponent(found.slice(prefix.length));
  } catch {
    return null;
  }
}

function readHeader(req: Request, name: string): string | null {
  const value = req.headers[name.toLowerCase()];
  return typeof value === "string" ? value : null;
}

function verifyAgentInitiator(req: Request): string | undefined {
  const initiator = readHeader(req, "x-agent-initiator");
  const signature = readHeader(req, "x-agent-context-signature");
  if (!initiator || !signature || !env.AGENTS_API_KEY || !/^[0-9a-f-]{36}$/i.test(initiator)) {
    return undefined;
  }

  const expected = createHmac("sha256", env.AGENTS_API_KEY).update(initiator).digest("hex");
  const supplied = Buffer.from(signature, "hex");
  const expectedBytes = Buffer.from(expected, "hex");
  if (supplied.length !== expectedBytes.length || !timingSafeEqual(supplied, expectedBytes)) {
    return undefined;
  }
  return initiator;
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
    res.status(401).json({ message: "Token não informado." });
    return;
  }

  if (env.AGENTS_SERVICE_TOKEN) {
    const supplied = Buffer.from(token);
    const expected = Buffer.from(env.AGENTS_SERVICE_TOKEN);
    if (supplied.length === expected.length && timingSafeEqual(supplied, expected)) {
      const initiatorHeader = readHeader(req, "x-agent-initiator");
      const initiator = verifyAgentInitiator(req);
      if (!initiatorHeader) {
        res.status(401).json({ message: "Contexto do agente ausente." });
        return;
      }
      if (!initiator) {
        res.status(401).json({ message: "Contexto do agente inválido." });
        return;
      }
      void query<{ id: string }>("SELECT id FROM users WHERE id = $1 LIMIT 1", [initiator])
        .then((users) => {
          if (users.length === 0) {
            res.status(401).json({ message: "Usuário iniciador não encontrado." });
            return;
          }
          req.isAgentsService = true;
          req.agentInitiatorId = initiator;
          next();
        })
        .catch(() => {
          res.status(503).json({ message: "Não foi possível validar o usuário iniciador." });
        });
      return;
    }
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
    res.status(401).json({ message: "Token inválido ou expirado." });
  }
}
