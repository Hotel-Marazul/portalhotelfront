import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import type { Server } from "node:http";
import test from "node:test";
import { createApp } from "../../src/app.js";
import { env } from "../../src/config/env.js";
import { pool } from "../../src/db/client.js";
import { initializeDatabase } from "../../src/db/init.js";
import { EvolutionError } from "../../src/modules/whatsapp/evolution-client.js";
import { ingestWebhookPayload } from "../../src/modules/whatsapp/ingestion.service.js";
import type { MediaFetchClient } from "../../src/modules/whatsapp/media.js";
import { backfillMediaRows, fetchMediaNow } from "../../src/modules/whatsapp/media.service.js";
import { getConversationMessages, getQueue } from "../../src/modules/whatsapp/queue.service.js";
import { signAccessToken } from "../../src/utils/jwt.js";

const image = JSON.parse(readFileSync("tests/fixtures/whatsapp/messages-upsert-image-caption.json", "utf8"));
const audio = JSON.parse(readFileSync("tests/fixtures/whatsapp/messages-upsert-audio.json", "utf8"));

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
const OGG = Buffer.from("OggS-fixture-audio");

function scripted(steps: Array<{ mimetype: string | null; data: Buffer } | Error>) {
  const calls: boolean[] = [];
  const client: MediaFetchClient = {
    async getMediaBase64(_id, options) {
      calls.push(options.convertToMp4);
      const step = steps.shift();
      if (!step) throw new Error("chamada inesperada");
      if (step instanceof Error) throw step;
      return { mimetype: step.mimetype, base64: step.data.toString("base64") };
    }
  };
  return { client, calls };
}

async function mediaRow(messageId: string) {
  const result = await pool.query<{ status: string; attempts: number; mimetype: string | null; byte_size: number | null; delay_s: number }>(
    `SELECT status, attempts, mimetype, byte_size,
            EXTRACT(EPOCH FROM (next_attempt_at - NOW()))::int AS delay_s
     FROM whatsapp_media WHERE message_id = $1`,
    [messageId]
  );
  return result.rows[0];
}

