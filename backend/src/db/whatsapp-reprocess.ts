import { pool } from "./client.js";
import { initializeDatabase } from "./init.js";
import { processPendingWebhookEvents } from "../modules/whatsapp/webhook.worker.js";

await initializeDatabase();
await pool.query(
  `UPDATE whatsapp_webhook_events
   SET attempts = 0, process_error = NULL
   WHERE processed_at IS NULL`
);

let total = 0;
while (true) {
  const processed = await processPendingWebhookEvents(50, true);
  total += processed;
  if (processed === 0) break;
}

console.log(`Eventos reprocessados: ${total}`);
await pool.end();
