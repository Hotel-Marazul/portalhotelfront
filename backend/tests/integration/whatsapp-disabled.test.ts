import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "../../src/app.js";
import { env } from "../../src/config/env.js";
import { pool } from "../../src/db/client.js";
import { initializeDatabase } from "../../src/db/init.js";
import { signAccessToken } from "../../src/utils/jwt.js";

test("rotas WhatsApp ficam desligadas sem habilitar o módulo", async () => {
  await initializeDatabase();
  const previousEnabled = env.WHATSAPP_ENABLED;
  env.WHATSAPP_ENABLED = false;
  const user = await pool.query<{ id: string; email: string; role: "admin" | "receptionist" }>(
    "SELECT id, email, role FROM users WHERE role = 'admin' ORDER BY created_at ASC LIMIT 1"
  );
  assert.ok(user.rows[0]);

  const app = createApp();
  const server = await new Promise<import("node:http").Server>((resolve) => {
    const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
  });
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const authorization = `Bearer ${signAccessToken(user.rows[0])}`;

  try {
    const status = await fetch(`http://127.0.0.1:${address.port}/api/whatsapp/status`, {
      headers: { Authorization: authorization }
    });
    assert.equal(status.status, 200);
    assert.deepEqual(await status.json(), { enabled: false });

    const configuration = await fetch(`http://127.0.0.1:${address.port}/api/whatsapp/configuration`, {
      headers: { Authorization: authorization }
    });
    assert.equal(configuration.status, 200);
    const configurationBody = await configuration.json() as {
      connection: { enabled: boolean; apiConfigured: boolean; webhookConfigured: boolean };
    };
    assert.equal(configurationBody.connection.enabled, false);
    assert.equal(typeof configurationBody.connection.apiConfigured, "boolean");
    assert.equal(typeof configurationBody.connection.webhookConfigured, "boolean");

    const queue = await fetch(`http://127.0.0.1:${address.port}/api/whatsapp/queue`, {
      headers: { Authorization: authorization }
    });
    assert.equal(queue.status, 404);

    const webhook = await fetch(`http://127.0.0.1:${address.port}/api/whatsapp/webhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event: "messages.upsert" })
    });
    assert.equal(webhook.status, 404);
  } finally {
    env.WHATSAPP_ENABLED = previousEnabled;
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await pool.end();
  }
});
