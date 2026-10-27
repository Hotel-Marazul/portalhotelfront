import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { extractMediaMeta, parseEvolutionEvent } from "./evolution-parser.js";

const fixtures = fileURLToPath(new URL("../../../tests/fixtures/whatsapp/", import.meta.url));

function fixture(name: string): unknown {
  return JSON.parse(readFileSync(`${fixtures}/${name}`, "utf8"));
}

test("converte mensagens, status e conexão das fixtures da Evolution", () => {
  const inbound = parseEvolutionEvent(fixture("messages-upsert-inbound-text.json"), "Marazul");
  assert.equal(inbound.kind, "message");
  if (inbound.kind === "message") {
    assert.equal(inbound.fromMe, false);
    assert.equal(inbound.mediaType, "text");
    assert.equal(inbound.body, "mensagem fictícia");
    assert.equal(inbound.providerMessageId, "fixture-message-021");
  }

  const image = parseEvolutionEvent(fixture("messages-upsert-image-caption.json"), "Marazul");
  assert.deepEqual(
    image.kind === "message" ? { mediaType: image.mediaType, body: image.body } : image,
    { mediaType: "image", body: "" }
  );

  const audio = parseEvolutionEvent(fixture("messages-upsert-audio.json"), "Marazul");
  assert.equal(audio.kind, "message");
  if (audio.kind === "message") assert.equal(audio.mediaType, "audio");

  const outbound = parseEvolutionEvent(fixture("messages-upsert-outbound-text.json"), "Marazul");
  assert.equal(outbound.kind, "message");
  if (outbound.kind === "message") assert.equal(outbound.status, "sent");

  const delivered = parseEvolutionEvent(fixture("messages-update-delivery.json"), "Marazul");
  assert.equal(delivered.kind, "status");
  if (delivered.kind === "status") assert.equal(delivered.status, "delivered");

  const read = parseEvolutionEvent(fixture("messages-update-read.json"), "Marazul");
  assert.equal(read.kind, "status");
  if (read.kind === "status") assert.equal(read.status, "read");

  for (const name of ["connection-update-open.json", "connection-update-connecting.json", "connection-update-close.json"]) {
    const connection = parseEvolutionEvent(fixture(name), "Marazul");
    assert.equal(connection.kind, "connection");
  }
});

test("ignora grupos, broadcasts, reações e eventos desconhecidos", () => {
  const base = fixture("messages-upsert-inbound-text.json") as Record<string, unknown>;
  const data = base.data as Record<string, unknown>;
  const key = data.key as Record<string, unknown>;

  const group = parseEvolutionEvent({ ...base, data: { ...data, key: { ...key, remoteJid: "120000000000000000@g.us" } } });
  assert.equal(group.kind, "ignored");
  if (group.kind === "ignored") assert.equal(group.reason, "group");

  const broadcast = parseEvolutionEvent({ ...base, data: { ...data, key: { ...key, remoteJid: "status@broadcast" } } });
  assert.equal(broadcast.kind, "ignored");
  if (broadcast.kind === "ignored") assert.equal(broadcast.reason, "broadcast");

  const reaction = parseEvolutionEvent(fixture("messages-upsert-inbound-reaction.json"));
  assert.equal(reaction.kind, "ignored");
  if (reaction.kind === "ignored") assert.equal(reaction.reason, "reaction");

  const unknown = parseEvolutionEvent({ event: "messages.delete", instance: "Marazul", data: {} });
  assert.equal(unknown.kind, "ignored");
  if (unknown.kind === "ignored") assert.equal(unknown.reason, "ignored_event");

  const wrongInstance = parseEvolutionEvent(base, "OutraInstancia");
  assert.equal(wrongInstance.kind, "ignored");
  if (wrongInstance.kind === "ignored") assert.equal(wrongInstance.reason, "unknown_instance");
});

test("extrai metadados de mídia da imagem e do áudio das fixtures", () => {
  const image = parseEvolutionEvent(fixture("messages-upsert-image-caption.json"), "Marazul");
  assert.equal(image.kind, "message");
  if (image.kind === "message") {
    assert.equal(image.mediaMeta?.fileLength, 11811);
    assert.equal(image.mediaMeta?.width, 512);
    assert.equal(image.mediaMeta?.height, 512);
    assert.equal(image.mediaMeta?.mimetype, "application/octet-stream");
    assert.equal(typeof image.mediaMeta?.thumbnail, "string");
    // Objeto de bytes vira base64 de um JPEG (começa com FF D8 FF).
    assert.ok(image.mediaMeta?.thumbnail?.startsWith("/9j/"));
  }

  const audio = parseEvolutionEvent(fixture("messages-upsert-audio.json"), "Marazul");
  assert.equal(audio.kind, "message");
  if (audio.kind === "message") {
    assert.deepEqual(audio.mediaMeta, {
      mimetype: "application/octet-stream",
      fileLength: 6914,
      seconds: 3,
      ptt: true
    });
  }

  const textMessage = parseEvolutionEvent(fixture("messages-upsert-inbound-text.json"), "Marazul");
  if (textMessage.kind === "message") assert.equal(textMessage.mediaMeta, null);
});

