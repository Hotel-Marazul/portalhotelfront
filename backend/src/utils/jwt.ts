import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { AuthUser } from "../types/auth.js";

interface TokenPayload {
  sub: string;
  email: string;
  role: AuthUser["role"];
}

export function signAccessToken(user: AuthUser): string {
  const payload: TokenPayload = {
    sub: user.id,
    email: user.email,
    role: user.role
  };

  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"]
  });
}

export function verifyAccessToken(token: string): AuthUser {
  const payload = jwt.verify(token, env.JWT_SECRET) as TokenPayload;
  return {
    id: payload.sub,
    email: payload.email,
    role: payload.role
  };
}
