import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { env } from "../../src/config/env.js";
import { pool } from "../../src/db/client.js";
import { initializeDatabase } from "../../src/db/init.js";
import { runLearningProposals } from "../../src/modules/whatsapp/proposals.job.js";
import { canonicalConditionKey, decideRule } from "../../src/modules/whatsapp/learning.service.js";

function phoneFor(index: number) {
  return `+554899880${String(index).padStart(4, "0")}`;
}

test("propostas por desfecho usam a base geral e exigem oito casos", async () => {
  await initializeDatabase();
  const previousEnabled = env.WHATSAPP_AI_ENABLED;
  env.WHATSAPP_AI_ENABLED = false;
  const contacts: string[] = [];
  const conditionKey = canonicalConditionKey({ has_dates: false, intent: "preco" });
  const db = await pool.connect();
  try {
    await db.query("ALTER TABLE whatsapp_ai_rule_events DISABLE TRIGGER whatsapp_ai_rule_events_append_only");
    await db.query("DELETE FROM whatsapp_ai_rule_events WHERE rule_id IN (SELECT id FROM whatsapp_ai_rules WHERE condition_key = $1)", [conditionKey]);
    await db.query("DELETE FROM whatsapp_ai_rules WHERE condition_key = $1", [conditionKey]);
    await db.query("ALTER TABLE whatsapp_ai_rule_events ENABLE TRIGGER whatsapp_ai_rule_events_append_only");
    await db.query("BEGIN");
    for (let index = 0; index < 30; index += 1) {
      const contactId = randomUUID();
      const conversationId = randomUUID();
      const episodeId = randomUUID();
      const messageId = randomUUID();
      const readingId = randomUUID();
      const phone = phoneFor(index);
      contacts.push(contactId);
      const matched = index < 8;
      const booked = index === 0 || (!matched && index < 19);
      const signals = matched
        ? { intent: "preco", has_dates: false, has_guest_count: false }
        : { intent: "reserva_nova", has_dates: true, has_guest_count: true };
      await db.query(
        `INSERT INTO whatsapp_contacts (id, remote_jid, phone_e164, push_name)
         VALUES ($1, $2, $3, $4)`,
        [contactId, `${phone.slice(1)}@s.whatsapp.net`, phone, `Proposta ${index}`]
      );
      await db.query("INSERT INTO whatsapp_conversations (id, contact_id) VALUES ($1, $2)", [conversationId, contactId]);
      await db.query(
        `INSERT INTO whatsapp_episodes (id, conversation_id, started_at, outcome, is_lead, first_level)
         VALUES ($1, $2, NOW() - INTERVAL '1 day', $3, TRUE, 'hoje')`,
        [episodeId, conversationId, booked ? "booked" : "not_booked"]
      );
      await db.query(
        `INSERT INTO whatsapp_messages (id, conversation_id, episode_id, direction, origin, body, status, sent_at)
         VALUES ($1, $2, $3, 'inbound', 'guest', 'mensagem fixture', 'received', NOW() - INTERVAL '1 day')`,
        [messageId, conversationId, episodeId]
      );
      await db.query(
        `INSERT INTO whatsapp_ai_readings
         (id, conversation_id, episode_id, last_message_id, intent, children_ages, requests, missing_fields,
          headline, marker_text, signals, facts, base_score, level, reasons, model)
         VALUES ($1, $2, $3, $4, $5, '{}', '{}', '{}', 'Fixture', 'IA leu: fixture', $6::jsonb,
                 '{}'::jsonb, 30, 'hoje', '[]'::jsonb, 'fixture')`,
        [readingId, conversationId, episodeId, messageId, signals.intent, JSON.stringify(signals)]
      );
      await db.query(
        "UPDATE whatsapp_conversations SET current_episode_id = $2, current_reading_id = $3 WHERE id = $1",
        [conversationId, episodeId, readingId]
      );
    }
    await db.query("COMMIT");

    const result = await runLearningProposals();
    assert.ok(result.created >= 1);
    const proposal = await pool.query<{ weight: number; evidence_text: string; condition: Record<string, unknown> }>(
      `SELECT weight, evidence_text, condition FROM whatsapp_ai_rules
       WHERE kind = 'queue' AND source = 'outcomes' AND condition @> '{"intent":"preco"}'::jsonb
       ORDER BY proposed_at DESC LIMIT 1`
    );
    assert.equal(proposal.rows[0]?.weight, -10);
    assert.match(proposal.rows[0]?.evidence_text ?? "", /De 8 atendimentos assim, 1 viraram reserva \(13%\), contra 40% no geral/);
    assert.deepEqual(proposal.rows[0]?.condition, { has_dates: false, intent: "preco" });
    const ids = await pool.query<{ id: string }>(
      "SELECT id FROM whatsapp_ai_rules WHERE source = 'outcomes' AND condition @> '{\"intent\":\"preco\"}'::jsonb"
    );
    assert.ok(ids.rows[0]?.id);
    assert.equal((await runLearningProposals()).created, 0);
    const admin = await pool.query<{ id: string }>("SELECT id FROM users WHERE role = 'admin' LIMIT 1");
    assert.ok(admin.rows[0]?.id);
    await decideRule(ids.rows[0].id, "ignore", admin.rows[0].id);
    assert.equal((await runLearningProposals()).created, 0);
  } finally {
    try { await db.query("ROLLBACK"); } catch { /* transaction already committed */ }
    db.release();
    await pool.query("ALTER TABLE whatsapp_ai_rule_events DISABLE TRIGGER whatsapp_ai_rule_events_append_only");
    await pool.query("DELETE FROM whatsapp_ai_rule_events WHERE rule_id IN (SELECT id FROM whatsapp_ai_rules WHERE condition_key = $1)", [conditionKey]);
    await pool.query("DELETE FROM whatsapp_ai_rules WHERE condition_key = $1", [conditionKey]);
    await pool.query("ALTER TABLE whatsapp_ai_rule_events ENABLE TRIGGER whatsapp_ai_rule_events_append_only");
    if (contacts.length) await pool.query("DELETE FROM whatsapp_contacts WHERE id = ANY($1::uuid[])", [contacts]);
    env.WHATSAPP_AI_ENABLED = previousEnabled;
    await pool.end();
  }
});
