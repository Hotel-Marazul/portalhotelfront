import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import type { Server } from "node:http";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { createApp } from "../../src/app.js";
import { env } from "../../src/config/env.js";
import { pool } from "../../src/db/client.js";
import { initializeDatabase } from "../../src/db/init.js";
import { signAccessToken } from "../../src/utils/jwt.js";

test("webhook usa autenticação, limite próprio e não afrouxa o parser global", async () => {
  await initializeDatabase();
  const previousEnabled = env.WHATSAPP_ENABLED;
  const previousSecret = env.WHATSAPP_WEBHOOK_SECRET;
  env.WHATSAPP_ENABLED = true;
  env.WHATSAPP_WEBHOOK_SECRET = "w".repeat(32);

  const marker = `webhook-test-${randomUUID()}`;
  const instances = [marker, `${marker}-large`, ...Array.from({ length: 300 }, (_, index) => `${marker}-${index}`)];
  const app = createApp();
  const server = await new Promise<Server>((resolve) => {
    const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
  });
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const endpoint = `http://127.0.0.1:${address.port}/api/whatsapp/webhook`;
  const headers = {
    "Content-Type": "application/json",
    "x-webhook-secret": env.WHATSAPP_WEBHOOK_SECRET
  };

  try {
    const withoutSecret = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event: "messages.delete", instance: marker })
    });
    assert.equal(withoutSecret.status, 401);

    const startedAt = performance.now();
    const accepted = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({ event: "messages.delete", instance: marker, data: {} })
    });
    assert.equal(accepted.status, 200);
    assert.deepEqual(await accepted.json(), { received: true });
    assert.ok(performance.now() - startedAt < 2_000);

    const large = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({
        event: "messages.delete",
        instance: `${marker}-large`,
        data: { padding: "x".repeat(1_500_000) }
      })
    });
    assert.equal(large.status, 200);

    for (let index = 0; index < 300; index += 1) {
      const response = await fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify({
          event: "messages.delete",
          instance: `${marker}-${index}`,
          data: {}
        })
      });
      assert.equal(response.status, 200);
    }

    const admin = await pool.query<{ id: string; email: string; role: "admin" | "receptionist" }>(
      "SELECT id, email, role FROM users WHERE role = 'admin' ORDER BY created_at ASC LIMIT 1"
    );
    assert.ok(admin.rows[0]);
    const oversizedOtherRoute = await fetch(`${endpoint.replace("/whatsapp/webhook", "/client/create")}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${signAccessToken(admin.rows[0])}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        fullName: "x".repeat(120_000),
        cpf: "11144477735",
        email: `parser-${marker}@example.test`,
        fone: "48999998888"
      })
    });
    assert.equal(oversizedOtherRoute.status, 413);

    const originalPoolQuery = pool.query.bind(pool);
    const mutablePool = pool as unknown as {
      query: (...args: unknown[]) => Promise<unknown>;
    };
    mutablePool.query = async () => {
      throw new Error("forced_webhook_insert_failure");
    };
    try {
      const failedInsert = await fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify({ event: "messages.delete", instance: `${marker}-failed`, data: {} })
      });
      assert.equal(failedInsert.status, 503);
    } finally {
      mutablePool.query = originalPoolQuery;
    }
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await pool.query("DELETE FROM whatsapp_webhook_events WHERE instance_name = ANY($1::text[])", [instances]);
    env.WHATSAPP_ENABLED = previousEnabled;
    env.WHATSAPP_WEBHOOK_SECRET = previousSecret;
    await pool.end();
  }
});
