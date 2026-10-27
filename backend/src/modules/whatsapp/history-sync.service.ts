import { env } from "../../config/env.js";
import { pool } from "../../db/client.js";
import { createEvolutionClient, type EvolutionContact, type EvolutionMessagesPage } from "./evolution-client.js";
import { parseEvolutionEvent, type ParsedEvolutionEvent } from "./evolution-parser.js";
import { ingestParsedEvent, settleImportedConversation } from "./ingestion.service.js";

type MessageEvent = Extract<ParsedEvolutionEvent, { kind: "message" }>;

export interface HistorySource {
  findMessages(page: number, pageSize: number): Promise<EvolutionMessagesPage>;
  findContacts(): Promise<EvolutionContact[]>;
}

export interface HistorySyncResult {
  messagesRead: number;
  messagesImported: number;
  conversations: number;
  conversationsCreated: number;
  waiting: number;
  ignored: number;
  failedConversations: number;
}

const PAGE_SIZE = 500;
const MAX_PAGES = 400;
/** Só volta para a fila quem falou por último dentro deste prazo. */
const AWAITING_WINDOW_HOURS = 72;

export class HistorySyncBusyError extends Error {
  constructor() {
    super("history_sync_running");
  }
}

/** Nome que a Evolution guarda para @lid costuma ser o próprio número do LID: não serve. */
function usableName(value: string | null | undefined): string {
  const name = value?.trim() ?? "";
  return /^\+?\d+$/.test(name) ? "" : name;
}

async function readAllMessages(source: HistorySource): Promise<Record<string, unknown>[]> {
  const records: Record<string, unknown>[] = [];
  let pages = 1;
  for (let page = 1; page <= Math.min(pages, MAX_PAGES); page += 1) {
    const result = await source.findMessages(page, PAGE_SIZE);
    records.push(...result.records);
    pages = result.pages;
    if (result.records.length === 0) break;
  }
  return records;
}

function keyOf(record: Record<string, unknown>): Record<string, unknown> {
  const key = record.key;
  return typeof key === "object" && key !== null && !Array.isArray(key) ? key as Record<string, unknown> : {};
}

/**
 * A Evolution só manda remoteJidAlt em parte das mensagens de um mesmo @lid. Quando
 * alguma delas revela o telefone, as demais herdam: senão a pessoa vira duas conversas.
 */
function withKnownPhone(records: Record<string, unknown>[]): Record<string, unknown>[] {
  const phoneByLid = new Map<string, string>();
  for (const record of records) {
    const key = keyOf(record);
    if (typeof key.remoteJid === "string" && key.remoteJid.endsWith("@lid") &&
        typeof key.remoteJidAlt === "string" && key.remoteJidAlt.endsWith("@s.whatsapp.net")) {
      phoneByLid.set(key.remoteJid, key.remoteJidAlt);
    }
  }
  return records.map((record) => {
    const key = keyOf(record);
    const phone = typeof key.remoteJid === "string" ? phoneByLid.get(key.remoteJid) : undefined;
    return phone && !key.remoteJidAlt ? { ...record, key: { ...key, remoteJidAlt: phone } } : record;
  });
}

async function countRows(): Promise<{ messages: number; conversations: number }> {
  const result = await pool.query<{ messages: number; conversations: number }>(
    `SELECT (SELECT COUNT(*)::int FROM whatsapp_messages) AS messages,
            (SELECT COUNT(*)::int FROM whatsapp_conversations) AS conversations`
  );
  return result.rows[0] ?? { messages: 0, conversations: 0 };
}

async function importConversation(remoteJid: string, events: MessageEvent[], name: string): Promise<boolean> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const event of events) {
      await ingestParsedEvent(client, event, { historical: true });
    }
    if (name) {
      await client.query(
        "UPDATE whatsapp_contacts SET push_name = $1, updated_at = NOW() WHERE remote_jid = $2 AND push_name = ''",
        [name.slice(0, 100), remoteJid]
      );
    }
    const waiting = await settleImportedConversation(client, remoteJid, AWAITING_WINDOW_HOURS);
    await client.query("COMMIT");
    return waiting;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Puxa da Evolution as mensagens que ela já guardou (inclusive as de antes do pareamento)
 * e grava como histórico. Pode rodar de novo: mensagens já gravadas são ignoradas pelo id.
 */
export async function syncHistory(source: HistorySource): Promise<HistorySyncResult> {
  const [records, contacts] = await Promise.all([readAllMessages(source), source.findContacts()]);
  const names = new Map(contacts.map((contact) => [contact.remoteJid, usableName(contact.pushName)]));

  const byJid = new Map<string, MessageEvent[]>();
  let ignored = 0;
  for (const record of withKnownPhone(records)) {
    const event = parseEvolutionEvent(
      { event: "messages.upsert", instance: env.EVOLUTION_INSTANCE, data: record },
      env.EVOLUTION_INSTANCE
    );
    if (event.kind !== "message") {
      ignored += 1;
      continue;
    }
    const pushName = event.fromMe ? "" : usableName(event.pushName) || names.get(event.remoteJid) || "";
    const list = byJid.get(event.remoteJid) ?? [];
    list.push({ ...event, pushName });
    byJid.set(event.remoteJid, list);
  }

  const before = await countRows();
  let waiting = 0;
  let failedConversations = 0;
  for (const [remoteJid, events] of byJid) {
    // Mais antiga primeiro: o estado da conversa termina igual ao da última mensagem.
    events.sort((left, right) => left.sentAt.getTime() - right.sentAt.getTime());
    try {
      if (await importConversation(remoteJid, events, names.get(remoteJid) ?? "")) waiting += 1;
    } catch (error) {
      failedConversations += 1;
      console.warn(JSON.stringify({
        event: "whatsapp_history_sync_conversation",
        result: "failed",
        reason: error instanceof Error ? error.message : "internal"
      }));
    }
  }
  const after = await countRows();

  return {
    messagesRead: records.length,
    messagesImported: after.messages - before.messages,
    conversations: byJid.size,
    conversationsCreated: after.conversations - before.conversations,
    waiting,
    ignored,
    failedConversations
  };
}

let running: Promise<HistorySyncResult> | null = null;

export async function runHistorySync(source: HistorySource = createEvolutionClient()): Promise<HistorySyncResult> {
  if (running) throw new HistorySyncBusyError();
  running = syncHistory(source);
  try {
    return await running;
  } finally {
    running = null;
  }
}
