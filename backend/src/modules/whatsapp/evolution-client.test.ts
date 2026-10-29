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

test("reutiliza instância existente e devolve o QR sem outros campos da Evolution", async () => {
  const requestedUrls: string[] = [];
  const result = await client(async (url) => {
    requestedUrls.push(String(url));
    if (String(url).includes("fetchInstances")) {
      return new Response(JSON.stringify([{
        name: "Marazul",
        connectionStatus: "close",
        token: "never-return-this"
      }]), { status: 200 });
    }
    return new Response(JSON.stringify({
      base64: "data:image/png;base64,fixture",
      code: "raw-qr-payload",
      pairingCode: "12345678"
    }), { status: 200 });
  }).connectionQr();

  assert.deepEqual(result, {
    state: "connecting",
    qrCode: "data:image/png;base64,fixture"
  });
  assert.equal(JSON.stringify(result).includes("never-return-this"), false);
  assert.match(requestedUrls[0], /fetchInstances\?instanceName=Marazul$/);
  assert.match(requestedUrls[1], /connect\/Marazul$/);
});

test("cria a instância quando ela ainda não existe e solicita QR", async () => {
  const requests: Array<{ url: string; init?: RequestInit }> = [];
  const result = await client(async (url, init) => {
    requests.push({ url: String(url), init });
    if (String(url).includes("fetchInstances")) {
      return new Response(JSON.stringify([]), { status: 200 });
    }
    return new Response(JSON.stringify({
      instance: { instanceName: "Marazul", status: "connecting" },
      hash: { apikey: "never-return-this" },
      qrcode: { base64: "data:image/png;base64,bmV3LWluc3RhbmNl" }
    }), { status: 201 });
  }).connectionQr();

  assert.deepEqual(result, {
    state: "connecting",
    qrCode: "data:image/png;base64,bmV3LWluc3RhbmNl"
  });
  assert.match(requests[1].url, /instance\/create$/);
  assert.equal(requests[1].init?.method, "POST");
  assert.deepEqual(JSON.parse(String(requests[1].init?.body)), {
    instanceName: "Marazul",
    integration: "WHATSAPP-BAILEYS",
    qrcode: true
  });
});

test("cria a instância e cadastra o webhook com o segredo e os eventos tratados", async () => {
  const requests: Array<{ url: string; init?: RequestInit }> = [];
  const result = await new EvolutionClient({
    baseUrl: "http://evolution.test",
    apiKey: "fixture-key",
    instance: "Marazul",
    webhook: { url: "http://backend:5000/api/whatsapp/webhook", secret: "fixture-secret" },
    fetchImpl: async (url, init) => {
      requests.push({ url: String(url), init });
      if (String(url).includes("fetchInstances")) return new Response(JSON.stringify([]), { status: 200 });
      if (String(url).includes("webhook/set")) return new Response(JSON.stringify({ webhook: {} }), { status: 201 });
      return new Response(JSON.stringify({ qrcode: { base64: "data:image/png;base64,cXI=" } }), { status: 201 });
    }
  }).connectionQr();

  assert.equal(result.qrCode, "data:image/png;base64,cXI=");
  assert.match(requests[2].url, /webhook\/set\/Marazul$/);
  assert.deepEqual(JSON.parse(String(requests[2].init?.body)), {
    webhook: {
      enabled: true,
      url: "http://backend:5000/api/whatsapp/webhook",
      headers: { "x-webhook-secret": "fixture-secret" },
      byEvents: false,
      base64: false,
      events: ["MESSAGES_UPSERT", "MESSAGES_UPDATE", "CONNECTION_UPDATE"]
    }
  });
});

