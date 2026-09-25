import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { createApp } from "../../src/app.js";
import { env } from "../../src/config/env.js";
import { pool } from "../../src/db/client.js";
import { initializeDatabase } from "../../src/db/init.js";
import { canonicalConditionKey } from "../../src/modules/whatsapp/learning.service.js";
import { signAccessToken } from "../../src/utils/jwt.js";

function roomNumber() {
  return Number((BigInt(`0x${randomUUID().replaceAll("-", "")}`) % 90_000_000n + 10_000_000n).toString());
}

test("desfecho, correção de prioridade e decisões de regra respeitam papel e estado", async () => {
  await initializeDatabase();
  const previousEnabled = env.WHATSAPP_ENABLED;
  env.WHATSAPP_ENABLED = true;
  const contactId = randomUUID();
  const conversationId = randomUUID();
  const episodeId = randomUUID();
  const readingId = randomUUID();
  const messageId = randomUUID();
  const ruleId = randomUUID();
  const ignoredRuleId = randomUUID();
  const phone = `+5548${String(roomNumber()).slice(-8)}`;
  const users = await pool.query<{ id: string; email: string; role: "admin" | "receptionist" }>(
    "SELECT id, email, role FROM users WHERE role IN ('admin', 'receptionist') ORDER BY role"
  );
  const admin = users.rows.find((user) => user.role === "admin");
  const receptionist = users.rows.find((user) => user.role === "receptionist");
  assert.ok(admin);
  assert.ok(receptionist);

  await pool.query(
    `INSERT INTO whatsapp_contacts (id, remote_jid, phone_e164, push_name)
     VALUES ($1, $2, $3, 'Aprendizado Fixture')`,
    [contactId, `${phone.slice(1)}@s.whatsapp.net`, phone]
  );
  await pool.query(
    `INSERT INTO whatsapp_conversations
     (id, contact_id, awaiting_since, last_message_at, base_score, score_reasons, triage_status)
     VALUES ($1, $2, NOW(), NOW(), 40, $3::jsonb, 'done')`,
    [conversationId, contactId, JSON.stringify([{ text: "Pedido de reserva", weight: 40 }])]
  );
  await pool.query(
    `INSERT INTO whatsapp_episodes
     (id, conversation_id, started_at, is_lead, first_level)
     VALUES ($1, $2, NOW(), TRUE, 'hoje')`,
    [episodeId, conversationId]
  );
  await pool.query(
    `INSERT INTO whatsapp_messages
     (id, conversation_id, episode_id, direction, origin, body, status, sent_at)
     VALUES ($1, $2, $3, 'inbound', 'guest', 'Quero reservar', 'received', NOW())`,
    [messageId, conversationId, episodeId]
  );
  await pool.query(
    `INSERT INTO whatsapp_ai_readings
     (id, conversation_id, episode_id, last_message_id, intent, children_ages, requests,
      missing_fields, headline, marker_text, signals, facts, base_score, level, reasons, model)
     VALUES ($1, $2, $3, $4, 'preco', '{}', '{}', '{}', 'Pergunta de preço', 'IA leu: preço',
             $5::jsonb, '{}'::jsonb, 40, 'hoje', $6::jsonb, 'fixture')`,
    [readingId, conversationId, episodeId, messageId,
      JSON.stringify({ intent: "preco", has_dates: false, has_guest_count: false, is_supplier: false, unknown_contact: false }),
      JSON.stringify([{ text: "Pergunta de preço", weight: 30 }])]
  );
  await pool.query(
    `UPDATE whatsapp_conversations
     SET current_episode_id = $2, current_reading_id = $3
     WHERE id = $1`,
    [conversationId, episodeId, readingId]
  );
  await pool.query(
    `INSERT INTO whatsapp_ai_rules
     (id, kind, status, title, condition, weight, condition_key, source, evidence, evidence_text)
     VALUES ($1, 'queue', 'proposed', 'Pergunta sem datas', $2::jsonb, 10, $3, 'corrections', '{}'::jsonb, 'Fixture')`,
    [ruleId, JSON.stringify({ intent: "preco", has_dates: false, is_supplier: false, unknown_contact: false }), canonicalConditionKey({ intent: "preco", has_dates: false, is_supplier: false, unknown_contact: false })]
  );
  await pool.query(
    `INSERT INTO whatsapp_ai_rules
     (id, kind, status, title, condition, weight, condition_key, source, evidence, evidence_text)
     VALUES ($1, 'queue', 'proposed', 'Contato desconhecido', $2::jsonb, -10, $3, 'corrections', '{}'::jsonb, 'Fixture')`,
    [ignoredRuleId, JSON.stringify({ unknown_contact: true }), canonicalConditionKey({ unknown_contact: true })]
  );

  const app = createApp();
  const server = await new Promise<import("node:http").Server>((resolve) => {
    const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
  });
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const endpoint = `http://127.0.0.1:${address.port}/api`;
  const headers = (user: { id: string; email: string; role: "admin" | "receptionist" }) => ({
    Authorization: `Bearer ${signAccessToken(user)}`,
    "Content-Type": "application/json"
  });

  try {
    const outcome = await fetch(`${endpoint}/whatsapp/conversations/${conversationId}/outcome`, {
      method: "PUT", headers: headers(admin), body: JSON.stringify({ outcome: "booked" })
    });
    assert.equal(outcome.status, 200);
    assert.deepEqual(await outcome.json(), { episodeId, outcome: "booked" });

    const reopen = await fetch(`${endpoint}/whatsapp/conversations/${conversationId}/outcome`, {
      method: "PUT", headers: headers(admin), body: JSON.stringify({ outcome: null })
    });
    assert.equal(reopen.status, 200);
    assert.deepEqual(await reopen.json(), { episodeId, outcome: null });
    await pool.query("UPDATE whatsapp_conversations SET awaiting_since = NOW() WHERE id = $1", [conversationId]);

    const feedback = await fetch(`${endpoint}/whatsapp/conversations/${conversationId}/priority-feedback`, {
      method: "POST", headers: headers(admin), body: JSON.stringify({ verdict: "should_be_higher" })
    });
    assert.equal(feedback.status, 201);
    const duplicateFeedback = await fetch(`${endpoint}/whatsapp/conversations/${conversationId}/priority-feedback`, {
      method: "POST", headers: headers(admin), body: JSON.stringify({ verdict: "should_be_higher" })
    });
    assert.equal(duplicateFeedback.status, 409);
    const removedFeedback = await fetch(`${endpoint}/whatsapp/conversations/${conversationId}/priority-feedback`, {
      method: "DELETE", headers: headers(admin)
    });
    assert.equal(removedFeedback.status, 204);

    const receptionistRule = await fetch(`${endpoint}/whatsapp/learning/rules/${ruleId}/accept`, {
      method: "POST", headers: headers(receptionist)
    });
    assert.equal(receptionistRule.status, 403);
    const accepted = await fetch(`${endpoint}/whatsapp/learning/rules/${ruleId}/accept`, {
      method: "POST", headers: headers(admin)
    });
    assert.equal(accepted.status, 200);
    assert.equal((await accepted.json() as { status: string }).status, "active");
    const scoreAfterAccept = await pool.query<{ base_score: number }>(
      "SELECT base_score FROM whatsapp_conversations WHERE id = $1", [conversationId]
    );
    assert.equal(scoreAfterAccept.rows[0]?.base_score, 40);
    const event = await pool.query<{ action: string }>(
      "SELECT action FROM whatsapp_ai_rule_events WHERE rule_id = $1 ORDER BY created_at DESC LIMIT 1",
      [ruleId]
    );
    assert.equal(event.rows[0]?.action, "accepted");
    const repeatedAccept = await fetch(`${endpoint}/whatsapp/learning/rules/${ruleId}/accept`, {
      method: "POST", headers: headers(admin)
    });
    assert.equal(repeatedAccept.status, 409);
    const reverted = await fetch(`${endpoint}/whatsapp/learning/rules/${ruleId}/revert`, {
      method: "POST", headers: headers(admin)
    });
    assert.equal(reverted.status, 200);
    const revertedEvent = await pool.query<{ action: string }>(
      "SELECT action FROM whatsapp_ai_rule_events WHERE rule_id = $1 ORDER BY created_at DESC LIMIT 1",
      [ruleId]
    );
    assert.equal(revertedEvent.rows[0]?.action, "reverted");
    const ignored = await fetch(`${endpoint}/whatsapp/learning/rules/${ignoredRuleId}/ignore`, {
      method: "POST", headers: headers(admin)
    });
    assert.equal(ignored.status, 200);
    const ignoredEvent = await pool.query<{ action: string }>(
      "SELECT action FROM whatsapp_ai_rule_events WHERE rule_id = $1 ORDER BY created_at DESC LIMIT 1",
      [ignoredRuleId]
    );
    assert.equal(ignoredEvent.rows[0]?.action, "ignored");

    const rules = await fetch(`${endpoint}/whatsapp/learning/rules`, { headers: headers(receptionist) });
    assert.equal(rules.status, 200);
    assert.equal((await rules.json() as { active: Array<{ id: string }> }).active.some((rule) => rule.id === ruleId), false);
    const summary = await fetch(`${endpoint}/whatsapp/learning/summary?period=7d`, { headers: headers(receptionist) });
    assert.equal(summary.status, 200);
    const summaryBody = await summary.json() as { leads: { total: number; booked: number; noOutcome: number }; corrections: number };
    const expectedSummary = await pool.query<{ total: number; booked: number; no_outcome: number }>(
      `SELECT COUNT(*)::int AS total,
              COUNT(*) FILTER (WHERE is_lead AND outcome = 'booked')::int AS booked,
              COUNT(*) FILTER (WHERE is_lead AND outcome IS NULL)::int AS no_outcome
       FROM whatsapp_episodes WHERE started_at >= NOW() - INTERVAL '7 days'`
    );
    assert.equal(summaryBody.leads.total, expectedSummary.rows[0]?.total);
    assert.equal(summaryBody.leads.booked, expectedSummary.rows[0]?.booked);
    assert.equal(summaryBody.leads.noOutcome, expectedSummary.rows[0]?.no_outcome);
    const expectedCorrections = await pool.query<{ count: number }>(
      "SELECT COUNT(*)::int AS count FROM whatsapp_priority_feedback WHERE verdict <> 'correct' AND created_at >= NOW() - INTERVAL '7 days'"
    );
    assert.equal(summaryBody.corrections, expectedCorrections.rows[0]?.count);
    const corrections = await fetch(`${endpoint}/whatsapp/learning/corrections?page=1`, { headers: headers(receptionist) });
    assert.equal(corrections.status, 200);

    await pool.query("UPDATE whatsapp_episodes SET started_at = NOW() - INTERVAL '8 days' WHERE id = $1", [episodeId]);
    const emptySummary = await fetch(`${endpoint}/whatsapp/learning/summary?period=7d`, { headers: headers(receptionist) });
    assert.equal(emptySummary.status, 200);
    const emptySummaryBody = await emptySummary.json() as {
      period: string;
      readings: { conversations: number; contacts: number };
      leads: { total: number; booked: number; bookedPercent: number; noOutcome: number };
      suggestions: { created: number; edited: number; used: number; dismissed: number; unused: number };
      corrections: number;
      accuracy: unknown[];
    };
    assert.equal(emptySummaryBody.period, "7d");
    assert.deepEqual(emptySummaryBody.readings, { conversations: 0, contacts: 0 });
    assert.deepEqual(emptySummaryBody.leads, { total: 0, booked: 0, bookedPercent: 0, noOutcome: 0 });
    assert.deepEqual(emptySummaryBody.suggestions, { created: 0, edited: 0, used: 0, dismissed: 0, unused: 0 });
    assert.equal(emptySummaryBody.corrections, 0);
    assert.deepEqual(emptySummaryBody.accuracy, []);

    await pool.query("DELETE FROM whatsapp_job_runs WHERE job_name = 'whatsapp_proposals'");
    const recompute = await fetch(`${endpoint}/whatsapp/learning/recompute`, { method: "POST", headers: headers(admin) });
    assert.equal(recompute.status, 202);
    const secondRecompute = await fetch(`${endpoint}/whatsapp/learning/recompute`, { method: "POST", headers: headers(admin) });
    assert.equal(secondRecompute.status, 409);
    const updatedScore = await pool.query<{ base_score: number }>(
      "SELECT base_score FROM whatsapp_conversations WHERE id = $1", [conversationId]
    );
    assert.equal(updatedScore.rows[0]?.base_score, 30);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await pool.query("ALTER TABLE whatsapp_ai_rule_events DISABLE TRIGGER whatsapp_ai_rule_events_append_only");
    await pool.query("DELETE FROM whatsapp_ai_rule_events WHERE rule_id = ANY($1::uuid[])", [[ruleId, ignoredRuleId]]);
    await pool.query("ALTER TABLE whatsapp_ai_rule_events ENABLE TRIGGER whatsapp_ai_rule_events_append_only");
    await pool.query("DELETE FROM whatsapp_ai_rules WHERE id = ANY($1::uuid[])", [[ruleId, ignoredRuleId]]);
    await pool.query("DELETE FROM whatsapp_contacts WHERE id = $1", [contactId]);
    env.WHATSAPP_ENABLED = previousEnabled;
    await pool.end();
  }
});
