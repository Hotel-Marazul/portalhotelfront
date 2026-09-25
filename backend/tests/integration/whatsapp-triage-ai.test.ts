import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { env } from "../../src/config/env.js";
import { pool } from "../../src/db/client.js";
import { initializeDatabase } from "../../src/db/init.js";
import { runTriageOnce } from "../../src/modules/whatsapp/triage.worker.js";

async function listen(server: Server) {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  return `http://127.0.0.1:${address.port}`;
}

async function createFixture(label: string) {
  const contactId = randomUUID();
  const conversationId = randomUUID();
  const messageId = randomUUID();
  const phone = `+5548${BigInt(`0x${randomUUID().replaceAll("-", "")}`) % 90_000_000n + 10_000_000n}`;
  await pool.query(
    `INSERT INTO whatsapp_contacts (id, remote_jid, phone_e164, push_name)
     VALUES ($1, $2, $3, $4)`,
    [contactId, `${phone.slice(1)}@s.whatsapp.net`, phone, label]
  );
  await pool.query(
    `INSERT INTO whatsapp_conversations
     (id, contact_id, awaiting_since, last_message_at, triage_status, triage_requested_at, triage_attempts)
     VALUES ($1, $2, NOW(), NOW(), 'pending', NOW() - INTERVAL '1 minute', 0)`,
    [conversationId, contactId]
  );
  await pool.query(
    `INSERT INTO whatsapp_messages
     (id, conversation_id, direction, origin, body, media_type, status, sent_at)
     VALUES ($1, $2, 'inbound', 'guest', $3, 'text', 'received', NOW() - INTERVAL '2 seconds')`,
    [messageId, conversationId, `Mensagem inicial ${label}`]
  );
  return { contactId, conversationId, messageId };
}

test("worker reprocessa uma nova mensagem e falha três vezes com fallback final", async () => {
  await initializeDatabase();
  const previous = {
    enabled: env.WHATSAPP_AI_ENABLED,
    agentsUrl: env.AGENTS_API_URL,
    agentsKey: env.AGENTS_API_KEY,
    dailyLimit: env.WHATSAPP_AI_DAILY_LIMIT
  };
  env.WHATSAPP_AI_ENABLED = true;
  env.AGENTS_API_KEY = "fixture-agent-key";
  env.WHATSAPP_AI_DAILY_LIMIT = 1000;
  let mode: "hold" | "ok" | "fail" = "hold";
  let releaseHeldResponse!: () => void;
  let requestSeen!: () => void;
  const heldResponse = new Promise<void>((resolve) => { releaseHeldResponse = resolve; });
  const firstRequest = new Promise<void>((resolve) => { requestSeen = resolve; });
  let callCount = 0;
  const server = createServer(async (request, response) => {
    if (request.url !== "/whatsapp/triage") {
      response.writeHead(404).end();
      return;
    }
    let body = "";
    for await (const chunk of request) body += chunk;
    callCount += 1;
    const isHeldFixture = body.includes("Triage pending fixture");
    if (isHeldFixture) requestSeen();
    if (mode === "hold" && isHeldFixture) await heldResponse;
    if (mode === "fail") {
      response.writeHead(500).end("fixture failure");
      return;
    }
    response.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({
      intent: "preco",
      childrenAges: [],
      requests: [],
      missingFields: [],
      headline: "Pergunta de preço",
      markerText: "IA leu: pergunta de preço"
    }));
  });
  const contactIds: string[] = [];
  try {
    env.AGENTS_API_URL = await listen(server);
    const changed = await createFixture("Triage pending fixture");
    contactIds.push(changed.contactId);
    await pool.query(
      "UPDATE whatsapp_conversations SET triage_requested_at = NOW() - INTERVAL '100 years' WHERE id = $1",
      [changed.conversationId]
    );
    const running = runTriageOnce(1);
    await firstRequest;
    await pool.query(
      `INSERT INTO whatsapp_messages
       (id, conversation_id, direction, origin, body, media_type, status, sent_at)
       VALUES ($1, $2, 'inbound', 'guest', 'Mensagem mais recente', 'text', 'received', NOW())`,
      [randomUUID(), changed.conversationId]
    );
    await pool.query(
      "UPDATE whatsapp_conversations SET triage_requested_at = NOW() WHERE id = $1",
      [changed.conversationId]
    );
    mode = "ok";
    releaseHeldResponse();
    await running;
    const changedState = await pool.query<{ triage_status: string; triage_attempts: number }>(
      "SELECT triage_status, triage_attempts FROM whatsapp_conversations WHERE id = $1",
      [changed.conversationId]
    );
    assert.equal(changedState.rows[0]?.triage_status, "pending");
    assert.equal(changedState.rows[0]?.triage_attempts, 0);

    const failing = await createFixture("Triage retry fixture");
    contactIds.push(failing.contactId);
    mode = "fail";
    for (let attempt = 0; attempt < 3; attempt += 1) {
      await pool.query(
        `UPDATE whatsapp_conversations
         SET triage_status = 'pending', triage_requested_at = NOW() - INTERVAL '1 minute'
         WHERE id = $1`,
        [failing.conversationId]
      );
      await runTriageOnce(1);
    }
    const failedState = await pool.query<{ triage_status: string; triage_attempts: number; current_reading_id: string }>(
      "SELECT triage_status, triage_attempts, current_reading_id FROM whatsapp_conversations WHERE id = $1",
      [failing.conversationId]
    );
    assert.equal(failedState.rows[0]?.triage_status, "failed");
    assert.equal(failedState.rows[0]?.triage_attempts, 0);
    const fallback = await pool.query<{ model: string; headline: string }>(
      "SELECT model, headline FROM whatsapp_ai_readings WHERE id = $1",
      [failedState.rows[0]?.current_reading_id]
    );
    assert.deepEqual(fallback.rows[0], { model: "fallback", headline: "Sem leitura da IA" });
    assert.equal(callCount, 4);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    if (contactIds.length) await pool.query("DELETE FROM whatsapp_contacts WHERE id = ANY($1::uuid[])", [contactIds]);
    env.WHATSAPP_AI_ENABLED = previous.enabled;
    env.AGENTS_API_URL = previous.agentsUrl;
    env.AGENTS_API_KEY = previous.agentsKey;
    env.WHATSAPP_AI_DAILY_LIMIT = previous.dailyLimit;
    await pool.end();
  }
});