test("instância já conectada também tem o webhook conferido; sem configuração, nada é chamado", async () => {
  const urls: string[] = [];
  const fetchImpl = (async (url: string | URL | Request) => {
    urls.push(String(url));
    if (String(url).includes("fetchInstances")) {
      return new Response(JSON.stringify([{ name: "Marazul", connectionStatus: "open" }]), { status: 200 });
    }
    return new Response(JSON.stringify({}), { status: 201 });
  }) as typeof fetch;
  const options = { baseUrl: "http://evolution.test", apiKey: "fixture-key", instance: "Marazul", fetchImpl };

  await new EvolutionClient({ ...options, webhook: { url: "http://backend:5000/api/whatsapp/webhook", secret: "s" } }).connectionQr();
  assert.ok(urls.some((url) => url.includes("webhook/set/Marazul")));

  urls.length = 0;
  await new EvolutionClient(options).connectionQr();
  assert.ok(!urls.some((url) => url.includes("webhook/set")));
});

test("trata 404 da busca filtrada como instância ausente", async () => {
  const requests: string[] = [];
  const result = await client(async (url) => {
    requests.push(String(url));
    if (String(url).includes("fetchInstances")) {
      return new Response(JSON.stringify({ status: 404 }), { status: 404 });
    }
    return new Response(JSON.stringify({
      instance: { instanceName: "Marazul", status: "connecting" },
      qrcode: { base64: "data:image/png;base64,bmV3LWluc3RhbmNl" }
    }), { status: 201 });
  }).connectionQr();

  assert.deepEqual(result, {
    state: "connecting",
    qrCode: "data:image/png;base64,bmV3LWluc3RhbmNl"
  });
  assert.match(requests[1], /instance\/create$/);
});

test("não solicita QR quando a instância já está conectada", async () => {
  let calls = 0;
  const result = await client(async () => {
    calls += 1;
    return new Response(JSON.stringify([{
      name: "Marazul",
      connectionStatus: "open",
      token: "never-return-this"
    }]), { status: 200 });
  }).connectionQr();

  assert.deepEqual(result, { state: "open", qrCode: null });
  assert.equal(calls, 1);
});

test("recusa resposta de QR sem imagem válida", async () => {
  await assert.rejects(
    client(async (url) => String(url).includes("fetchInstances")
      ? new Response(JSON.stringify([{ name: "Marazul", connectionStatus: "close" }]), { status: 200 })
      : new Response(JSON.stringify({ code: "raw-qr-payload" }), { status: 200 })
    ).connectionQr(),
    (error: unknown) => error instanceof EvolutionError && error.reason === "invalid_response"
  );
});

