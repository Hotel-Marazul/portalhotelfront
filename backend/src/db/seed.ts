import { initializeDatabase } from "./init.js";
import { pool } from "./client.js";

// Compatibilidade com `npm run seed`: inicializa schema e acessos sem dados de
// demonstração, DELETEs ou sobrescrita de preços e cadastros operacionais.
async function bootstrap() {
  try {
    await initializeDatabase();
    console.log("Inicialização concluída. Cadastros, preços e reservas existentes foram preservados.");
  } catch (error) {
    console.error("Falha na inicialização:", error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

void bootstrap();
