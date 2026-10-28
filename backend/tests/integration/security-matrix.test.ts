import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { Server } from "node:http";
import test from "node:test";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { createApp } from "../../src/app.js";
import { env } from "../../src/config/env.js";
import { pool } from "../../src/db/client.js";
import { initializeDatabase } from "../../src/db/init.js";
import { signAccessToken } from "../../src/utils/jwt.js";

type Route = { method: string; path: string };

// Toda rota atrás do authMiddleware. Sem token, nenhuma pode responder outra coisa que 401.
function protectedRoutes(id: string): Route[] {
  return [
    { method: "GET", path: "/User/me" },
    { method: "GET", path: "/Categories" },
    { method: "GET", path: "/categories" },
    { method: "POST", path: "/Categories/create" },
    { method: "PUT", path: `/Categories/update/${id}` },
    { method: "DELETE", path: `/Categories/delete/${id}` },
    { method: "GET", path: "/client" },
    { method: "GET", path: `/client/${id}` },
    { method: "POST", path: "/client/create" },
    { method: "PUT", path: `/client/${id}` },
    { method: "DELETE", path: `/client/${id}` },
    { method: "GET", path: "/GuestPricingRule" },
    { method: "GET", path: "/pricing-rules" },
    { method: "POST", path: "/pricing-rules" },
    { method: "PUT", path: `/pricing-rules/${id}` },
    { method: "GET", path: "/rooms" },
    { method: "GET", path: "/Rooms" },
    { method: "GET", path: "/rooms/availability" },
    { method: "GET", path: "/rooms/summary" },
    { method: "PATCH", path: `/rooms/${id}/housekeeping` },
    { method: "POST", path: "/Rooms" },
    { method: "PUT", path: `/Rooms/update/${id}` },
    { method: "DELETE", path: `/Rooms/delete/${id}` },
    { method: "GET", path: "/reservations" },
    { method: "POST", path: "/reservations" },
    { method: "POST", path: "/reservations/quote" },
    { method: "GET", path: `/reservations/${id}` },
    { method: "PUT", path: `/reservations/${id}` },
    { method: "POST", path: `/reservations/${id}/cancel` },
    { method: "DELETE", path: `/Reservations/${id}` },
    { method: "POST", path: `/reservations/${id}/transitions` },
    { method: "GET", path: `/reservations/${id}/payments` },
    { method: "POST", path: `/reservations/${id}/payments` },
    { method: "POST", path: `/reservations/${id}/payments/${id}/reverse` },
    { method: "GET", path: "/reservations/counter-summary" },
    { method: "GET", path: "/reservations/revenue-summary" },
    { method: "GET", path: "/whatsapp/status" },
    { method: "GET", path: "/whatsapp/queue" },
    { method: "POST", path: `/clients/${id}/deactivate` },
    { method: "POST", path: `/clients/${id}/reactivate` },
    { method: "POST", path: `/rooms/${id}/deactivate` },
    { method: "POST", path: `/rooms/${id}/reactivate` },
    { method: "POST", path: `/categories/${id}/deactivate` },
    { method: "POST", path: `/categories/${id}/reactivate` },
    { method: "GET", path: "/whatsapp/configuration" }
  ];
}

// Só o gerente. A recepção recebe 403 antes de qualquer validação ou escrita.
function adminOnlyRoutes(id: string): Route[] {
  return [
    { method: "POST", path: "/Categories/create" },
    { method: "PUT", path: `/Categories/update/${id}` },
    { method: "DELETE", path: `/Categories/delete/${id}` },
    { method: "POST", path: "/pricing-rules" },
    { method: "PUT", path: `/pricing-rules/${id}` },
    { method: "POST", path: "/Rooms" },
    { method: "PUT", path: `/Rooms/update/${id}` },
    { method: "DELETE", path: `/Rooms/delete/${id}` },
    { method: "DELETE", path: `/client/${id}` },
    { method: "POST", path: `/clients/${id}/deactivate` },
    { method: "POST", path: `/clients/${id}/reactivate` },
    { method: "POST", path: `/rooms/${id}/deactivate` },
    { method: "POST", path: `/rooms/${id}/reactivate` },
    { method: "POST", path: `/categories/${id}/deactivate` },
    { method: "POST", path: `/categories/${id}/reactivate` },
    { method: "POST", path: `/reservations/${id}/payments/${id}/reverse` },
    { method: "GET", path: "/reservations/revenue-summary" },
    { method: "GET", path: "/whatsapp/configuration" },
    { method: "POST", path: "/whatsapp/connection/qr" },
    { method: "DELETE", path: "/whatsapp/connection" },
    { method: "POST", path: "/whatsapp/history-sync" },
    { method: "POST", path: "/whatsapp/learning/recompute" },
    { method: "POST", path: `/whatsapp/learning/rules/${id}/accept` }
  ];
}