test("mídia: ingestão enfileira, worker baixa com fallback, timeline e rota servem os bytes", async () => {
  await initializeDatabase();
  const previousEnabled = env.WHATSAPP_ENABLED;
  const previousMax = env.WHATSAPP_MEDIA_MAX_BYTES;
  env.WHATSAPP_ENABLED = true;

  const phone = `55489${String(Math.floor(Math.random() * 1e8)).padStart(8, "0")}`;
  const remoteJid = `${phone}@s.whatsapp.net`;
  const baseTimestamp = Math.floor(Date.now() / 1000) - 600;
  const ids = { image: `media-img-${randomUUID()}`, audio: `media-aud-${randomUUID()}`, broken: `media-brk-${randomUUID()}` };
  const payload = (fixture: typeof image, id: string, offset: number) => ({
    ...fixture,
    instance: "Marazul",
    data: { ...fixture.data, key: { ...fixture.data.key, remoteJid, id }, messageTimestamp: baseTimestamp + offset }
  });

  const app = createApp();
  const server = await new Promise<Server>((resolve) => {
    const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
  });
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const endpoint = `http://127.0.0.1:${address.port}/api/whatsapp`;
  const users = await pool.query<{ id: string; email: string; role: "admin" | "receptionist" }>(
    "SELECT id, email, role FROM users WHERE role = 'receptionist' LIMIT 1"
  );
  const receptionist = users.rows[0];
  assert.ok(receptionist);
  const headers = { Authorization: `Bearer ${signAccessToken(receptionist)}` };

  try {
    await pool.query("DELETE FROM whatsapp_contacts WHERE remote_jid = $1", [remoteJid]);
    await ingestWebhookPayload(payload(image, ids.image, 0), "Marazul");
    await ingestWebhookPayload(payload(audio, ids.broken, 1), "Marazul");
    await ingestWebhookPayload(payload(audio, ids.audio, 2), "Marazul");
    // Reentrega do webhook não duplica a fila.
    await ingestWebhookPayload(payload(image, ids.image, 0), "Marazul");

    const messages = await pool.query<{ id: string; provider_message_id: string; media_meta: Record<string, unknown>; conversation_id: string }>(
      `SELECT m.id, m.provider_message_id, m.media_meta, m.conversation_id
       FROM whatsapp_messages m
       JOIN whatsapp_conversations c ON c.id = m.conversation_id
       JOIN whatsapp_contacts contact ON contact.id = c.contact_id
       WHERE contact.remote_jid = $1`,
      [remoteJid]
    );
    const byProvider = new Map(messages.rows.map((row) => [row.provider_message_id, row]));
    const imageMessage = byProvider.get(ids.image)!;
    const audioMessage = byProvider.get(ids.audio)!;
    const brokenMessage = byProvider.get(ids.broken)!;
    const conversationId = imageMessage.conversation_id;
    assert.equal(imageMessage.media_meta.width, 512);
    assert.equal(audioMessage.media_meta.seconds, 3);
    assert.equal(audioMessage.media_meta.ptt, true);
    for (const message of [imageMessage, audioMessage, brokenMessage]) {
      assert.equal((await mediaRow(message.id))?.status, "pending");
    }

    // Antes de baixar: timeline mostra pending e prévia do áudio traz a duração.
    const before = await getConversationMessages(conversationId, undefined, undefined, 50);
    const pendingImage = before?.items.find((item) => item.id === imageMessage.id) as { media: Record<string, unknown> };
    assert.equal(pendingImage.media.status, "pending");
    assert.equal(pendingImage.media.url, `/api/whatsapp/messages/${imageMessage.id}/media`);
    assert.match(String(pendingImage.media.thumbnail), /^data:image\/jpeg;base64,\/9j\//);
    assert.equal(pendingImage.media.width, 512);
    const queue = await getQueue("todas");
    const queueItem = queue.waiting.find((item) => item.conversationId === conversationId);
    assert.equal(queueItem?.preview, "Áudio (0:03)");

    const pendingResponse = await fetch(`${endpoint}/messages/${imageMessage.id}/media`, { headers });
    assert.equal(pendingResponse.status, 202);
    assert.deepEqual(await pendingResponse.json(), { status: "pending" });

    // Imagem: uma chamada, sem conversão.
    const imageFetch = scripted([{ mimetype: "image/jpeg", data: JPEG }]);
    assert.equal(await fetchMediaNow(imageMessage.id, { client: imageFetch.client }), "ready");
    assert.deepEqual(imageFetch.calls, [false]);

    // Áudio: conversão para MP4 falha, original OGG é guardado.
    const audioFetch = scripted([new EvolutionError("evolution_4xx", 400), { mimetype: "audio/ogg; codecs=opus", data: OGG }]);
    assert.equal(await fetchMediaNow(audioMessage.id, { client: audioFetch.client }), "ready");
    assert.deepEqual(audioFetch.calls, [true, false]);
    assert.equal((await mediaRow(audioMessage.id))?.mimetype, "audio/ogg; codecs=opus");
    assert.equal((await mediaRow(audioMessage.id))?.byte_size, OGG.length);

    // Falhas seguidas: 30 s, 2 min, 10 min, 30 min e desiste na quinta.
    const expectedDelays = [30, 120, 600, 1800];
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      await pool.query("UPDATE whatsapp_media SET next_attempt_at = NOW() WHERE message_id = $1", [brokenMessage.id]);
      const offline = scripted([new EvolutionError("timeout")]);
      const status = await fetchMediaNow(brokenMessage.id, { client: offline.client });
      const row = await mediaRow(brokenMessage.id);
      assert.equal(row?.attempts, attempt);
      assert.deepEqual(offline.calls, [true]);
      if (attempt < 5) {
        assert.equal(status, "pending");
        assert.ok(Math.abs((row?.delay_s ?? 0) - expectedDelays[attempt - 1]) <= 2, `atraso da tentativa ${attempt}`);
      } else {
        assert.equal(status, "failed");
      }
    }
    // Linha em failed não é baixada de novo sem o botão de tentar de novo.
    assert.equal(await fetchMediaNow(brokenMessage.id, { client: scripted([]).client }), "failed");

    // Timeline depois do download.
    const after = await getConversationMessages(conversationId, undefined, undefined, 50);
    const readyAudio = after?.items.find((item) => item.id === audioMessage.id) as { media: Record<string, unknown> };
    assert.deepEqual(readyAudio.media, {
      status: "ready",
      url: `/api/whatsapp/messages/${audioMessage.id}/media`,
      mimetype: "audio/ogg; codecs=opus",
      fileName: null,
      fileLength: 6914,
      seconds: 3,
      width: null,
      height: null,
      ptt: true,
      thumbnail: null
    });

    // Rota: bytes completos com cabeçalhos de segurança.
    const full = await fetch(`${endpoint}/messages/${imageMessage.id}/media`, { headers });
    assert.equal(full.status, 200);
    assert.equal(full.headers.get("content-type"), "image/jpeg");
    assert.equal(full.headers.get("x-content-type-options"), "nosniff");
    assert.equal(full.headers.get("cache-control"), "private, max-age=86400");
    assert.equal(full.headers.get("content-security-policy"), "default-src 'none'; sandbox");
    assert.equal(full.headers.get("cross-origin-resource-policy"), "same-site");
    assert.equal(full.headers.get("accept-ranges"), "bytes");
    assert.equal(full.headers.get("content-disposition"), "inline");
    assert.deepEqual(Buffer.from(await full.arrayBuffer()), JPEG);

    const download = await fetch(`${endpoint}/messages/${imageMessage.id}/media?download=1`, { headers });
    assert.match(download.headers.get("content-disposition") ?? "", /^attachment; filename="whatsapp-[a-f0-9]{8}\.jpg"/);
    await download.arrayBuffer();

    const partial = await fetch(`${endpoint}/messages/${audioMessage.id}/media`, { headers: { ...headers, Range: "bytes=2-5" } });
    assert.equal(partial.status, 206);
    assert.equal(partial.headers.get("content-range"), `bytes 2-5/${OGG.length}`);
    assert.equal(partial.headers.get("content-length"), "4");
    assert.deepEqual(Buffer.from(await partial.arrayBuffer()), OGG.subarray(2, 6));

    const outside = await fetch(`${endpoint}/messages/${audioMessage.id}/media`, { headers: { ...headers, Range: "bytes=9999-" } });
    assert.equal(outside.status, 416);
    assert.equal(outside.headers.get("content-range"), `bytes */${OGG.length}`);
    await outside.arrayBuffer();

    // Falha: 404 com status; retry volta para pending; segundo retry é conflito.
    const failed = await fetch(`${endpoint}/messages/${brokenMessage.id}/media`, { headers });
    assert.equal(failed.status, 404);
    assert.deepEqual(await failed.json(), { status: "failed" });
    const retry = await fetch(`${endpoint}/messages/${brokenMessage.id}/media/retry`, { method: "POST", headers });
    assert.equal(retry.status, 202);
    await retry.arrayBuffer();
    assert.deepEqual(await mediaRow(brokenMessage.id).then((row) => [row?.status, row?.attempts]), ["pending", 0]);
    const again = await fetch(`${endpoint}/messages/${brokenMessage.id}/media/retry`, { method: "POST", headers });
    assert.equal(again.status, 409);
    await again.arrayBuffer();

    const invalid = await fetch(`${endpoint}/messages/nao-e-uuid/media`, { headers });
    assert.equal(invalid.status, 400);
    await invalid.arrayBuffer();
    const unknown = await fetch(`${endpoint}/messages/${randomUUID()}/media`, { headers });
    assert.equal(unknown.status, 404);
    await unknown.arrayBuffer();

    // Arquivo maior que o limite: nem chama a Evolution.
    env.WHATSAPP_MEDIA_MAX_BYTES = 5000;
    await pool.query("UPDATE whatsapp_media SET next_attempt_at = NOW() WHERE message_id = $1", [brokenMessage.id]);
    assert.equal(await fetchMediaNow(brokenMessage.id, { client: scripted([]).client }), "too_large");
    const tooLarge = await fetch(`${endpoint}/messages/${brokenMessage.id}/media`, { headers });
    assert.equal(tooLarge.status, 404);
    assert.deepEqual(await tooLarge.json(), { status: "too_large" });
    env.WHATSAPP_MEDIA_MAX_BYTES = previousMax;

    // Mensagem antiga sem linha na fila ganha uma no backfill.
    await pool.query("DELETE FROM whatsapp_media WHERE message_id = $1", [imageMessage.id]);
    await backfillMediaRows(10_000);
    assert.equal((await mediaRow(imageMessage.id))?.status, "pending");
    const noRow = await getConversationMessages(conversationId, undefined, undefined, 50);
    await pool.query("DELETE FROM whatsapp_media WHERE message_id = $1", [imageMessage.id]);
    const withoutRow = await getConversationMessages(conversationId, undefined, undefined, 50);
    const missing = withoutRow?.items.find((item) => item.id === imageMessage.id) as { media: { status: string } };
    assert.equal(missing.media.status, "pending");
    assert.ok(noRow);
    // Abrir a conversa coloca a mídia sem linha na fila (ex.: mais antiga que 30 dias).
    assert.equal((await mediaRow(imageMessage.id))?.status, "pending");

    // Rota só de status (sem bytes), usada para mídias fora da janela do polling.
    const statusResponse = await fetch(`${endpoint}/messages/${imageMessage.id}/media/status`, { headers });
    assert.equal(statusResponse.status, 200);
    assert.equal(statusResponse.headers.get("cache-control"), "no-store");
    assert.deepEqual(await statusResponse.json(), { status: "pending" });
    await pool.query("DELETE FROM whatsapp_media WHERE message_id = $1", [imageMessage.id]);
    const statusNoRow = await fetch(`${endpoint}/messages/${imageMessage.id}/media/status`, { headers });
    assert.deepEqual(await statusNoRow.json(), { status: "pending" });
    assert.equal((await mediaRow(imageMessage.id))?.status, "pending");
    const statusUnknown = await fetch(`${endpoint}/messages/${randomUUID()}/media/status`, { headers });
    assert.equal(statusUnknown.status, 404);
    await statusUnknown.arrayBuffer();

    // Apagar a mensagem (retenção) apaga os bytes.
    await pool.query("DELETE FROM whatsapp_messages WHERE id = $1", [audioMessage.id]);
    assert.equal(await mediaRow(audioMessage.id), undefined);
  } finally {
    env.WHATSAPP_MEDIA_MAX_BYTES = previousMax;
    env.WHATSAPP_ENABLED = previousEnabled;
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await pool.query("DELETE FROM whatsapp_contacts WHERE remote_jid = $1", [remoteJid]);
    await pool.end();
  }
});
