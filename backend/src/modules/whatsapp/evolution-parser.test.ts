import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { parseEvolutionEvent } from "./evolution-parser.js";

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
