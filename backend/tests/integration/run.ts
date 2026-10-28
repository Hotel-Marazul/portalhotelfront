import "dotenv/config";
import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import pg from "pg";

// Cada arquivo roda num banco descartável recriado do zero, para que dados deixados
// por um teste não quebrem o próximo. O nome sempre termina em _test.
const base = process.env.DB_NAME ?? "portal_hotel";
const database = base.endsWith("_test") ? base : `${base}_test`;
const only = process.argv.slice(2);
const files = readdirSync("tests/integration")
  .filter((file) => file.endsWith(".test.ts"))
  .filter((file) => only.length === 0 || only.some((name) => file.includes(name)))
  .sort();

async function recreate(): Promise<void> {
  const admin = new pg.Client({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: "postgres"
  });
  await admin.connect();
  try {
    await admin.query(`DROP DATABASE IF EXISTS "${database}" WITH (FORCE)`);
    await admin.query(`CREATE DATABASE "${database}"`);
  } finally {
    await admin.end();
  }
}

const failed: string[] = [];
for (const file of files) {
  await recreate();
  const result = spawnSync(process.execPath, ["--import", "tsx", "--test", `tests/integration/${file}`], {
    stdio: "inherit",
    env: { ...process.env, DB_NAME: database }
  });
  if (result.status !== 0) failed.push(file);
}

await recreate();
console.log(`\n${files.length - failed.length}/${files.length} arquivos passaram no banco ${database}.`);
if (failed.length > 0) {
  console.log(`Falharam: ${failed.join(", ")}`);
  process.exit(1);
}
