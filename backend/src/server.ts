import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { initializeDatabase } from "./db/init.js";
import { pool } from "./db/client.js";
import { startWhatsappJobs, stopWhatsappJobs } from "./modules/whatsapp/jobs.js";

const app = createApp();

async function bootstrap() {
  await initializeDatabase();
  const server = app.listen(env.PORT, () => {
    console.log(`API running on http://localhost:${env.PORT}`);
  });
  if (env.WHATSAPP_ENABLED) startWhatsappJobs();

  const shutdown = () => {
    stopWhatsappJobs();
    server.close(() => {
      void pool.end().finally(() => process.exit(0));
    });
  };
  process.once("SIGTERM", shutdown);
  process.once("SIGINT", shutdown);
}

bootstrap().catch((error) => {
  console.error("Failed to bootstrap API:", error);
  process.exit(1);
});
