import assert from "node:assert/strict";
import test from "node:test";
import { EvolutionClient, EvolutionError } from "./evolution-client.js";

const client = (fetchImpl: typeof fetch, timeoutMs = 100) => new EvolutionClient({
  baseUrl: "http://evolution.test",
  apiKey: "fixture-key",
  instance: "Marazul",
  fetchImpl,
  timeoutMs
});

test("envia texto e lê o id do provedor", async () => {
  let request: RequestInit | undefined;
  const result = await client(async (_url, init) => {
    request = init;
    return new Response(JSON.stringify({ key: { id: "provider-1" } }), { status: 200 });
  }).sendText("+55 (48) 99999-8888", "Olá");
  assert.deepEqual(result, { providerMessageId: "provider-1" });
  assert.equal(request?.method, "POST");
  assert.match(String(request?.body), /"number":"5548999998888"/);
  assert.match(String(request?.body), /"text":"Olá"/);
});

test("lê estado da conexão da Evolution", async () => {
  let requestedUrl = "";
  const result = await client(async (url) => {
    requestedUrl = String(url);
    return new Response(JSON.stringify({ state: "open" }), { status: 200 });
  }).connectionState();
  assert.deepEqual(result, { state: "open" });
  assert.match(requestedUrl, /connectionState\/Marazul$/);
});

test("converte respostas 4xx, 5xx e timeout em motivos curtos", async () => {
  await assert.rejects(
    client(async () => new Response("", { status: 400 })).sendText("5511000000000", "Oi"),
    (error: unknown) => error instanceof EvolutionError && error.reason === "evolution_4xx"
  );
  await assert.rejects(
    client(async () => new Response("", { status: 500 })).sendText("5511000000000", "Oi"),
    (error: unknown) => error instanceof EvolutionError && error.reason === "evolution_5xx"
  );
  await assert.rejects(
    client((_url, init) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" })));
    }), 5).sendText("5511000000000", "Oi"),
    (error: unknown) => error instanceof EvolutionError && error.reason === "timeout"
  );
});
