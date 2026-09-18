import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { AuthUser } from "../types/auth.js";

interface TokenPayload {
  sub?: unknown;
  email?: unknown;
  role?: unknown;
}

function isAuthRole(value: unknown): value is AuthUser["role"] {
  return value === "admin" || value === "receptionist";
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
  const payload = jwt.verify(token, env.JWT_SECRET);
  if (typeof payload !== "object" || payload === null) {
    throw new Error("Invalid token payload.");
  }

  const typedPayload = payload as TokenPayload;
  if (
    typeof typedPayload.sub !== "string" ||
    typeof typedPayload.email !== "string" ||
    !isAuthRole(typedPayload.role)
  ) {
    throw new Error("Invalid token payload.");
  }

  return {
    id: typedPayload.sub,
    email: typedPayload.email,
    role: typedPayload.role
  };
}
