import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createServer, type ServerResponse } from "node:http";
import test from "node:test";
import { env } from "../../src/config/env.js";
import { pool } from "../../src/db/client.js";
import { initializeDatabase } from "../../src/db/init.js";
import { ingestWebhookPayload } from "../../src/modules/whatsapp/ingestion.service.js";
import { sendMessage } from "../../src/modules/whatsapp/outbound.service.js";

function listen(server = createServer()): Promise<ReturnType<typeof createServer>> {
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(server)));
}

test("reconcilia envio quando Evolution ou evento fromMe chega primeiro", async () => {
  await initializeDatabase();
  const previous = {
    evolutionUrl: env.EVOLUTION_API_URL,
    evolutionKey: env.EVOLUTION_API_KEY,
    instance: env.EVOLUTION_INSTANCE
  };
  env.EVOLUTION_API_KEY = "e".repeat(16);
  env.EVOLUTION_INSTANCE = `reconcile-${randomUUID()}`;

  let calls = 0;
  let heldResponse: ServerResponse | undefined;
  let resolveSecondRequest: (() => void) | undefined;
  const secondRequest = new Promise<void>((resolve) => { resolveSecondRequest = resolve; });
  const evolution = await listen(createServer((_req, res) => {
    calls += 1;
    if (calls === 2) {
      heldResponse = res;
      resolveSecondRequest?.();
      return;
    }
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ key: { id: "provider-response-first" } }));
  }));
  const evolutionAddress = evolution.address();
  assert.ok(evolutionAddress && typeof evolutionAddress !== "string");
  env.EVOLUTION_API_URL = `http://127.0.0.1:${evolutionAddress.port}`;

  const user = await pool.query<{ id: string }>("SELECT id FROM users WHERE role = 'admin' ORDER BY created_at LIMIT 1");
  assert.ok(user.rows[0]);
  const contacts = [randomUUID(), randomUUID()];
  const conversations = [randomUUID(), randomUUID()];
  const phones = ["+5548998765001", "+5548998765002"];
  await pool.query(
    `INSERT INTO whatsapp_contacts (id, remote_jid, phone_e164, push_name)
     VALUES ($1, $3, $4, 'Reconciliação A'), ($2, $5, $6, 'Reconciliação B')`,
    [contacts[0], contacts[1], `${phones[0]?.slice(1)}@s.whatsapp.net`, phones[0], `${phones[1]?.slice(1)}@s.whatsapp.net`, phones[1]]
  );
  await pool.query("INSERT INTO whatsapp_conversations (id, contact_id) VALUES ($1, $3), ($2, $4)", [conversations[0], conversations[1], contacts[0], contacts[1]]);
  await pool.query(
    "INSERT INTO whatsapp_instances (id, name, connection_state) VALUES ($1, $2, 'open')",
    [randomUUID(), env.EVOLUTION_INSTANCE]
  );

  const eventFor = (phone: string, providerMessageId: string, body: string) => ({
    event: "messages.upsert",
    instance: env.EVOLUTION_INSTANCE,
    data: {
      key: { remoteJid: `${phone.slice(1)}@s.whatsapp.net`, fromMe: true, id: providerMessageId },
      message: { conversation: body },
      messageTimestamp: Math.floor(Date.now() / 1000)
    }
  });
  const countMessages = (conversationId: string) => pool.query<{ count: number; origin: string; sent_by_user_id: string | null }>(
    `SELECT COUNT(*) OVER ()::int AS count, origin, sent_by_user_id
     FROM whatsapp_messages WHERE conversation_id = $1`,
    [conversationId]
  );

  try {
    await sendMessage({
      conversationId: conversations[0]!, userId: user.rows[0]!.id, text: "Resposta primeiro", clientRequestId: randomUUID(), force: true
    });
    await ingestWebhookPayload(eventFor(phones[0]!, "provider-response-first", "Resposta primeiro"), env.EVOLUTION_INSTANCE);
    const responseFirst = await countMessages(conversations[0]!);
    assert.equal(responseFirst.rows[0]?.count, 1);
    assert.equal(responseFirst.rows[0]?.origin, "portal_manual");
    assert.equal(responseFirst.rows[0]?.sent_by_user_id, user.rows[0]?.id);

    const eventFirstPromise = sendMessage({
      conversationId: conversations[1]!, userId: user.rows[0]!.id, text: "Evento primeiro", clientRequestId: randomUUID(), force: true
    });
    await secondRequest;
    await ingestWebhookPayload(eventFor(phones[1]!, "provider-event-first", "Evento primeiro"), env.EVOLUTION_INSTANCE);
    heldResponse?.setHeader("content-type", "application/json");
    heldResponse?.end(JSON.stringify({ key: { id: "provider-event-first" } }));
    await eventFirstPromise;
    const eventFirst = await countMessages(conversations[1]!);
    assert.equal(eventFirst.rows[0]?.count, 1);
    assert.equal(eventFirst.rows[0]?.origin, "portal_manual");
    assert.equal(eventFirst.rows[0]?.sent_by_user_id, user.rows[0]?.id);
  } finally {
    await new Promise<void>((resolve) => evolution.close(() => resolve()));
    await pool.query("DELETE FROM whatsapp_contacts WHERE id = ANY($1::uuid[])", [contacts]);
    env.EVOLUTION_API_URL = previous.evolutionUrl;
    env.EVOLUTION_API_KEY = previous.evolutionKey;
    env.EVOLUTION_INSTANCE = previous.instance;
    await pool.end();
  }
});
