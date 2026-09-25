import assert from "node:assert/strict";
import test from "node:test";
import {
  dayLabel,
  dedupeDays,
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