test("desconecta a instância sem excluí-la", async () => {
  let requestedUrl = "";
  let requestedMethod = "";
  await client(async (url, init) => {
    requestedUrl = String(url);
    requestedMethod = String(init?.method);
    return new Response(JSON.stringify({ status: "SUCCESS", error: false }), { status: 200 });
  }).logout();

  assert.match(requestedUrl, /logout\/Marazul$/);
  assert.equal(requestedMethod, "DELETE");
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

test("baixa mídia pela Evolution e remove prefixo data:", async () => {
  let requestedUrl = "";
  let requestBody = "";
  const result = await client(async (url, init) => {
    requestedUrl = String(url);
    requestBody = String(init?.body);
    return new Response(JSON.stringify({
      mediaType: "audioMessage",
      mimetype: "audio/mp4",
      base64: "data:audio/mp4;base64,AAEC",
      size: { fileLength: "3" }
    }), { status: 200 });
  }).getMediaBase64("provider-9", { convertToMp4: true });
  assert.deepEqual(result, { mimetype: "audio/mp4", base64: "AAEC" });
  assert.match(requestedUrl, /chat\/getBase64FromMediaMessage\/Marazul$/);
  assert.deepEqual(JSON.parse(requestBody), { message: { key: { id: "provider-9" } }, convertToMp4: true });
});

test("mídia sem base64 válido ou maior que o limite vira erro tipado", async () => {
  await assert.rejects(
    client(async () => new Response(JSON.stringify({ mimetype: "image/jpeg", base64: "" }), { status: 200 }))
      .getMediaBase64("x", { convertToMp4: false }),
    (error: unknown) => error instanceof EvolutionError && error.reason === "invalid_response"
  );
  await assert.rejects(
    client(async () => new Response(JSON.stringify({ message: "Failed to convert audio to MP4" }), { status: 400 }))
      .getMediaBase64("x", { convertToMp4: true }),
    (error: unknown) => error instanceof EvolutionError && error.reason === "evolution_4xx"
  );
  await assert.rejects(
    client(async () => new Response("x".repeat(2_000_000), {
      status: 200,
      headers: { "content-length": "2000000" }
    })).getMediaBase64("x", { convertToMp4: false, maxBytes: 1_000_000 }),
    (error: unknown) => error instanceof EvolutionError && error.reason === "too_large"
  );
});

test("mídia em streaming sem content-length acima do limite é cortada antes de juntar tudo", async () => {
  let pulled = 0;
  let cancelled = false;
  let acceptEncoding: string | null = null;
  const chunk = new TextEncoder().encode("A".repeat(64 * 1024));
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      pulled += 1;
      if (pulled > 1000) controller.close();
      else controller.enqueue(chunk);
    },
    cancel() {
      cancelled = true;
    }
  });
  await assert.rejects(
    client(async (_url, init) => {
      acceptEncoding = new Headers(init?.headers).get("accept-encoding");
      return new Response(stream, { status: 200 });
    }).getMediaBase64("x", { convertToMp4: false, maxBytes: 1_000_000 }),
    (error: unknown) => error instanceof EvolutionError && error.reason === "too_large"
  );
  assert.equal(acceptEncoding, "identity");
  assert.ok(cancelled, "a leitura do corpo deve ser cancelada");
  assert.ok(pulled < 40, `leu ${pulled} blocos; deveria parar logo depois de ~1,4 MB`);
});

test("o prazo da mídia cobre a leitura do corpo, não só os cabeçalhos", async () => {
  await assert.rejects(
    client(async (_url, init) => {
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new TextEncoder().encode("{\"base64\":\""));
          init?.signal?.addEventListener("abort", () => controller.error(Object.assign(new Error("aborted"), { name: "AbortError" })));
        }
      });
      return new Response(stream, { status: 200 });
    }).getMediaBase64("x", { convertToMp4: false, timeoutMs: 20 }),
    (error: unknown) => error instanceof EvolutionError && error.reason === "timeout"
  );
});

test("envia para o JID quando o contato é @lid", async () => {
  let request: RequestInit | undefined;
  await client(async (_url, init) => {
    request = init;
    return new Response(JSON.stringify({ key: { id: "provider-lid" } }), { status: 200 });
  }).sendText("76923602514155@lid", "Olá");
  assert.match(String(request?.body), /"number":"76923602514155@lid"/);
});

test("pagina mensagens guardadas e lista contatos", async () => {
  const requests: Array<{ url: string; body: string }> = [];
  const evolution = client(async (url, init) => {
    requests.push({ url: String(url), body: String(init?.body) });
    if (String(url).includes("findContacts")) {
      return new Response(JSON.stringify([{ remoteJid: "1@lid", pushName: "Ana" }, { pushName: "sem jid" }]), { status: 200 });
    }
    return new Response(JSON.stringify({ messages: { total: 3, pages: 2, currentPage: 1, records: [{ id: "a" }, "lixo"] } }), { status: 200 });
  });

  assert.deepEqual(await evolution.findMessages(1, 2), { records: [{ id: "a" }], pages: 2 });
  assert.equal(requests[0]?.url, "http://evolution.test/chat/findMessages/Marazul");
  assert.deepEqual(JSON.parse(requests[0]?.body ?? "{}"), { where: {}, page: 1, offset: 2 });
  assert.deepEqual(await evolution.findContacts(), [{ remoteJid: "1@lid", pushName: "Ana" }]);

  await assert.rejects(
    client(async () => new Response(JSON.stringify({ messages: {} }), { status: 200 })).findMessages(1, 2),
    (error) => error instanceof EvolutionError && error.reason === "invalid_response"
  );
});
