import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { initializeDatabase } from "./db/init.js";
const app = createApp();
async function bootstrap() {
    await initializeDatabase();
    app.listen(env.PORT, () => {
        console.log(`API running on http://localhost:${env.PORT}`);
    });
}
bootstrap().catch((error) => {
    console.error("Failed to bootstrap API:", error);
    process.exit(1);
});
