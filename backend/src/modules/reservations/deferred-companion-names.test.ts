import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { createReservationSchema, reservationQuoteSchema, updateReservationSchema } from "./reservations.schema.js";

const body = { roomId: randomUUID(), clientId: randomUUID(), checkInDate: "2026-12-29", checkOutDate: "2027-01-03", guests: [{ age: 18 }, { name: "  ", age: 11 }], idempotencyKey: randomUUID() };

test("reserva, cotação e edição aceitam nomes pendentes mantendo todos os acompanhantes e idades", () => {
  for (const schema of [createReservationSchema, reservationQuoteSchema, updateReservationSchema]) {
    const parsed = schema.parse({ ...body, version: 1 });
    assert.deepEqual(parsed.guests?.map(({ name, age }) => ({ name, age })), [{ name: "", age: 18 }, { name: "", age: 11 }]);
  }
});

test("nome informado e idade mantêm validação mesmo com identificação adiada", () => {
  for (const guest of [{ name: "A", age: 11 }, { name: "x".repeat(201), age: 11 }, { age: -1 }, { age: 121 }, { name: "Ana" }]) {
    assert.equal(createReservationSchema.safeParse({ ...body, guests: [guest] }).success, false);
  }
  assert.equal(createReservationSchema.parse({ ...body, guests: [{ name: " Ana ", age: 11 }] }).guests[0].name, "Ana");
});
