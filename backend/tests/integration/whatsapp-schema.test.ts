import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { pool } from "../../src/db/client.js";
import { initializeDatabase } from "../../src/db/init.js";

test("schema do WhatsApp é idempotente e o histórico de regras é append-only", async () => {
  await initializeDatabase();
  await initializeDatabase();

  const tableNames = [
    "whatsapp_instances",
    "whatsapp_webhook_events",
    "whatsapp_contacts",
    "whatsapp_conversations",
    "whatsapp_episodes",
    "whatsapp_messages",
    "whatsapp_ai_readings",
    "whatsapp_reply_suggestions",
    "whatsapp_priority_feedback",
    "whatsapp_ai_rules",
    "whatsapp_ai_rule_events",
    "whatsapp_ai_daily_usage",
    "whatsapp_job_runs"
  ];
  const tables = await pool.query<{ table_name: string }>(
    `SELECT table_name
     FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = ANY($1::text[])`,
    [tableNames]
  );
  assert.deepEqual(new Set(tables.rows.map((row) => row.table_name)), new Set(tableNames));

  const indexes = await pool.query<{ indexname: string }>(
    `SELECT indexname
     FROM pg_indexes
     WHERE schemaname = 'public'
       AND indexname = ANY($1::text[])`,
    [[
      "whatsapp_messages_provider_id_key",
      "whatsapp_messages_client_request_key",
      "whatsapp_reply_suggestions_live",
      "whatsapp_ai_rules_live_key",
      "whatsapp_episodes_one_open"
    ]]
  );
  assert.equal(indexes.rows.length, 5);

  const ruleId = randomUUID();
  const eventId = randomUUID();
  await pool.query(
    `INSERT INTO whatsapp_ai_rules
      (id, kind, status, title, condition, weight, condition_key, source, evidence, evidence_text)
     VALUES ($1, 'queue', 'proposed', 'Fixture de schema', $2::jsonb, 10, $3, 'outcomes', $4::jsonb, 'Fixture')`,
    [ruleId, JSON.stringify({ intent: "preco" }), `schema-${ruleId}`, JSON.stringify({ total: 8 })]
  );
  await pool.query(
    `INSERT INTO whatsapp_ai_rule_events (id, rule_id, action)
     VALUES ($1, $2, 'proposed')`,
    [eventId, ruleId]
  );

  try {
    await assert.rejects(
      pool.query(`UPDATE whatsapp_ai_rule_events SET action = 'accepted' WHERE id = $1`, [eventId]),
      /append-only/
    );
    await assert.rejects(
      pool.query(`DELETE FROM whatsapp_ai_rule_events WHERE id = $1`, [eventId]),
      /append-only/
    );
  } finally {
    await pool.query("ALTER TABLE whatsapp_ai_rule_events DISABLE TRIGGER whatsapp_ai_rule_events_append_only");
    await pool.query("DELETE FROM whatsapp_ai_rule_events WHERE id = $1", [eventId]);
    await pool.query("ALTER TABLE whatsapp_ai_rule_events ENABLE TRIGGER whatsapp_ai_rule_events_append_only");
    await pool.query("DELETE FROM whatsapp_ai_rules WHERE id = $1", [ruleId]);
    await pool.end();
  }
});
