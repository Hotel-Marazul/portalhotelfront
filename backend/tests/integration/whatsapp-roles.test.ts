import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import type { Server } from "node:http";
import test from "node:test";
import { createApp } from "../../src/app.js";
import { env } from "../../src/config/env.js";
import { pool } from "../../src/db/client.js";
import { initializeDatabase } from "../../src/db/init.js";
import { signAccessToken } from "../../src/utils/jwt.js";

test("rotas WhatsApp exigem usuário humano admin ou receptionist", async () => {
  await initializeDatabase();
  const previousEnabled = env.WHATSAPP_ENABLED;
  env.WHATSAPP_ENABLED = true;

  const contactId = randomUUID();
  const conversationId = randomUUID();
  const phone = "+5548999991234";
  const users = await pool.query<{ id: string; email: string; role: "admin" | "receptionist" }>(
    "SELECT id, email, role FROM users WHERE role IN ('admin', 'receptionist') ORDER BY role"
  );
  const admin = users.rows.find((user) => user.role === "admin");
  const receptionist = users.rows.find((user) => user.role === "receptionist");
  assert.ok(admin);
  assert.ok(receptionist);

  await pool.query(
    `INSERT INTO whatsapp_contacts (id, remote_jid, phone_e164, push_name)
     VALUES ($1, $2, $3, 'Papel Fixture')`,
    [contactId, `${phone.slice(1)}@s.whatsapp.net`, phone]
  );
  await pool.query("INSERT INTO whatsapp_conversations (id, contact_id) VALUES ($1, $2)", [conversationId, contactId]);

  const app = createApp();
  const server = await new Promise<Server>((resolve) => {
    const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
  });
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const endpoint = `http://127.0.0.1:${address.port}/api`;
  const humanHeaders = (user: { id: string; email: string; role: "admin" | "receptionist" }) => ({
    Authorization: `Bearer ${signAccessToken(user)}`,
    "Content-Type": "application/json"
  });
  const serviceHeaders = {
    Authorization: `Bearer ${env.AGENTS_SERVICE_TOKEN}`,
    "x-agent-initiator": admin.id,
    "x-agent-context-signature": createHmac("sha256", env.AGENTS_API_KEY!).update(admin.id).digest("hex")
  };
  const routes: Array<{ method: string; path: string; body?: Record<string, string | null>; adminOnly?: boolean }> = [
    { method: "GET", path: "/whatsapp/status" },
    { method: "GET", path: "/whatsapp/queue" },
    { method: "GET", path: "/whatsapp/conversations?search=Pap" },
    { method: "GET", path: "/whatsapp/queue/count" },
    { method: "GET", path: `/whatsapp/conversations/${conversationId}` },
    { method: "GET", path: `/whatsapp/conversations/${conversationId}/messages` },
    { method: "POST", path: `/whatsapp/conversations/${conversationId}/read` },
    { method: "POST", path: `/whatsapp/conversations/${conversationId}/dismiss` },
    { method: "POST", path: `/whatsapp/conversations/${conversationId}/suggestion` },
    { method: "POST", path: `/whatsapp/suggestions/${randomUUID()}/dismiss` },
    { method: "POST", path: `/whatsapp/conversations/${conversationId}/messages` },
    { method: "POST", path: `/whatsapp/messages/${randomUUID()}/retry` },
    { method: "GET", path: `/whatsapp/contacts/${contactId}/link-candidates` },
    { method: "PUT", path: `/whatsapp/contacts/${contactId}/kind`, body: { kind: "guest" } },
    { method: "PUT", path: `/whatsapp/contacts/${contactId}/link`, body: { clientId: randomUUID() } },
    { method: "DELETE", path: `/whatsapp/contacts/${contactId}/link` },
    { method: "PUT", path: `/whatsapp/conversations/${conversationId}/outcome`, body: { outcome: null } },
    { method: "POST", path: `/whatsapp/conversations/${conversationId}/priority-feedback`, body: { verdict: "correct" } },
    { method: "DELETE", path: `/whatsapp/conversations/${conversationId}/priority-feedback` },
    { method: "GET", path: "/whatsapp/learning/summary?period=7d" },
    { method: "GET", path: "/whatsapp/learning/rules" },
    { method: "GET", path: "/whatsapp/learning/corrections?page=1" },
    { method: "POST", path: "/whatsapp/learning/recompute", adminOnly: true },
    { method: "POST", path: `/whatsapp/learning/rules/${randomUUID()}/accept`, adminOnly: true }
  ];

  try {
    for (const route of routes) {
      const response = await fetch(`${endpoint}${route.path}`, {
        method: route.method,
        body: route.body ? JSON.stringify(route.body) : undefined,
        headers: route.body ? { "Content-Type": "application/json" } : undefined
      });
      assert.equal(response.status, 401, `${route.method} ${route.path}`);
    }
    const service = await fetch(`${endpoint}/whatsapp/queue`, { headers: serviceHeaders });
    assert.equal(service.status, 403);

    for (const user of [admin, receptionist]) {
      for (const route of routes) {
        const response = await fetch(`${endpoint}${route.path}`, {
          method: route.method,
          headers: humanHeaders(user),
          body: route.body ? JSON.stringify(route.body) : undefined
        });
        assert.notEqual(response.status, 401, `${user.role} ${route.method} ${route.path}`);
        if (route.adminOnly && user.role === "receptionist") {
          assert.equal(response.status, 403, `${user.role} ${route.method} ${route.path}`);
        } else {
          assert.notEqual(response.status, 403, `${user.role} ${route.method} ${route.path}`);
        }
      }
    }
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await pool.query("DELETE FROM whatsapp_contacts WHERE id = $1", [contactId]);
    env.WHATSAPP_ENABLED = previousEnabled;
    await pool.end();
  }
});