test("autenticação, papéis e origem barram cada rota protegida", async () => {
  await initializeDatabase();
  const previousEnabled = env.WHATSAPP_ENABLED;
  env.WHATSAPP_ENABLED = true;

  const id = randomUUID();
  const password = `senha-${randomUUID()}`;
  const loginUser = { id: randomUUID(), email: `security-${id}@example.test`, role: "receptionist" as const };
  await pool.query(
    "INSERT INTO users (id, name, email, password_hash, role) VALUES ($1, 'Security Fixture', $2, $3, 'receptionist')",
    [loginUser.id, loginUser.email, await bcrypt.hash(password, 4)]
  );

  const app = createApp();
  const server = await new Promise<Server>((resolve) => {
    const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
  });
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const endpoint = `http://127.0.0.1:${address.port}/api`;
  const call = (route: Route, headers: Record<string, string> = {}) =>
    fetch(`${endpoint}${route.path}`, { method: route.method, headers });
  const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });
  const claims = { sub: loginUser.id, email: loginUser.email, role: "admin" };

  try {
    for (const route of protectedRoutes(id)) {
      assert.equal((await call(route)).status, 401, `sem token ${route.method} ${route.path}`);
    }

    const forged = [
      ["segredo errado", jwt.sign(claims, "outro-segredo-0123456789abcdef0123")],
      ["alg none", jwt.sign(claims, "", { algorithm: "none" })],
      ["expirado", jwt.sign({ ...claims, exp: Math.floor(Date.now() / 1000) - 60 }, env.JWT_SECRET)],
      ["token de serviço antigo", "x".repeat(64)]
    ] as const;
    for (const [label, token] of forged) {
      const response = await call({ method: "GET", path: "/reservations" }, {
        ...bearer(token),
        "x-agent-initiator": loginUser.id,
        "x-agent-context-signature": "00".repeat(32)
      });
      assert.equal(response.status, 401, label);
    }

    const receptionist = bearer(signAccessToken(loginUser));
    for (const route of adminOnlyRoutes(id)) {
      assert.equal((await call(route, receptionist)).status, 403, `recepção ${route.method} ${route.path}`);
    }

    const admin = bearer(signAccessToken({ ...loginUser, role: "admin" }));
    assert.equal((await call({ method: "POST", path: "/agent/chat" }, admin)).status, 404, "chat do agente removido");
    assert.equal((await call({ method: "GET", path: "/agent/health" }, admin)).status, 404, "health do agente removido");

    const foreign = await call({ method: "POST", path: `/reservations/${id}/cancel` }, {
      ...admin,
      Origin: "https://evil.example"
    });
    assert.equal(foreign.status, 403, "mutação de outra origem");

    const webhook = await fetch(`${endpoint}/whatsapp/webhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-webhook-secret": "errado" },
      body: "{}"
    });
    assert.equal(webhook.status, 401, "webhook sem o segredo");

    const login = (email: string, pass: string) => fetch(`${endpoint}/User/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: pass })
    });
    const unknown = await login(`ninguem-${id}@example.test`, password);
    const wrong = await login(loginUser.email, "senha-errada");
    assert.equal(unknown.status, 401);
    assert.equal(wrong.status, 401);
    assert.deepEqual(await unknown.json(), await wrong.json(), "e-mail inexistente e senha errada respondem igual");

    const ok = await login(loginUser.email, password);
    assert.equal(ok.status, 200);
    const body = await ok.json() as Record<string, unknown>;
    assert.equal(body.token, undefined, "o token não vai no corpo");
    const cookie = ok.headers.get("set-cookie") ?? "";
    assert.match(cookie, new RegExp(`^${env.AUTH_COOKIE_NAME}=`));
    assert.match(cookie, /HttpOnly/i);
    assert.match(cookie, /SameSite=Lax/i);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await pool.query("DELETE FROM users WHERE id = $1", [loginUser.id]);
    env.WHATSAPP_ENABLED = previousEnabled;
    await pool.end();
  }
});