test("normaliza fileLength, miniatura e nome de documento", () => {
  assert.equal(extractMediaMeta({ fileLength: "2048" }).fileLength, 2048);
  assert.equal(extractMediaMeta({ fileLength: { low: 5, high: 1, unsigned: true } }).fileLength, 4_294_967_301);
  assert.equal(extractMediaMeta({ fileLength: { low: -1, high: 0 } }).fileLength, 4_294_967_295);
  assert.equal(extractMediaMeta({ fileLength: "abc" }).fileLength, undefined);

  assert.equal(extractMediaMeta({ jpegThumbnail: "/9j/AAAA" }).thumbnail, "/9j/AAAA");
  assert.equal(extractMediaMeta({ jpegThumbnail: { 0: 255, 1: 216, 2: 255 } }).thumbnail, "/9j/");
  assert.equal(extractMediaMeta({ jpegThumbnail: [255, 216, 255] }).thumbnail, "/9j/");
  assert.equal(extractMediaMeta({ jpegThumbnail: { type: "Buffer", data: [255, 216, 255] } }).thumbnail, "/9j/");
  assert.equal(extractMediaMeta({ jpegThumbnail: "não é base64!" }).thumbnail, undefined);
  assert.equal(extractMediaMeta({ jpegThumbnail: "A".repeat(12_004) }).thumbnail, undefined);
  assert.equal(extractMediaMeta({ jpegThumbnail: "A".repeat(12_000) }).thumbnail?.length, 12_000);

  assert.equal(extractMediaMeta({ fileName: "contrato.pdf", title: "outro" }).fileName, "contrato.pdf");
  assert.equal(extractMediaMeta({ title: "planilha.xlsx" }).fileName, "planilha.xlsx");
  assert.equal(extractMediaMeta({ fileName: "reserva\u202Efdp.exe" }).fileName, "reservafdp.exe");
  assert.equal(extractMediaMeta({ fileName: "a\u0000b\nc.pdf" }).fileName, "abc.pdf");
  assert.deepEqual(extractMediaMeta({}), {});
});

test("documento dentro de documentWithCaptionMessage traz legenda e nome", () => {
  const base = fixture("messages-upsert-inbound-text.json") as Record<string, unknown>;
  const data = base.data as Record<string, unknown>;
  const parsed = parseEvolutionEvent({
    ...base,
    data: {
      ...data,
      message: {
        documentWithCaptionMessage: {
          message: {
            documentMessage: {
              caption: "segue o comprovante",
              fileName: "comprovante.pdf",
              mimetype: "application/pdf",
              fileLength: "34567"
            }
          }
        }
      }
    }
  }, "Marazul");
  assert.equal(parsed.kind, "message");
  if (parsed.kind === "message") {
    assert.equal(parsed.mediaType, "document");
    assert.equal(parsed.body, "segue o comprovante");
    assert.deepEqual(parsed.mediaMeta, { mimetype: "application/pdf", fileName: "comprovante.pdf", fileLength: 34567 });
  }
});

test("contato @lid usa o telefone de remoteJidAlt e, sem ele, mantém o LID", () => {
  const message = (key: Record<string, unknown>) => parseEvolutionEvent({
    event: "messages.upsert",
    instance: "Marazul",
    data: { key: { id: "lid-1", fromMe: false, ...key }, messageTimestamp: 1792941354, message: { conversation: "oi" } }
  }, "Marazul");

  const withAlt = message({ remoteJid: "124034931023981@lid", remoteJidAlt: "555198568783@s.whatsapp.net" });
  assert.equal(withAlt.kind === "message" ? withAlt.remoteJid : withAlt.kind, "555198568783@s.whatsapp.net");

  const lidOnly = message({ remoteJid: "76923602514155@lid" });
  assert.equal(lidOnly.kind === "message" ? lidOnly.remoteJid : lidOnly.kind, "76923602514155@lid");
});
