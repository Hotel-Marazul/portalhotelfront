// Fila de download da mídia do WhatsApp (foto, áudio, vídeo, documento, figurinha).
// A Evolution guarda as mensagens; aqui buscamos os bytes, guardamos no banco e servimos.
// Nenhuma transação fica aberta durante a chamada HTTP à Evolution: a linha é "reservada"
// empurrando next_attempt_at para frente (lease) e o resultado é gravado depois.
import { env } from "../../config/env.js";
import { pool } from "../../db/client.js";
import { createEvolutionClient, EvolutionError } from "./evolution-client.js";
import { FETCHABLE_MEDIA_TYPES, isFetchableMediaType } from "./evolution-parser.js";
import { downloadMedia, mediaRetryDelayMs, type MediaFetchClient } from "./media.js";

export type MediaStatus = "pending" | "ready" | "failed" | "too_large";

const LEASE_INTERVAL = "2 minutes";
const BACKFILL_EVERY_MS = 60_000;
const MEDIA_TYPES_SQL = FETCHABLE_MEDIA_TYPES.map((type) => `'${type}'`).join(", ");

interface ClaimedMedia {
  message_id: string;
  provider_message_id: string | null;
  media_type: string;
  attempts: number;
  file_length: string | null;
}

function errorCode(error: unknown): string {
  return error instanceof EvolutionError ? error.reason : "internal";
}

function evolutionClientOrNull(): MediaFetchClient | null {
  if (!env.WHATSAPP_ENABLED) return null;
  try {
    return createEvolutionClient();
  } catch {
    return null;
  }
}

/** Mensagens de mídia dos últimos 30 dias que ainda não têm linha na fila ganham uma. */
export async function backfillMediaRows(limit = 200): Promise<number> {
  const result = await pool.query(
    `INSERT INTO whatsapp_media (message_id)
     SELECT m.id
     FROM whatsapp_messages m
     WHERE m.media_type IN (${MEDIA_TYPES_SQL})
       AND m.provider_message_id IS NOT NULL
       AND m.sent_at >= NOW() - INTERVAL '30 days'
       AND NOT EXISTS (SELECT 1 FROM whatsapp_media media WHERE media.message_id = m.id)
     ORDER BY m.sent_at DESC
     LIMIT $1
     ON CONFLICT (message_id) DO NOTHING`,
    [limit]
  );
  return result.rowCount ?? 0;
}

/**
 * Coloca na fila as mensagens de mídia que a tela está mostrando e ainda não têm linha
 * (ex.: mais antigas que o backfill de 30 dias). O worker baixa depois; a timeline já as
 * mostra como pending. Um único INSERT, idempotente.
 */
export async function enqueueMissingMedia(messageIds: string[]): Promise<number> {
  if (messageIds.length === 0) return 0;
  const result = await pool.query(
    `INSERT INTO whatsapp_media (message_id)
     SELECT m.id
     FROM whatsapp_messages m
     WHERE m.id = ANY($1::uuid[])
       AND m.media_type IN (${MEDIA_TYPES_SQL})
     ON CONFLICT (message_id) DO NOTHING`,
    [messageIds]
  );
  return result.rowCount ?? 0;
}

async function claimDue(limit: number, messageId?: string): Promise<ClaimedMedia[]> {
  const params: unknown[] = [limit];
  if (messageId) params.push(messageId);
  const result = await pool.query<ClaimedMedia>(
    `WITH due AS (
       SELECT message_id
       FROM whatsapp_media
       WHERE status = 'pending'
         AND next_attempt_at <= NOW()
         ${messageId ? "AND message_id = $2" : ""}
       ORDER BY next_attempt_at, message_id
       LIMIT $1
       FOR UPDATE SKIP LOCKED
     )
     UPDATE whatsapp_media media
     SET next_attempt_at = NOW() + INTERVAL '${LEASE_INTERVAL}', updated_at = NOW()
     FROM due, whatsapp_messages m
     WHERE media.message_id = due.message_id
       AND m.id = media.message_id
     RETURNING media.message_id, m.provider_message_id, m.media_type, media.attempts,
               CASE WHEN jsonb_typeof(m.media_meta -> 'fileLength') = 'number'
                    THEN (m.media_meta ->> 'fileLength') END AS file_length`,
    params
  );
  return result.rows;
}

async function markTooLarge(messageId: string): Promise<void> {
  await pool.query(
    `UPDATE whatsapp_media
     SET status = 'too_large', data = NULL, byte_size = NULL, last_error = NULL,
         fetched_at = NOW(), updated_at = NOW()
     WHERE message_id = $1 AND status = 'pending'`,
    [messageId]
  );
}

async function markFailure(row: ClaimedMedia, code: string): Promise<MediaStatus> {
  const attempts = row.attempts + 1;
  const delay = mediaRetryDelayMs(attempts);
  const status: MediaStatus = delay === null ? "failed" : "pending";
  await pool.query(
    `UPDATE whatsapp_media
     SET attempts = $2,
         status = $3,
         next_attempt_at = NOW() + ($4::int * INTERVAL '1 millisecond'),
         last_error = $5,
         updated_at = NOW()
     WHERE message_id = $1 AND status = 'pending'`,
    [row.message_id, attempts, status, delay ?? 0, code]
  );
  return status;
}

