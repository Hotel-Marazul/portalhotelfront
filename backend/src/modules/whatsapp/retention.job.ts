import { pool } from "../../db/client.js";
import { env } from "../../config/env.js";

export async function runWhatsappRetention(): Promise<{ messages: number; episodes: number; events: number }> {
  const db = await pool.connect();
  try {
    await db.query("BEGIN");
    const messages = await db.query(
      `DELETE FROM whatsapp_messages
       WHERE created_at < NOW() - ($1::text || ' months')::interval
       RETURNING id`,
      [env.WHATSAPP_RETENTION_MONTHS]
    );
    const episodes = await db.query(
      `DELETE FROM whatsapp_episodes
       WHERE closed_at IS NOT NULL
         AND closed_at < NOW() - ($1::text || ' months')::interval
       RETURNING id`,
      [env.WHATSAPP_RETENTION_MONTHS]
    );
    const events = await db.query(
      `DELETE FROM whatsapp_webhook_events
       WHERE processed_at IS NOT NULL
         AND processed_at < NOW() - INTERVAL '30 days'
       RETURNING id`
    );
    await db.query("COMMIT");
    return { messages: messages.rowCount ?? 0, episodes: episodes.rowCount ?? 0, events: events.rowCount ?? 0 };
  } catch (error) {
    await db.query("ROLLBACK");
    throw error;
  } finally {
    db.release();
  }
}
