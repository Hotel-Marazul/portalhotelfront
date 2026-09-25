import assert from "node:assert/strict";
import test from "node:test";
import { scoreConversation, type QueueSignals } from "./scoring.js";

const signals = (overrides: Partial<QueueSignals> = {}): QueueSignals => ({
  intent: "reserva_nova",
  has_dates: false,
  has_guest_count: false,
  is_returning_guest: false,
  is_in_house: false,
  arrives_today: false,
  high_demand: false,
  no_availability: false,
  is_supplier: false,
  unknown_contact: false,
  ...overrides
});

test("pedido completo esperando 14 minutos fica em Hoje com 69", () => {
  const now = new Date("2026-09-18T12:14:00Z");
  const result = scoreConversation(
    signals({ has_dates: true, has_guest_count: true }),
    [],
    { now, awaitingSince: new Date("2026-09-18T12:00:00Z") }
  );
  assert.equal(result.baseScore, 55);
  assert.equal(result.score, 69);
  assert.equal(result.level, "hoje");
  assert.equal(result.waitingText, "Esperando resposta há 14 min");
});

test("problema durante a estadia com hóspede no hotel fica em Agora", () => {
  const result = scoreConversation(
    signals({ intent: "problema_estadia", is_in_house: true }),
    [],
    { now: new Date("2026-09-18T12:04:00Z"), awaitingSince: "2026-09-18T12:00:00Z" }
  );
  assert.equal(result.score, 74);
  assert.equal(result.level, "agora");
});

test("fornecedor nunca supera 39", () => {
  const result = scoreConversation(
    signals({ intent: "problema_estadia", is_supplier: true, is_in_house: true }),
    [],
    { now: new Date("2026-09-18T13:00:00Z"), awaitingSince: "2026-09-18T00:00:00Z" }
  );
  assert.equal(result.score, 39);
  assert.equal(result.level, "espera");
});

test("preço aguardando dez minutos chega a 40", () => {
  const result = scoreConversation(
    signals({ intent: "preco" }),
    [],
    { now: new Date("2026-09-18T12:10:00Z"), awaitingSince: "2026-09-18T12:00:00Z" }
  );
  assert.equal(result.score, 40);
  assert.equal(result.level, "hoje");
});

test("regras de fila contribuem no máximo 25 pontos", () => {
  const rules = [1, 2, 3, 4].map((number) => ({
    condition: { intent: "reserva_nova" },
    weight: 10 as const,
    title: `Regra ${number}`,
    status: "active" as const
  }));
  const result = scoreConversation(signals(), rules);
  assert.equal(result.baseScore, 65);
  assert.equal(result.baseScore - 40, 25);
  assert.equal(result.reasons.length, 4);
});
