import type { PoolClient } from "pg";
import { env } from "../../config/env.js";
import { pool } from "../../db/client.js";
import { parseEvolutionEvent } from "./evolution-parser.js";
import { ingestParsedEvent } from "./ingestion.service.js";

interface WebhookEventRow {
  id: string;
  payload: unknown;
}

function processErrorCode(error: unknown): string {
  if (error instanceof Error && ["invalid_phone", "contact_not_created", "conversation_not_created"].includes(error.message)) {
    return error.message;
  }
  return "db_error";
}

async function claimOne(id: string): Promise<WebhookEventRow | null> {
  const result = await pool.query<WebhookEventRow>(
    `UPDATE whatsapp_webhook_events
     SET attempts = attempts + 1
     WHERE id = $1 AND processed_at IS NULL AND attempts < 5
     RETURNING id, payload`,
    [id]
  );
  return result.rows[0] ?? null;
}

async function claimPending(limit: number, ignoreAge: boolean): Promise<WebhookEventRow[]> {
  const ageClause = ignoreAge ? "" : "AND received_at < NOW() - INTERVAL '10 seconds'";
  const result = await pool.query<WebhookEventRow>(
    `WITH pending AS (
       SELECT id
       FROM whatsapp_webhook_events
       WHERE processed_at IS NULL
         ${ageClause}
         AND attempts < 5
       ORDER BY received_at, id
       LIMIT $1
       FOR UPDATE SKIP LOCKED
     )
     UPDATE whatsapp_webhook_events AS event
     SET attempts = event.attempts + 1
     FROM pending
     WHERE event.id = pending.id
     RETURNING event.id, event.payload`,
    [limit]
  );
  return result.rows;
}

async function markIgnored(id: string, reason: string): Promise<void> {
  await pool.query(
    `UPDATE whatsapp_webhook_events
     SET processed_at = NOW(), process_error = $2
     WHERE id = $1 AND processed_at IS NULL`,
    [id, reason]
  );
}

async function processClaimed(row: WebhookEventRow): Promise<boolean> {
  let parsed;
  try {
    parsed = parseEvolutionEvent(row.payload, env.EVOLUTION_INSTANCE);
  } catch {
    await markIgnored(row.id, "parse_error");
    return false;
  }

  if (parsed.kind === "ignored") {
    await markIgnored(row.id, parsed.reason);
    return true;
  }

  const client: PoolClient = await pool.connect();
  try {
    await client.query("BEGIN");
    await ingestParsedEvent(client, parsed);
    await client.query(
      `UPDATE whatsapp_webhook_events
       SET processed_at = NOW(), process_error = NULL
       WHERE id = $1`,
      [row.id]
    );
    await client.query("COMMIT");
    return true;
  } catch (error) {
    await client.query("ROLLBACK");
    await pool.query(
      `UPDATE whatsapp_webhook_events
       SET process_error = $2
       WHERE id = $1 AND processed_at IS NULL`,
      [row.id, processErrorCode(error)]
    );
    return false;
  } finally {
    client.release();
  }
}

export async function processWebhookEvent(id: string): Promise<boolean> {
  const row = await claimOne(id);
  return row ? processClaimed(row) : false;
}

export async function processPendingWebhookEvents(limit = 20, ignoreAge = false): Promise<number> {
  const rows = await claimPending(limit, ignoreAge);
  let processed = 0;
  for (const row of rows) {
    if (await processClaimed(row)) processed += 1;
  }
  return processed;
}
