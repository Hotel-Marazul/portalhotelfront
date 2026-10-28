#!/usr/bin/env node
// Audita as changes em openspec/changes/.
// Uso: node scripts/openspec-audit.mjs [change] [--strict]
//
// FALHA (sai com 1): `openspec validate --strict` reprova a change.
// AVISO (sai com 1 só com --strict):
//   - tarefa marcada [x] no disco mas ainda não commitada;
//   - tarefa marcada num commit que só mexeu no tasks.md (sem código junto);
//   - change completa sem verification.md (rodar a skill openspec-verify).

import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim();
process.chdir(root);

const args = process.argv.slice(2);
const strict = args.includes("--strict");
const only = args.find((a) => !a.startsWith("--"));
const changesDir = "openspec/changes";

const git = (...a) =>
  execFileSync("git", a, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024, stdio: ["ignore", "pipe", "ignore"] });
const taskLine = /^- \[( |x)\] (\d+(?:\.\d+)*)\b/i;

function tasksIn(text) {
  const map = new Map();
  for (const line of text.split("\n")) {
    const m = line.match(taskLine);
    if (m) map.set(m[2], m[1].toLowerCase() === "x");
  }
  return map;
}

function showAt(rev, path) {
  try {
    return git("show", `${rev}:${path}`);
  } catch {
    return "";
  }
}

const changes = readdirSync(changesDir, { withFileTypes: true })
  .filter((d) => d.isDirectory() && d.name !== "archive")
  .map((d) => d.name)
  .filter((name) => !only || name === only)
  .sort();

if (only && changes.length === 0) {
  console.error(`Change não encontrada: ${only}`);
  process.exit(2);
}

let failures = 0;
let warnings = 0;

const validation = JSON.parse(
  (() => {
    try {
      return execFileSync("openspec", ["validate", "--changes", "--strict", "--json", "--no-interactive"], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      });
    } catch (error) {
      return error.stdout || '{"items":[]}';
    }
  })(),
);
const validById = new Map(validation.items.map((item) => [item.id, item]));

for (const change of changes) {
  const dir = join(changesDir, change);
  const tasksPath = join(dir, "tasks.md");
  const lines = [];

  const v = validById.get(change);
  if (v && !v.valid) {
    failures++;
    for (const issue of v.issues) lines.push(`  FALHA  openspec validate: ${issue.message ?? JSON.stringify(issue)}`);
  }

  if (!existsSync(tasksPath)) {
    print(change, "sem tasks.md", lines);
    continue;
  }

  const disk = tasksIn(readFileSync(tasksPath, "utf8"));
  const head = tasksIn(showAt("HEAD", tasksPath));

  const uncommitted = [...disk].filter(([id, done]) => done && !head.get(id)).map(([id]) => id);
  if (uncommitted.length) {
    warnings++;
    lines.push(`  AVISO  marcada(s) sem commit: ${uncommitted.join(", ")}`);
  }

  // Commit a commit: quais tarefas passaram de [ ] para [x] e o que mais o commit tocou.
  const commits = git("log", "--format=%H", "--reverse", "--", tasksPath).split("\n").filter(Boolean);
  const docOnly = [];
  for (const sha of commits) {
    const before = tasksIn(showAt(`${sha}^`, tasksPath));
    const after = tasksIn(showAt(sha, tasksPath));
    const checked = [...after].filter(([id, done]) => done && before.has(id) && !before.get(id)).map(([id]) => id);
    if (!checked.length) continue;
    const files = git("show", "--name-only", "--format=", sha).split("\n").filter(Boolean);
    if (files.every((f) => f === tasksPath)) docOnly.push(`${sha.slice(0, 7)} (${checked.join(", ")})`);
  }
  if (docOnly.length) {
    warnings++;
    lines.push(`  AVISO  marcada(s) em commit só com tasks.md: ${docOnly.join("; ")}`);
  }

  const total = disk.size;
  const done = [...disk.values()].filter(Boolean).length;
  const complete = total > 0 && done === total;
  if (complete && !existsSync(join(dir, "verification.md"))) {
    warnings++;
    lines.push("  AVISO  completa sem verification.md — rodar a skill openspec-verify antes de arquivar");
  }

  print(change, `${done}/${total} tarefas${complete ? " ✓" : ""}`, lines);
}

console.log(
  `\n${changes.length} change(s): ${failures} falha(s), ${warnings} aviso(s)${strict ? " (--strict)" : ""}.`,
);
process.exit(failures || (strict && warnings) ? 1 : 0);

function print(change, summary, lines) {
  console.log(`${lines.length ? "✗" : "✓"} ${change} — ${summary}`);
  for (const line of lines) console.log(line);
}
