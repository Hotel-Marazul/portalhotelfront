import assert from "node:assert/strict";
import test from "node:test";
import {
  dayLabel,
  dedupeDays,
  deliveryMark,
  formatBRL,
  keepLatestAiMarker,
  mediaLabel,
  newestWaitingAt,
  expectedMessageOrigin,
  extractGaps,
  formatWaiting,
  guestSummary,
  hasUnfilledGap,
  initials,
  intentLabel,
  levelClass,
  levelLabel,
  mergeTimeline,
  messagePreview,
  missingFieldsNotice,
  readingPeriod,
} from "../src/utils/whatsapp.ts";

test("rotula níveis e tempo de espera", () => {
  assert.equal(levelLabel("agora"), "Agora");
  assert.equal(levelLabel("hoje"), "Hoje");
  assert.equal(levelLabel("espera"), "Pode esperar");
  assert.equal(levelClass("agora"), "level-agora");
  assert.equal(formatWaiting("2026-09-18T12:00:00Z", new Date("2026-09-18T12:14:00Z")), "há 14 min");
  assert.equal(formatWaiting("2026-09-18T10:00:00Z", new Date("2026-09-18T12:14:00Z")), "há 2 h");
});

test("monta prévia, iniciais e trechos para completar", () => {
  assert.equal(messagePreview({ direction: "outbound", body: "  Olá  " }), "Você: Olá");
  assert.equal(messagePreview({ direction: "inbound", mediaType: "image" }), "Imagem");
  assert.equal(initials("Fernanda Souza"), "FS");
  assert.deepEqual(extractGaps("Oi [confirmar data] e [número de hóspedes]."), ["[confirmar data]", "[número de hóspedes]"]);
  assert.equal(hasUnfilledGap("[confirmar data]"), true);
  assert.equal(hasUnfilledGap("Tudo certo."), false);
});

test("classifica a origem sem normalizar demais o texto", () => {
  assert.equal(expectedMessageOrigin("Oi  Fernanda", "Oi Fernanda"), "portal_suggestion");
  assert.equal(expectedMessageOrigin("Oi Fernanda!", "Oi Fernanda"), "portal_suggestion_edited");
  assert.equal(expectedMessageOrigin("Resposta", null), "portal_manual");
});

test("mostra o separador de dia em linguagem do dia a dia", () => {
  const agora = new Date(2026, 8, 19, 10, 0, 0);
  assert.equal(dayLabel("2026-09-19", agora), "Hoje");
  assert.equal(dayLabel("2026-09-18", agora), "Ontem");
  assert.equal(dayLabel("2026-09-10", agora), "10 de setembro de 2026");
});

test("traduz a leitura da IA para a linguagem da recepção", () => {
  assert.equal(intentLabel("reserva_nova"), "Pedido de reserva");
  assert.equal(intentLabel("duvida_estadia"), "Dúvida sobre a estadia");
  assert.equal(intentLabel("inexistente"), "Outro assunto");
  assert.equal(readingPeriod("2026-12-12", "2026-12-15", 3), "12/12/2026 a 15/12/2026 · 3 noites");
  assert.equal(readingPeriod(null, null, null), "Sem datas");
  assert.equal(guestSummary(2, []), "2 adultos");
  assert.equal(guestSummary(2, [8]), "2 adultos e 1 criança (8 anos)");
  assert.equal(guestSummary(null, []), "Sem número de pessoas");
  assert.equal(missingFieldsNotice(["dates", "guests"]), "Faltam datas e número de pessoas.");
  assert.equal(missingFieldsNotice(["dates"]), "Faltam datas.");
  assert.equal(missingFieldsNotice([]), null);
});

test("junta páginas da conversa sem repetir dia nem perder o histórico carregado", () => {
  const mensagem = (id, sentAt) => ({ kind: "message", id, direction: "inbound", body: id, sentAt, status: "received" });
  const antigas = [
    { kind: "day", date: "2026-09-18" },
    mensagem("m1", "2026-09-18T10:00:00Z"),
    { kind: "day", date: "2026-09-19" },
    mensagem("m2", "2026-09-19T10:00:00Z"),
  ];

  assert.deepEqual(
    dedupeDays([{ kind: "day", date: "2026-09-19" }, mensagem("m2", "x"), { kind: "day", date: "2026-09-19" }]).length,
    2,
  );

  const recente = [
    { kind: "day", date: "2026-09-19" },
    mensagem("m2", "2026-09-19T10:00:00Z"),
    mensagem("m3", "2026-09-19T11:00:00Z"),
  ];
  const juntas = mergeTimeline(antigas, recente);
  assert.deepEqual(juntas.map((item) => (item.kind === "day" ? `dia ${item.date}` : item.id)), [
    "dia 2026-09-18",
    "m1",
    "dia 2026-09-19",
    "m2",
    "m3",
  ]);

  // Sem página antiga na tela, a resposta do servidor manda.
  assert.deepEqual(mergeTimeline([], recente), recente);
  // Conversa trocada: nada em comum, usa só o que chegou.
  assert.deepEqual(mergeTimeline([mensagem("outra", "2026-09-01T10:00:00Z")], recente), recente);
});

