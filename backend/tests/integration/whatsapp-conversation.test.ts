import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import type { Server } from "node:http";
import test from "node:test";
import { createApp } from "../../src/app.js";
import { env } from "../../src/config/env.js";
import { pool } from "../../src/db/client.js";
import { initializeDatabase } from "../../src/db/init.js";
import { ingestWebhookPayload } from "../../src/modules/whatsapp/ingestion.service.js";
import { signAccessToken } from "../../src/utils/jwt.js";

const inbound = JSON.parse(readFileSync("tests/fixtures/whatsapp/messages-upsert-inbound-text.json", "utf8"));

test("detalhe mascara CPF, pagina a linha do tempo e reabre após dispensar", async () => {
  await initializeDatabase();
  const previousWhatsappEnabled = env.WHATSAPP_ENABLED;
  env.WHATSAPP_ENABLED = true;

  const clientId = randomUUID();
  const contactId = randomUUID();
  const conversationId = randomUUID();
  const episodeId = randomUUID();
  const readingId = randomUUID();
  const phone = "+5548991234567";
  const remoteJid = `${phone.slice(1)}@s.whatsapp.net`;
  const messageIds: string[] = [];
  const markerMessageIndex = 180;

  const admin = await pool.query<{ id: string; email: string; role: "admin" | "receptionist" }>(
    "SELECT id, email, role FROM users WHERE role = 'admin' ORDER BY created_at ASC LIMIT 1"
  );
  assert.ok(admin.rows[0]);
  const app = createApp();
  const server = await new Promise<Server>((resolve) => {
    const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
  });
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const authorization = `Bearer ${signAccessToken(admin.rows[0])}`;
  const request = (path: string, init: RequestInit = {}) => fetch(`http://127.0.0.1:${address.port}${path}`, {
    ...init,
    headers: { Authorization: authorization, "Content-Type": "application/json", ...init.headers }
  });

  try {
    await pool.query(
      `INSERT INTO clients (id, full_name, cpf, email, fone, fone_e164, automovel, placa)
       VALUES ($1, 'Hóspede Conversa Fixture', '98765432100', $2, $3, $3, '', '')`,
      [clientId, `conversation-${clientId}@example.test`, phone]
    );
    await pool.query(
      `INSERT INTO whatsapp_contacts (id, remote_jid, phone_e164, push_name, client_id)
       VALUES ($1, $2, $3, 'Nome WhatsApp', $4)`,
      [contactId, remoteJid, phone, clientId]
    );
    await pool.query(
      `INSERT INTO whatsapp_conversations
       (id, contact_id, awaiting_since, last_message_at, unread_count, base_score, score_reasons, triage_status)
       VALUES ($1, $2, NOW() - INTERVAL '1 hour', NOW() - INTERVAL '1 hour', 3, 45, $3::jsonb, 'done')`,
      [conversationId, contactId, JSON.stringify([{ text: "Pedido de reserva", weight: 40 }])]
    );
    await pool.query(
      `INSERT INTO whatsapp_episodes (id, conversation_id, started_at, first_level)
       VALUES ($1, $2, NOW() - INTERVAL '1 hour', 'hoje')`,
      [episodeId, conversationId]
    );
    await pool.query("UPDATE whatsapp_conversations SET current_episode_id = $1 WHERE id = $2", [episodeId, conversationId]);

    for (let index = 0; index < 200; index += 1) {
      const id = randomUUID();
      messageIds.push(id);
      const inboundMessage = index % 2 === 0;
      await pool.query(
        `INSERT INTO whatsapp_messages
         (id, conversation_id, episode_id, direction, origin, body, status, sent_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW() - ($8::int * INTERVAL '1 hour'))`,
        [
          id,
          conversationId,
          episodeId,
          inboundMessage ? "inbound" : "outbound",
          inboundMessage ? "guest" : "portal_manual",
          `mensagem-${index}`,
          inboundMessage ? "received" : "sent",
          200 - index
        ]
      );
    }
    await pool.query(
      `INSERT INTO whatsapp_ai_readings
       (id, conversation_id, episode_id, last_message_id, intent, headline, marker_text,
        signals, facts, base_score, level, reasons, model)
       VALUES ($1, $2, $3, $4, 'reserva_nova', 'Leitura fixture', 'IA leu: leitura fixture',
               '{}', '{}', 45, 'hoje', '[]', 'fixture')`,
      [readingId, conversationId, episodeId, messageIds[markerMessageIndex]]
    );
    await pool.query("UPDATE whatsapp_conversations SET current_reading_id = $1 WHERE id = $2", [readingId, conversationId]);

    const detailResponse = await request(`/api/whatsapp/conversations/${conversationId}`);
    assert.equal(detailResponse.status, 200);
    const detail = await detailResponse.json() as Record<string, unknown> & {
      guest?: { maskedCpf?: string; fullName?: string };
      isFirstOutbound?: boolean;
      privacyNotice?: string;
    };
    assert.equal(detail.guest?.fullName, "Hóspede Conversa Fixture");
    assert.equal(detail.guest?.maskedCpf, "***.***.***-00");
    assert.equal(detail.isFirstOutbound, false);
    assert.equal(typeof detail.privacyNotice, "string");
    assert.doesNotMatch(JSON.stringify(detail), /98765432100/);
    assert.doesNotMatch(JSON.stringify(detail), /total_price|payments|balanceDue/);

    const firstPageResponse = await request(`/api/whatsapp/conversations/${conversationId}/messages?limit=50`);
    assert.equal(firstPageResponse.status, 200);
    const firstPage = await firstPageResponse.json() as {
      items: Array<{ kind: string; id?: string; readingId?: string }>;
      hasMore: boolean;
    };
    const firstPageMessages = firstPage.items.filter((item) => item.kind === "message");
    assert.equal(firstPageMessages.length, 50);
    assert.equal(firstPage.hasMore, true);
    assert.ok(firstPage.items.some((item) => item.kind === "ai_marker" && item.readingId === readingId));
    const oldestOnFirstPage = firstPageMessages[0]?.id;
    assert.ok(oldestOnFirstPage);

    const beforeResponse = await request(
      `/api/whatsapp/conversations/${conversationId}/messages?before=${oldestOnFirstPage}&limit=50`
    );
    const beforeRaw = await beforeResponse.text();
    assert.equal(beforeResponse.status, 200, beforeRaw);
    const before = JSON.parse(beforeRaw) as {
      items: Array<{ kind: string; id?: string }>;
      hasMore: boolean;
    };
    const beforeMessages = before.items.filter((item) => item.kind === "message").map((item) => item.id);
    assert.equal(beforeMessages.length, 50);
    assert.equal(new Set([...firstPageMessages.map((item) => item.id), ...beforeMessages]).size, 100);
    assert.equal(before.hasMore, true);

    const afterResponse = await request(
      `/api/whatsapp/conversations/${conversationId}/messages?after=${oldestOnFirstPage}&limit=50`
    );
    assert.equal(afterResponse.status, 200);
    const after = await afterResponse.json() as { items: Array<{ kind: string; id?: string }>; hasMore: boolean };
    assert.equal(after.items.filter((item) => item.kind === "message").length, 49);
    assert.equal(after.hasMore, false);
    assert.ok(after.items.some((item) => item.kind === "day"));

    const readResponse = await request(`/api/whatsapp/conversations/${conversationId}/read`, { method: "POST" });
    assert.equal(readResponse.status, 204);
    const readCount = await pool.query<{ unread_count: number }>(
      "SELECT unread_count FROM whatsapp_conversations WHERE id = $1",
      [conversationId]
    );
    assert.equal(readCount.rows[0]?.unread_count, 0);

    const dismissResponse = await request(`/api/whatsapp/conversations/${conversationId}/dismiss`, { method: "POST" });
    assert.equal(dismissResponse.status, 204);
    const dismissed = await pool.query<{ awaiting_since: string | null }>(
      "SELECT awaiting_since::text FROM whatsapp_conversations WHERE id = $1",
      [conversationId]
    );
    assert.equal(dismissed.rows[0]?.awaiting_since, null);

    await ingestWebhookPayload({
      ...inbound,
      instance: "Marazul",
      data: {
        ...inbound.data,
        key: { ...inbound.data.key, remoteJid, id: `reopen-${randomUUID()}` },
        messageTimestamp: Math.floor(Date.now() / 1000) + 1,
        pushName: "Nome WhatsApp"
      }
    }, "Marazul");
    const reopened = await pool.query<{ awaiting_since: string | null; unread_count: number }>(
      "SELECT awaiting_since::text, unread_count FROM whatsapp_conversations WHERE id = $1",
      [conversationId]
    );
    assert.ok(reopened.rows[0]?.awaiting_since);
    assert.equal(reopened.rows[0]?.unread_count, 1);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await pool.query("DELETE FROM whatsapp_contacts WHERE id = $1", [contactId]);
    await pool.query("DELETE FROM clients WHERE id = $1", [clientId]);
    env.WHATSAPP_ENABLED = previousWhatsappEnabled;
    await pool.end();
  }
});
