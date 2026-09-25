import { randomUUID } from "node:crypto";
import { processPendingWebhookEvents } from "./webhook.worker.js";
import { runTriageOnce } from "./triage.worker.js";
import { createEvolutionClient } from "./evolution-client.js";
import { env } from "../../config/env.js";
import { pool, query } from "../../db/client.js";
import { runLearningProposals } from "./proposals.job.js";
import { runWhatsappRetention } from "./retention.job.js";

let webhookTimer: ReturnType<typeof setInterval> | null = null;
let triageTimer: ReturnType<typeof setInterval> | null = null;
let connectionTimer: ReturnType<typeof setInterval> | null = null;
let episodeTimer: ReturnType<typeof setInterval> | null = null;
let proposalTimer: ReturnType<typeof setInterval> | null = null;

export async function closeIdleEpisodes(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `UPDATE whatsapp_episodes episode
       SET closed_at = NOW(), close_reason = 'idle'
       FROM whatsapp_conversations conversation
       WHERE episode.id = conversation.current_episode_id
         AND episode.closed_at IS NULL
         AND conversation.last_message_at < NOW() - INTERVAL '7 days'`
    );
    await client.query(
      `UPDATE whatsapp_conversations
       SET awaiting_since = NULL, unread_count = 0,
           triage_status = 'idle', triage_requested_at = NULL
       WHERE last_message_at < NOW() - INTERVAL '7 days'
         AND current_episode_id IN (SELECT id FROM whatsapp_episodes WHERE closed_at IS NOT NULL)`
    );
    await client.query("COMMIT");
  } catch {
    await client.query("ROLLBACK");
  } finally {
    client.release();
  }
}

async function runDailyProposals(): Promise<void> {
  const rows = await query<{ last_started_at: string | null }>(
    "SELECT last_started_at::text FROM whatsapp_job_runs WHERE job_name = 'whatsapp_proposals'"
  );
  const last = rows[0]?.last_started_at ? new Date(rows[0].last_started_at) : null;
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: env.HOTEL_TIMEZONE }).format(new Date());
  const lastDay = last ? new Intl.DateTimeFormat("en-CA", { timeZone: env.HOTEL_TIMEZONE }).format(last) : null;
  if (today === lastDay) return;
  await runLearningProposals();
}

async function syncConnectionState(): Promise<void> {
  try {
    const state = await createEvolutionClient().connectionState();
    await pool.query(
      `INSERT INTO whatsapp_instances (id, name, connection_state, state_changed_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (name) DO UPDATE
       SET connection_state = EXCLUDED.connection_state, state_changed_at = NOW()`,
      [randomUUID(), env.EVOLUTION_INSTANCE, state.state]
    );
  } catch {
    // A failed probe must not stop webhook or triage workers.
  }
}

export function startWhatsappJobs(): void {
  if (webhookTimer || triageTimer) return;
  void processPendingWebhookEvents().catch(() => undefined);
  void runTriageOnce().catch(() => undefined);
  void syncConnectionState();
  void closeIdleEpisodes();
  void runWhatsappRetention().catch(() => undefined);
  void runDailyProposals().catch(() => undefined);
  webhookTimer = setInterval(() => {
    void processPendingWebhookEvents().catch(() => undefined);
  }, 10_000);
  triageTimer = setInterval(() => {
    void runTriageOnce().catch(() => undefined);
  }, 5_000);
  connectionTimer = setInterval(() => {
    void syncConnectionState();
  }, 60_000);
  episodeTimer = setInterval(() => {
    void closeIdleEpisodes();
    void runWhatsappRetention().catch(() => undefined);
  }, 60 * 60 * 1000);
  proposalTimer = setInterval(() => {
    void runDailyProposals().catch(() => undefined);
  }, 10 * 60 * 1000);
  webhookTimer.unref?.();
  triageTimer.unref?.();
  connectionTimer.unref?.();
  episodeTimer.unref?.();
  proposalTimer.unref?.();
}

export function stopWhatsappJobs(): void {
  if (webhookTimer) clearInterval(webhookTimer);
  if (triageTimer) clearInterval(triageTimer);
  if (connectionTimer) clearInterval(connectionTimer);
  if (episodeTimer) clearInterval(episodeTimer);
  if (proposalTimer) clearInterval(proposalTimer);
  webhookTimer = null;
  triageTimer = null;
  connectionTimer = null;
  episodeTimer = null;
  proposalTimer = null;
}
