import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { pool } from "../../src/db/client.js";
import { initializeDatabase } from "../../src/db/init.js";
import { closeIdleEpisodes } from "../../src/modules/whatsapp/jobs.js";
import { ingestWebhookPayload } from "../../src/modules/whatsapp/ingestion.service.js";

const inbound = JSON.parse(readFileSync("tests/fixtures/whatsapp/messages-upsert-inbound-text.json", "utf8"));

test("fecha atendimento ocioso e abre outro sem perder o desfecho", async () => {
  await initializeDatabase();
  const contactId = randomUUID();
  const conversationId = randomUUID();
  const oldEpisodeId = randomUUID();
  const phone = `55117777${String(Math.floor(Math.random() * 10000)).padStart(4, "0")}`;
  const remoteJid = `${phone}@s.whatsapp.net`;

  try {
    await pool.query(
      `INSERT INTO whatsapp_contacts (id, remote_jid, phone_e164, push_name)
       VALUES ($1, $2, $3, 'Episódio Fixture')`,
      [contactId, remoteJid, `+${phone}`]
    );
    await pool.query(
      `INSERT INTO whatsapp_conversations
       (id, contact_id, last_message_at, awaiting_since, unread_count, triage_status)
       VALUES ($1, $2, NOW() - INTERVAL '8 days', NOW() - INTERVAL '8 days', 3, 'pending')`,
      [conversationId, contactId]
    );
    await pool.query(
      `INSERT INTO whatsapp_episodes
       (id, conversation_id, started_at, outcome, is_lead, first_level)
       VALUES ($1, $2, NOW() - INTERVAL '8 days', 'booked', TRUE, 'hoje')`,
      [oldEpisodeId, conversationId]
    );
    await pool.query(
      "UPDATE whatsapp_conversations SET current_episode_id = $1 WHERE id = $2",
      [oldEpisodeId, conversationId]
    );

    await closeIdleEpisodes();

    const closed = await pool.query<{
      closed_at: string | null;
      close_reason: string | null;
      outcome: string | null;
    }>(
      "SELECT closed_at::text, close_reason, outcome FROM whatsapp_episodes WHERE id = $1",
      [oldEpisodeId]
    );
    assert.ok(closed.rows[0]?.closed_at);
    assert.equal(closed.rows[0]?.close_reason, "idle");
    assert.equal(closed.rows[0]?.outcome, "booked");

    const conversationAfterClose = await pool.query<{
      awaiting_since: string | null;
      unread_count: number;
      triage_status: string;
    }>(
      "SELECT awaiting_since::text, unread_count, triage_status FROM whatsapp_conversations WHERE id = $1",
      [conversationId]
    );
    assert.equal(conversationAfterClose.rows[0]?.awaiting_since, null);
    assert.equal(conversationAfterClose.rows[0]?.unread_count, 0);
    assert.equal(conversationAfterClose.rows[0]?.triage_status, "idle");

    await ingestWebhookPayload({
      ...inbound,
      instance: "Marazul",
      data: {
        ...inbound.data,
        key: { ...inbound.data.key, remoteJid, id: `episode-${randomUUID()}` },
        pushName: "Episódio Fixture"
      }
    }, "Marazul");

    const episodes = await pool.query<{
      id: string;
      closed_at: string | null;
      outcome: string | null;
    }>(
      `SELECT id, closed_at::text, outcome
       FROM whatsapp_episodes WHERE conversation_id = $1 ORDER BY started_at`,
      [conversationId]
    );
    assert.equal(episodes.rows.length, 2);
    assert.equal(episodes.rows[0]?.id, oldEpisodeId);
    assert.equal(episodes.rows[0]?.outcome, "booked");
    assert.ok(episodes.rows[0]?.closed_at);
    assert.equal(episodes.rows[1]?.closed_at, null);
    assert.equal(episodes.rows[1]?.outcome, null);
  } finally {
    await pool.query("DELETE FROM whatsapp_contacts WHERE id = $1", [contactId]);
    await pool.end();
  }
});