async function processClaimed(
  row: ClaimedMedia,
  client: MediaFetchClient,
  deadlineMs?: number
): Promise<MediaStatus> {
  if (!row.provider_message_id || !isFetchableMediaType(row.media_type)) {
    await pool.query(
      `UPDATE whatsapp_media
       SET status = 'failed', last_error = 'not_fetchable', updated_at = NOW()
       WHERE message_id = $1 AND status = 'pending'`,
      [row.message_id]
    );
    return "failed";
  }

  const declaredSize = row.file_length === null ? NaN : Number(row.file_length);
  if (Number.isFinite(declaredSize) && declaredSize > env.WHATSAPP_MEDIA_MAX_BYTES) {
    await markTooLarge(row.message_id);
    return "too_large";
  }

  try {
    const result = await downloadMedia(client, {
      providerMessageId: row.provider_message_id,
      mediaType: row.media_type,
      maxBytes: env.WHATSAPP_MEDIA_MAX_BYTES,
      deadlineMs
    });
    if (result.status === "too_large") {
      await markTooLarge(row.message_id);
      return "too_large";
    }
    await pool.query(
      `UPDATE whatsapp_media
       SET status = 'ready', data = $2, mimetype = $3, byte_size = $4,
           last_error = NULL, fetched_at = NOW(), updated_at = NOW()
       WHERE message_id = $1 AND status = 'pending'`,
      [row.message_id, result.data, result.mimetype, result.data.length]
    );
    return "ready";
  } catch (error) {
    const code = errorCode(error);
    console.warn(JSON.stringify({ event: "whatsapp_media_fetch", messageId: row.message_id, result: "failed", reason: code }));
    return markFailure(row, code);
  }
}

let running = false;
let lastBackfillAt = 0;

/**
 * Um ciclo do worker: completa a fila com mensagens antigas (no máximo uma vez por minuto)
 * e baixa as mídias vencidas. Fica parado com o módulo desligado ou sem Evolution.
 */
export async function runMediaWorkerOnce(
  options: { client?: MediaFetchClient; limit?: number; forceBackfill?: boolean } = {}
): Promise<number> {
  const client = options.client ?? evolutionClientOrNull();
  if (!client || running) return 0;
  running = true;
  try {
    if (options.forceBackfill || Date.now() - lastBackfillAt >= BACKFILL_EVERY_MS) {
      lastBackfillAt = Date.now();
      await backfillMediaRows();
    }
    const rows = await claimDue(options.limit ?? 3);
    let processed = 0;
    for (const row of rows) {
      await processClaimed(row, client);
      processed += 1;
    }
    return processed;
  } finally {
    running = false;
  }
}

export interface MediaInfo {
  messageId: string;
  mediaType: string;
  fetchable: boolean;
  fileName: string | null;
  status: MediaStatus | null;
  mimetype: string | null;
  byteSize: number | null;
}

export async function getMediaInfo(messageId: string): Promise<MediaInfo | null> {
  const result = await pool.query<{
    id: string;
    media_type: string;
    provider_message_id: string | null;
    file_name: string | null;
    status: MediaStatus | null;
    mimetype: string | null;
    byte_size: number | null;
  }>(
    `SELECT m.id, m.media_type, m.provider_message_id, m.media_meta ->> 'fileName' AS file_name,
            media.status, media.mimetype, media.byte_size
     FROM whatsapp_messages m
     LEFT JOIN whatsapp_media media ON media.message_id = m.id
     WHERE m.id = $1
     LIMIT 1`,
    [messageId]
  );
  const row = result.rows[0];
  if (!row) return null;
  return {
    messageId: row.id,
    mediaType: row.media_type,
    fetchable: isFetchableMediaType(row.media_type) && Boolean(row.provider_message_id),
    fileName: row.file_name,
    status: row.status,
    mimetype: row.mimetype,
    byteSize: row.byte_size
  };
}

/** Lê só o trecho pedido (start é 0-based) sem carregar o arquivo inteiro na memória. */
export async function readMediaBytes(messageId: string, start: number, length: number): Promise<Buffer | null> {
  const result = await pool.query<{ chunk: Buffer | null }>(
    `SELECT substring(data FROM $2::int FOR $3::int) AS chunk
     FROM whatsapp_media
     WHERE message_id = $1 AND status = 'ready'`,
    [messageId, start + 1, length]
  );
  return result.rows[0]?.chunk ?? null;
}

/**
 * Mensagem de mídia ainda sem linha (antiga ou anterior a esta versão): cria a linha e
 * tenta baixar na hora, dentro de um prazo curto. Devolve o status resultante.
 */
export async function fetchMediaNow(
  messageId: string,
  options: { client?: MediaFetchClient; deadlineMs?: number } = {}
): Promise<MediaStatus> {
  await pool.query(
    "INSERT INTO whatsapp_media (message_id) VALUES ($1) ON CONFLICT (message_id) DO NOTHING",
    [messageId]
  );
  const client = options.client ?? evolutionClientOrNull();
  const [row] = client ? await claimDue(1, messageId) : [];
  if (client && row) return processClaimed(row, client, options.deadlineMs ?? 20_000);
  const current = await pool.query<{ status: MediaStatus }>(
    "SELECT status FROM whatsapp_media WHERE message_id = $1",
    [messageId]
  );
  return current.rows[0]?.status ?? "pending";
}

/** failed -> pending, zerando as tentativas. Devolve false se não estava em failed. */
export async function retryFailedMedia(messageId: string): Promise<boolean> {
  const result = await pool.query(
    `UPDATE whatsapp_media
     SET status = 'pending', attempts = 0, next_attempt_at = NOW(), last_error = NULL, updated_at = NOW()
     WHERE message_id = $1 AND status = 'failed'`,
    [messageId]
  );
  return (result.rowCount ?? 0) > 0;
}