test("mostra status de entrega, mídia e preço como na tela do WhatsApp", () => {
  assert.equal(deliveryMark("inbound", "received"), null);
  assert.equal(deliveryMark("outbound", "sending"), "pending");
  assert.equal(deliveryMark("outbound", "read"), "read");
  assert.equal(deliveryMark("outbound", "failed"), "failed");
  assert.equal(mediaLabel("image"), "Imagem");
  assert.equal(mediaLabel("desconhecido"), "Mensagem");
  assert.equal(formatBRL("1000.00").replace(/\s/g, " "), "R$ 1.000,00");
  assert.equal(formatBRL("abc"), "abc");
});

test("mantém só a leitura mais recente da IA na conversa", () => {
  const items = [
    { kind: "ai_marker", readingId: "r1", text: "a", at: "" },
    { kind: "message", id: "m1" },
    { kind: "ai_marker", readingId: "r2", text: "b", at: "" },
    { kind: "message", id: "m2" },
  ];
  assert.deepEqual(keepLatestAiMarker(items).map((item) => item.readingId ?? item.id), ["m1", "r2", "m2"]);
  assert.deepEqual(keepLatestAiMarker([]), []);
});

test("acha a mensagem mais recente da fila", () => {
  assert.equal(newestWaitingAt([]), 0);
  assert.equal(
    newestWaitingAt([{ lastMessageAt: "2026-10-03T12:00:00Z" }, { lastMessageAt: "2026-10-03T13:00:00Z" }]),
    Date.parse("2026-10-03T13:00:00Z"),
  );
});

test("formata duração de áudio e vídeo", async () => {
  const { formatDuration } = await import("../src/utils/whatsapp.ts");
  assert.equal(formatDuration(12), "0:12");
  assert.equal(formatDuration(65.9), "1:05");
  assert.equal(formatDuration(3903), "1:05:03");
  assert.equal(formatDuration(0), "0:00");
  assert.equal(formatDuration(null), "0:00");
  assert.equal(formatDuration(Number.NaN), "0:00");
  assert.equal(formatDuration(-4), "0:00");
});

test("formata tamanho de arquivo em pt-BR", async () => {
  const { formatFileSize } = await import("../src/utils/whatsapp.ts");
  assert.equal(formatFileSize(512), "512 B");
  assert.equal(formatFileSize(2048), "2 KB");
  assert.equal(formatFileSize(15 * 1024), "15 KB");
  assert.equal(formatFileSize(1.2 * 1024 * 1024), "1,2 MB");
  assert.equal(formatFileSize(16 * 1024 * 1024), "16 MB");
  assert.equal(formatFileSize(null), "");
  assert.equal(formatFileSize(-1), "");
});

test("limita a proporção da mídia na conversa", async () => {
  const { mediaAspectRatio, MEDIA_ASPECT_MIN, MEDIA_ASPECT_MAX } = await import("../src/utils/whatsapp.ts");
  assert.equal(mediaAspectRatio(1600, 1200), 4 / 3);
  assert.equal(mediaAspectRatio(1080, 1920), 1080 / 1920);
  assert.equal(mediaAspectRatio(200, 2000), MEDIA_ASPECT_MIN);
  assert.equal(mediaAspectRatio(4000, 500), MEDIA_ASPECT_MAX);
  assert.equal(mediaAspectRatio(null, 600), 4 / 3);
  assert.equal(mediaAspectRatio(800, 0), 4 / 3);
});

test("monta o endereço da mídia no backend", async () => {
  const { mediaHref, documentTypeLabel } = await import("../src/utils/whatsapp.ts");
  const path = "/api/whatsapp/messages/abc/media";
  assert.equal(mediaHref("http://localhost:5000", path), `http://localhost:5000${path}`);
  assert.equal(mediaHref("http://localhost:5000/", path, true), `http://localhost:5000${path}?download=1`);
  assert.equal(mediaHref(undefined, path), path);
  assert.equal(documentTypeLabel("application/pdf", "contrato.pdf"), "PDF");
  assert.equal(documentTypeLabel("application/octet-stream", "fotos.zip"), "ZIP");
  assert.equal(documentTypeLabel(null, null), "Arquivo");
});
