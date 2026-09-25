import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createServer, type Server } from "node:http";
import test from "node:test";
import { createApp } from "../../src/app.js";
import { env } from "../../src/config/env.js";
import { pool } from "../../src/db/client.js";
import { initializeDatabase } from "../../src/db/init.js";
import { ingestWebhookPayload } from "../../src/modules/whatsapp/ingestion.service.js";
import { sendMessage } from "../../src/modules/whatsapp/outbound.service.js";
import { signAccessToken } from "../../src/utils/jwt.js";

function startServer(handler: Parameters<typeof createServer>[0]): Promise<Server> {
  return new Promise((resolve) => {
    const server = createServer(handler);
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

test("envio pelo portal é idempotente e bloqueia número desconectado", async () => {
  await initializeDatabase();
  const previous = {
    enabled: env.WHATSAPP_ENABLED,
    evolutionUrl: env.EVOLUTION_API_URL,
    evolutionKey: env.EVOLUTION_API_KEY,
    instance: env.EVOLUTION_INSTANCE
  };
  env.WHATSAPP_ENABLED = true;
  env.EVOLUTION_API_KEY = "e".repeat(16);
  env.EVOLUTION_INSTANCE = `outbound-${randomUUID()}`;

  let evolutionCalls = 0;
  let failNextEvolutionCall = false;
  const evolution = await startServer((_req, res) => {
    evolutionCalls += 1;
    if (failNextEvolutionCall) {
      failNextEvolutionCall = false;
      res.statusCode = 500;
      res.end();
      return;
    }
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ key: { id: `provider-${evolutionCalls}` } }));
  });
  const evolutionAddress = evolution.address();
  assert.ok(evolutionAddress && typeof evolutionAddress !== "string");
  env.EVOLUTION_API_URL = `http://127.0.0.1:${evolutionAddress.port}`;

  const contactIds = [randomUUID(), randomUUID()];
  const conversationIds = [randomUUID(), randomUUID()];
  const phone = "+5548998877665";
  const admin = await pool.query<{ id: string; email: string; role: "admin" | "receptionist" }>(
    "SELECT id, email, role FROM users WHERE role = 'admin' ORDER BY created_at ASC LIMIT 1"
  );
  assert.ok(admin.rows[0]);
  await pool.query(
    `INSERT INTO whatsapp_contacts (id, remote_jid, phone_e164, push_name)
     VALUES ($1, $3, $4, 'Envio A'), ($2, $5, $6, 'Envio B')`,
    [
      contactIds[0], contactIds[1], `${phone.slice(1)}@s.whatsapp.net`, phone,
      `5548998877666@s.whatsapp.net`, "+5548998877666"
    ]
  );
  await pool.query(
    "INSERT INTO whatsapp_conversations (id, contact_id) VALUES ($1, $3), ($2, $4)",
    [conversationIds[0], conversationIds[1], contactIds[0], contactIds[1]]
  );
  await pool.query(
    `INSERT INTO whatsapp_instances (id, name, connection_state, state_changed_at)
     VALUES ($1, $2, 'close', NOW())`,
    [randomUUID(), env.EVOLUTION_INSTANCE]
  );

  const app = createApp();
  const server = await startServer(app);
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const endpoint = `http://127.0.0.1:${address.port}/api`;
  const headers = {
    Authorization: `Bearer ${signAccessToken(admin.rows[0])}`,
    "Content-Type": "application/json"
  };
  const clientRequestId = randomUUID();
  const send = (conversationId: string, id = clientRequestId) => fetch(
    `${endpoint}/whatsapp/conversations/${conversationId}/messages`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({ text: "Mensagem de teste", clientRequestId: id, lastSeenMessageId: null })
    }
  );

  try {
    const beforeOutbound = await fetch(`${endpoint}/whatsapp/conversations/${conversationIds[0]}`, { headers });
    assert.equal(beforeOutbound.status, 200);
    assert.equal((await beforeOutbound.json() as { isFirstOutbound: boolean }).isFirstOutbound, true);

    const disconnected = await send(conversationIds[0]!);
    assert.equal(disconnected.status, 409);
    assert.equal((await disconnected.json() as { code: string }).code, "whatsapp_disconnected");
    assert.equal(evolutionCalls, 0);

    await pool.query(
      "UPDATE whatsapp_instances SET connection_state = 'open', state_changed_at = NOW() WHERE name = $1",
      [env.EVOLUTION_INSTANCE]
    );
    const created = await send(conversationIds[0]!);
    assert.equal(created.status, 201);
    const createdBody = await created.json() as { id: string; origin: string; status: string };
    assert.equal(createdBody.origin, "portal_manual");
    assert.equal(createdBody.status, "sent");
    assert.equal(evolutionCalls, 1);
    const afterOutbound = await fetch(`${endpoint}/whatsapp/conversations/${conversationIds[0]}`, { headers });
    assert.equal((await afterOutbound.json() as { isFirstOutbound: boolean }).isFirstOutbound, false);

    const replay = await send(conversationIds[0]!);
    assert.equal(replay.status, 200);
    assert.equal((await replay.json() as { id: string }).id, createdBody.id);
    assert.equal(evolutionCalls, 1);

    const conflict = await send(conversationIds[1]!);
    assert.equal(conflict.status, 409);
    assert.equal((await conflict.json() as { code: string }).code, "idempotency_conflict");

    await pool.query(
      `INSERT INTO whatsapp_messages
       (id, conversation_id, direction, origin, body, status, sent_at)
       VALUES ($1, $2, 'outbound', 'phone', 'Outra pessoa respondeu', 'sent', NOW() + INTERVAL '1 second')`,
      [randomUUID(), conversationIds[0]]
    );
    const changedRequestId = randomUUID();
    const changed = await fetch(`${endpoint}/whatsapp/conversations/${conversationIds[0]}/messages`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        text: "Mensagem após conflito",
        clientRequestId: changedRequestId,
        lastSeenMessageId: createdBody.id
      })
    });
    assert.equal(changed.status, 409);
    assert.equal((await changed.json() as { code: string }).code, "conversation_changed");

    const forced = await fetch(`${endpoint}/whatsapp/conversations/${conversationIds[0]}/messages`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        text: "Mensagem após conflito",
        clientRequestId: changedRequestId,
        lastSeenMessageId: createdBody.id,
        force: true
      })
    });
    assert.equal(forced.status, 201);
    assert.equal(evolutionCalls, 2);

    const replyToId = randomUUID();
    const suggestionId = randomUUID();
    await pool.query(
      `INSERT INTO whatsapp_messages (id, conversation_id, direction, origin, body, status, sent_at)
       VALUES ($1, $2, 'inbound', 'guest', 'Pedido para sugestão', 'received', NOW())`,
      [replyToId, conversationIds[0]]
    );
    await pool.query(
      `INSERT INTO whatsapp_reply_suggestions
       (id, conversation_id, reply_to_message_id, parts, text, basis, model)
       VALUES ($1, $2, $3, $4::jsonb, $5, $6, 'fixture')`,
      [suggestionId, conversationIds[0], replyToId,
        JSON.stringify([{ text: "Resposta sugerida", gap: false }]), "Resposta sugerida", ["fixture"]]
    );
    const suggestionUsed = await fetch(`${endpoint}/whatsapp/conversations/${conversationIds[0]}/messages`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        text: "Resposta   sugerida",
        clientRequestId: randomUUID(),
        suggestionId,
        force: true
      })
    });
    assert.equal(suggestionUsed.status, 201);
    assert.equal((await suggestionUsed.json() as { origin: string }).origin, "portal_suggestion");

    const gapReplyId = randomUUID();
    const gapSuggestionId = randomUUID();
    await pool.query(
      `INSERT INTO whatsapp_messages (id, conversation_id, direction, origin, body, status, sent_at)
       VALUES ($1, $2, 'inbound', 'guest', 'Pedido com lacuna', 'received', NOW())`,
      [gapReplyId, conversationIds[0]]
    );
    await pool.query(
      `INSERT INTO whatsapp_reply_suggestions
       (id, conversation_id, reply_to_message_id, parts, text, basis, model)
       VALUES ($1, $2, $3, $4::jsonb, $5, $6, 'fixture')`,
      [gapSuggestionId, conversationIds[0], gapReplyId,
        JSON.stringify([{ text: "[complete este trecho]", gap: true }]), "[complete este trecho]", ["fixture"]]
    );
    const unfilledGap = await fetch(`${endpoint}/whatsapp/conversations/${conversationIds[0]}/messages`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        text: "[complete este trecho]",
        clientRequestId: randomUUID(),
        suggestionId: gapSuggestionId,
        force: true
      })
    });
    assert.equal(unfilledGap.status, 422);
    assert.equal((await unfilledGap.json() as { code: string }).code, "unfilled_gap");

    const editedReplyId = randomUUID();
    const editedSuggestionId = randomUUID();
    await pool.query(
      `INSERT INTO whatsapp_messages (id, conversation_id, direction, origin, body, status, sent_at)
       VALUES ($1, $2, 'inbound', 'guest', 'Pedido editável', 'received', NOW())`,
      [editedReplyId, conversationIds[0]]
    );
    await pool.query(
      `INSERT INTO whatsapp_reply_suggestions
       (id, conversation_id, reply_to_message_id, parts, text, basis, model)
       VALUES ($1, $2, $3, $4::jsonb, $5, $6, 'fixture')`,
      [editedSuggestionId, conversationIds[0], editedReplyId,
        JSON.stringify([{ text: "Resposta para editar", gap: false }]), "Resposta para editar", ["fixture"]]
    );
    const editedSuggestion = await fetch(`${endpoint}/whatsapp/conversations/${conversationIds[0]}/messages`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        text: "Resposta para editar com complemento",
        clientRequestId: randomUUID(),
        suggestionId: editedSuggestionId,
        force: true
      })
    });
    assert.equal(editedSuggestion.status, 201);
    assert.equal((await editedSuggestion.json() as { origin: string }).origin, "portal_suggestion_edited");

    failNextEvolutionCall = true;
    const failedSend = await fetch(`${endpoint}/whatsapp/conversations/${conversationIds[0]}/messages`, {
      method: "POST",
      headers,
      body: JSON.stringify({ text: "Mensagem para reenviar", clientRequestId: randomUUID(), force: true })
    });
    assert.equal(failedSend.status, 502);
    const failed = await pool.query<{ id: string; status: string; failure_reason: string | null }>(
      `SELECT id, status, failure_reason FROM whatsapp_messages
       WHERE conversation_id = $1 AND body = 'Mensagem para reenviar'`,
      [conversationIds[0]]
    );
    assert.equal(failed.rows[0]?.status, "failed");
    assert.equal(failed.rows[0]?.failure_reason, "Evolution respondeu 500");
    const retried = await fetch(`${endpoint}/whatsapp/messages/${failed.rows[0]?.id}/retry`, {
      method: "POST",
      headers
    });
    assert.equal(retried.status, 201);

    const timeoutText = "Mensagem confirmada depois do timeout";
    const timeoutRequestId = randomUUID();
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => {
      throw Object.assign(new Error("timeout"), { name: "AbortError" });
    }) as typeof fetch;
    try {
      await assert.rejects(
        sendMessage({
          conversationId: conversationIds[0]!,
          userId: admin.rows[0]!.id,
          text: timeoutText,
          clientRequestId: timeoutRequestId,
          force: true
        }),
        (error: unknown) => (error as { code?: string }).code === "whatsapp_send_failed"
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
    const timedOut = await pool.query<{ id: string; status: string; failure_reason: string | null }>(
      "SELECT id, status, failure_reason FROM whatsapp_messages WHERE client_request_id = $1",
      [timeoutRequestId]
    );
    assert.equal(timedOut.rows[0]?.status, "failed");
    assert.equal(timedOut.rows[0]?.failure_reason, "Tempo esgotado");
    const timeoutProviderId = `timeout-${randomUUID()}`;
    await ingestWebhookPayload({
      event: "messages.upsert",
      instance: env.EVOLUTION_INSTANCE,
      data: {
        key: { remoteJid: `${phone.slice(1)}@s.whatsapp.net`, fromMe: true, id: timeoutProviderId },
        message: { conversation: timeoutText },
        messageTimestamp: Math.floor(Date.now() / 1000)
      }
    }, env.EVOLUTION_INSTANCE);
    const reconciledTimeout = await pool.query<{ id: string; status: string }>(
      "SELECT id, status FROM whatsapp_messages WHERE provider_message_id = $1",
      [timeoutProviderId]
    );
    assert.deepEqual(reconciledTimeout.rows[0], { id: timedOut.rows[0]?.id, status: "sent" });

    await ingestWebhookPayload({
      event: "messages.upsert",
      instance: env.EVOLUTION_INSTANCE,
      data: {
        key: { remoteJid: "5548998877666@s.whatsapp.net", fromMe: true, id: `phone-${randomUUID()}` },
        message: { conversation: "Resposta pelo celular" },
        messageTimestamp: Math.floor(Date.now() / 1000)
      }
    }, env.EVOLUTION_INSTANCE);
    const afterPhoneOutbound = await fetch(`${endpoint}/whatsapp/conversations/${conversationIds[1]}`, { headers });
    assert.equal((await afterPhoneOutbound.json() as { isFirstOutbound: boolean }).isFirstOutbound, false);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await new Promise<void>((resolve) => evolution.close(() => resolve()));
    await pool.query("DELETE FROM whatsapp_contacts WHERE id = ANY($1::uuid[])", [contactIds]);
    env.WHATSAPP_ENABLED = previous.enabled;
    env.EVOLUTION_API_URL = previous.evolutionUrl;
    env.EVOLUTION_API_KEY = previous.evolutionKey;
    env.EVOLUTION_INSTANCE = previous.instance;
    await pool.end();
  }
});
