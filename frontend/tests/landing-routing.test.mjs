import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import ts from "typescript";
import { NextRequest } from "next/server.js";

// Exercise the actual middleware with Next's request/response implementation.
const source = readFileSync(new URL("../middleware.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const middlewareModule = {};
new Function("exports", "require", compiled)(middlewareModule, createRequire(import.meta.url));
const { middleware } = middlewareModule;
const token = (exp, role) => `fixture.${Buffer.from(JSON.stringify({ exp, role })).toString("base64url")}.fixture`;
const request = (path, cookie) => new NextRequest(`https://hotel.example${path}`, {
  headers: cookie ? { cookie: `auth_token=${cookie}` } : {},
});

test("the hotel landing is public with no cookie, active cookie or expired cookie", () => {
  for (const cookie of [undefined, token(Date.now() / 1000 + 3600), token(1)]) {
    const response = middleware(request("/", cookie));
    assert.equal(response.headers.get("x-middleware-next"), "1");
    assert.equal(response.headers.get("location"), null);
  }
});

test("operational routes still send unauthenticated visitors to login", () => {
  for (const path of ["/dashboard", "/reservas", "/cliente", "/agente", "/quarto", "/categoria"]) {
    assert.equal(middleware(request(path)).headers.get("location"), "https://hotel.example/login");
  }
});

test("expired staff sessions still expire on protected pages", () => {
  const response = middleware(request("/reservas", token(1)));
  assert.equal(response.headers.get("location"), "https://hotel.example/login");
  assert.match(response.headers.get("set-cookie"), /auth_token=;/);
});

test("login is available to visitors and keeps its staff redirect", () => {
  assert.equal(middleware(request("/login")).headers.get("x-middleware-next"), "1");
  assert.equal(middleware(request("/login", token(Date.now() / 1000 + 3600))).headers.get("location"), "https://hotel.example/dashboard");
});

test("signed-in staff land on their own home: managers on Gestão, reception on Hoje", () => {
  const inAnHour = Date.now() / 1000 + 3600;
  assert.equal(middleware(request("/login", token(inAnHour, "admin"))).headers.get("location"), "https://hotel.example/gestao");
  assert.equal(middleware(request("/login", token(inAnHour, "receptionist"))).headers.get("location"), "https://hotel.example/dashboard");
});

test("reception is sent from Gestão to Hoje; managers stay", () => {
  const inAnHour = Date.now() / 1000 + 3600;
  assert.equal(middleware(request("/gestao", token(inAnHour, "receptionist"))).headers.get("location"), "https://hotel.example/dashboard");
  assert.equal(middleware(request("/gestao", token(inAnHour, "admin"))).headers.get("x-middleware-next"), "1");
});
