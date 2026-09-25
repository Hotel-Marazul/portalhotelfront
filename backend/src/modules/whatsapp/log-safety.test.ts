import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const moduleDirectory = dirname(fileURLToPath(import.meta.url));
const files = [
  ...readdirSync(moduleDirectory)
    .filter((name) => name.endsWith(".ts") && !name.endsWith(".test.ts"))
    .map((name) => join(moduleDirectory, name)),
  join(moduleDirectory, "../../db/whatsapp-reprocess.ts")
];

test("logs do módulo não incluem dados da conversa", () => {
  const logCall = /console\.|log_event|logger\.|process\.(stdout|stderr)|morgan/i;
  const personalData = /\b(body|phone|push_name|suggestion|text)\b/i;

  for (const file of files) {
    const logLines = readFileSync(file, "utf8")
      .split("\n")
      .filter((line) => logCall.test(line));
    for (const line of logLines) {
      assert.doesNotMatch(line, personalData, file);
    }
  }
});
