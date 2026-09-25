import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { env } from "../../src/config/env.js";
import { pool } from "../../src/db/client.js";
import { initializeDatabase } from "../../src/db/init.js";
import { canonicalConditionKey } from "../../src/modules/whatsapp/learning.service.js";
import { runLearningProposals } from "../../src/modules/whatsapp/proposals.job.js";

test("proposta de correção exige três feedbacks na mesma direção", async () => {
  await initializeDatabase();
  const previousEnabled = env.WHATSAPP_AI_ENABLED;
  env.WHATSAPP_AI_ENABLED = false;
  const condition = { has_dates: false, intent: "preco" };
  const conditionKey = canonicalConditionKey(condition);
  const contacts: string[] = [];
  const db = await pool.connect();
  let ruleIds: string[] = [];
  try {
    await db.query("BEGIN");
    const user = await db.query<{ id: string }>("SELECT id FROM users WHERE role = 'admin' LIMIT 1");
    assert.ok(user.rows[0]?.id);
    for (let index = 0; index < 3; index += 1) {
      const contactId = randomUUID();
      const conversationId = randomUUID();
      const messageId = randomUUID();
      const readingId = randomUUID();
      contacts.push(contactId);
      const phone = `+55489977${String(index).padStart(6, "0")}`;
      await db.query(
        `INSERT INTO whatsapp_contacts (id, remote_jid, phone_e164, push_name)
         VALUES ($1, $2, $3, 'Carla')`,
        [contactId, `${phone.slice(1)}@s.whatsapp.net`, phone]
      );
      await db.query("INSERT INTO whatsapp_conversations (id, contact_id) VALUES ($1, $2)", [conversationId, contactId]);
      await db.query(
        `INSERT INTO whatsapp_messages
         (id, conversation_id, direction, origin, body, media_type, status, sent_at)
         VALUES ($1, $2, 'inbound', 'guest', 'Preciso saber o preço', 'text', 'received', NOW())`,
        [messageId, conversationId]
      );
      await db.query(
        `INSERT INTO whatsapp_ai_readings
         (id, conversation_id, last_message_id, intent, children_ages, requests, missing_fields,
          headline, marker_text, signals, facts, base_score, level, reasons, model)
         VALUES ($1, $2, $3, 'preco', '{}', '{}', '{}', 'Fixture', 'IA leu: fixture', $4::jsonb,
                 '{}'::jsonb, 30, 'hoje', '[]'::jsonb, 'fixture')`,
        [readingId, conversationId, messageId, JSON.stringify(condition)]
      );
      await db.query(
        `INSERT INTO whatsapp_priority_feedback
         (id, conversation_id, reading_id, verdict, level_at_feedback, position_at_feedback, user_id)
         VALUES ($1, $2, $3, 'should_be_lower', 'hoje', 1, $4)`,
        [randomUUID(), conversationId, readingId, user.rows[0].id]
      );
    }
    await db.query("COMMIT");

    await db.query("ALTER TABLE whatsapp_ai_rule_events DISABLE TRIGGER whatsapp_ai_rule_events_append_only");
    await db.query("DELETE FROM whatsapp_ai_rule_events WHERE rule_id IN (SELECT id FROM whatsapp_ai_rules WHERE condition_key = $1)", [conditionKey]);
    await db.query("DELETE FROM whatsapp_ai_rules WHERE condition_key = $1", [conditionKey]);
    await db.query("ALTER TABLE whatsapp_ai_rule_events ENABLE TRIGGER whatsapp_ai_rule_events_append_only");

    const result = await runLearningProposals();
    assert.ok(result.created >= 1);
    const proposal = await pool.query<{ weight: number; evidence_text: string }>(
      "SELECT weight, evidence_text FROM whatsapp_ai_rules WHERE source = 'corrections' AND condition_key = $1",
      [conditionKey]
    );
    assert.equal(proposal.rows[0]?.weight, -10);
    assert.equal(proposal.rows[0]?.evidence_text, "Corrigido para baixo 3 vezes por Carla.");
    const ids = await pool.query<{ id: string }>(
      "SELECT id FROM whatsapp_ai_rules WHERE source = 'corrections' AND condition_key = $1",
      [conditionKey]
    );
    ruleIds = ids.rows.map((row) => row.id);
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
