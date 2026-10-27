import assert from "node:assert/strict";
import test from "node:test";
import { pool } from "../../src/db/client.js";
import { initializeDatabase } from "../../src/db/init.js";
import { syncHistory, type HistorySource } from "../../src/modules/whatsapp/history-sync.service.js";

const now = Math.floor(Date.now() / 1000);
const suffix = String(Math.floor(Math.random() * 1e8)).padStart(8, "0");
const lidJid = `9${suffix}123@lid`;
const phoneJid = `55489${suffix}@s.whatsapp.net`;
const knownLidJid = `8${suffix}456@lid`;
const knownPhoneJid = `55519${suffix}@s.whatsapp.net`;

function record(id: string, remoteJid: string, fromMe: boolean, secondsAgo: number, message: Record<string, unknown>) {
  return {
    key: { id: `${id}-${suffix}`, fromMe, remoteJid },
    pushName: fromMe ? "Hotel" : remoteJid.split("@")[0],
    messageTimestamp: now - secondsAgo,
    message
  };
}

// A Evolution devolve da mais nova para a mais antiga.
const records = [
  record("lid-in-3", lidJid, false, 1_800, { conversation: "tem vaga sábado?" }),
  record("lid-in-2", lidJid, false, 3_600, { imageMessage: { mimetype: "image/jpeg", caption: "" } }),
  record("lid-out-1", lidJid, true, 10 * 86_400, { conversation: "Olá! Como posso ajudar?" }),
  record("lid-in-1", lidJid, false, 10 * 86_400 + 60, { conversation: "oi" }),
  record("old-in-1", phoneJid, false, 30 * 86_400, { conversation: "obrigado pela estadia" }),
  { ...record("known-in-2", knownLidJid, false, 5 * 86_400, { conversation: "e o café?" }),
    key: { id: `known-in-2-${suffix}`, fromMe: false, remoteJid: knownLidJid, remoteJidAlt: knownPhoneJid } },
  record("known-in-1", knownLidJid, false, 6 * 86_400, { conversation: "bom dia" }),
  record("group-1", `1203${suffix}@g.us`, false, 100, { conversation: "grupo" })
];

const source: HistorySource = {
  async findMessages(page, pageSize) {
    return { records: records.slice((page - 1) * pageSize, page * pageSize), pages: Math.ceil(records.length / pageSize) };
  },
  async findContacts() {
    return [{ remoteJid: lidJid, pushName: "Hóspede LID" }, { remoteJid: phoneJid, pushName: "48999" }];
  }
};

async function conversationOf(remoteJid: string) {
  const result = await pool.query<{
    phone_e164: string | null;
    push_name: string;
    awaiting_since: Date | null;
    unread_count: number;
    triage_status: string;
    messages: number;
    media: number;
  }>(
    `SELECT contact.phone_e164, contact.push_name, c.awaiting_since, c.unread_count, c.triage_status,
            (SELECT COUNT(*)::int FROM whatsapp_messages m WHERE m.conversation_id = c.id) AS messages,
            (SELECT COUNT(*)::int FROM whatsapp_media media JOIN whatsapp_messages m ON m.id = media.message_id
              WHERE m.conversation_id = c.id) AS media
     FROM whatsapp_contacts contact
     JOIN whatsapp_conversations c ON c.contact_id = contact.id
     WHERE contact.remote_jid = $1`,
    [remoteJid]
  );
  return result.rows[0];
}

test("histórico: importa conversas antigas, aceita @lid e só põe na fila quem espera resposta", async () => {
  await initializeDatabase();
  try {
    const first = await syncHistory({ ...source, findMessages: (page) => source.findMessages(page, 4) });
    assert.equal(first.messagesRead, 8);
    assert.equal(first.ignored, 1);
    assert.equal(first.conversations, 3);
    assert.equal(first.messagesImported, 7);
    assert.equal(first.waiting, 1);
    assert.equal(first.failedConversations, 0);

    const lid = await conversationOf(lidJid);
    assert.equal(lid?.phone_e164, null);
    assert.equal(lid?.push_name, "Hóspede LID");
    assert.equal(lid?.messages, 4);
    assert.equal(lid?.unread_count, 2);
    assert.equal(lid?.triage_status, "pending");
    assert.equal(lid?.awaiting_since?.getTime(), (now - 3_600) * 1000);
    assert.equal(lid?.media, 0, "mídia antiga só é baixada quando alguém abre a conversa");

    const old = await conversationOf(phoneJid);
    assert.equal(old?.phone_e164, `+55489${suffix}`);
    assert.equal(old?.push_name, "", "nome que é só número não substitui o contato");
    assert.equal(old?.awaiting_since, null);
    assert.equal(old?.unread_count, 0);
    assert.equal(old?.triage_status, "idle");

    const known = await conversationOf(knownPhoneJid);
    assert.equal(known?.messages, 2, "mensagens só com o LID ficam na conversa do telefone");
    assert.equal(await conversationOf(knownLidJid), undefined);

    const second = await syncHistory(source);
    assert.equal(second.messagesImported, 0);
    assert.equal(second.conversationsCreated, 0);
    assert.equal(second.waiting, 0);
    assert.equal((await conversationOf(lidJid))?.unread_count, 2);
  } finally {
    await pool.query("DELETE FROM whatsapp_contacts WHERE remote_jid = ANY($1::text[])", [[lidJid, phoneJid, knownLidJid, knownPhoneJid]]);
    await pool.end();
  }
});
