import assert from "node:assert/strict";
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { env } from "../../src/config/env.js";
import { pool } from "../../src/db/client.js";
import { initializeDatabase } from "../../src/db/init.js";
import { runLearningProposals } from "../../src/modules/whatsapp/proposals.job.js";

async function listen(server: ReturnType<typeof createServer>) {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  return `http://127.0.0.1:${address.port}`;
}

test("propostas de edição filtram nomes e persistem instrução válida", async () => {
  await initializeDatabase();
  const previous = {
    enabled: env.WHATSAPP_AI_ENABLED,
    agentsUrl: env.AGENTS_API_URL,
    agentsKey: env.AGENTS_API_KEY,
    dailyLimit: env.WHATSAPP_AI_DAILY_LIMIT
  };
  env.WHATSAPP_AI_ENABLED = true;
  env.WHATSAPP_AI_DAILY_LIMIT = 1000;
  const server = createServer((request, response) => {
    if (request.url !== "/whatsapp/reply-style-proposals") {
      response.writeHead(404).end();
      return;
    }
    response.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({
      proposals: [
        { instruction: "Cumprimente Carla sempre", supportCount: 5, applicableCount: 5 },
        { instruction: "Use frases curtas e confirme a próxima ação", supportCount: 5, applicableCount: 6 }
      ],
      topEdits: [{ description: "Respostas curtas", count: 5 }]
    }));
  });
  const contacts: string[] = [];
  const ruleIds: string[] = [];
  try {
    env.AGENTS_API_URL = await listen(server);
    env.AGENTS_API_KEY = "fixture-agent-key";
    for (let index = 0; index < 5; index += 1) {
      const contactId = randomUUID();
      const conversationId = randomUUID();
      const inboundId = randomUUID();
      const suggestionId = randomUUID();
      const outboundId = randomUUID();
      contacts.push(contactId);
      const phone = `+55489966${String(index).padStart(6, "0")}`;
      await pool.query(
        `INSERT INTO whatsapp_contacts (id, remote_jid, phone_e164, push_name)
         VALUES ($1, $2, $3, 'Carla')`,
        [contactId, `${phone.slice(1)}@s.whatsapp.net`, phone]
      );
      await pool.query("INSERT INTO whatsapp_conversations (id, contact_id) VALUES ($1, $2)", [conversationId, contactId]);
      await pool.query(
        `INSERT INTO whatsapp_messages
         (id, conversation_id, direction, origin, body, media_type, status, sent_at)
         VALUES ($1, $2, 'inbound', 'guest', 'Preciso de ajuda', 'text', 'received', NOW() - INTERVAL '2 minutes')`,
        [inboundId, conversationId]
      );
      await pool.query(
        `INSERT INTO whatsapp_reply_suggestions
         (id, conversation_id, reply_to_message_id, parts, text, basis, status, model)
         VALUES ($1, $2, $3, $4::jsonb, 'Resposta sugerida', $5, 'used', 'fixture')`,
        [suggestionId, conversationId, inboundId, JSON.stringify([{ text: "Resposta sugerida", gap: false }]), ["regra fixture", "fato fixture"]]
      );
      await pool.query(
        `INSERT INTO whatsapp_messages
         (id, conversation_id, direction, origin, body, media_type, status, suggestion_id, sent_at)
         VALUES ($1, $2, 'outbound', 'portal_suggestion_edited', 'Resposta editada', 'text', 'sent', $3, NOW())`,
        [outboundId, conversationId, suggestionId]
      );
    }

    const result = await runLearningProposals();
    assert.deepEqual(result.topEdits, [{ description: "Respostas curtas", count: 5 }]);
    const proposals = await pool.query<{ instruction: string }>(
      "SELECT instruction FROM whatsapp_ai_rules WHERE kind = 'reply' AND source = 'edits'"
    );
    assert.deepEqual(proposals.rows.map((row) => row.instruction), ["Use frases curtas e confirme a próxima ação"]);
    const ids = await pool.query<{ id: string }>(
      "SELECT id FROM whatsapp_ai_rules WHERE kind = 'reply' AND source = 'edits'"
    );
    ruleIds.push(...ids.rows.map((row) => row.id));
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await pool.query("ALTER TABLE whatsapp_ai_rule_events DISABLE TRIGGER whatsapp_ai_rule_events_append_only");
    if (ruleIds.length) {
      await pool.query("DELETE FROM whatsapp_ai_rule_events WHERE rule_id = ANY($1::uuid[])", [ruleIds]);
      await pool.query("DELETE FROM whatsapp_ai_rules WHERE id = ANY($1::uuid[])", [ruleIds]);
    }
    await pool.query("ALTER TABLE whatsapp_ai_rule_events ENABLE TRIGGER whatsapp_ai_rule_events_append_only");
    if (contacts.length) await pool.query("DELETE FROM whatsapp_contacts WHERE id = ANY($1::uuid[])", [contacts]);
    env.WHATSAPP_AI_ENABLED = previous.enabled;
    env.AGENTS_API_URL = previous.agentsUrl;
    env.AGENTS_API_KEY = previous.agentsKey;
    env.WHATSAPP_AI_DAILY_LIMIT = previous.dailyLimit;
    await pool.end();
  }
});
