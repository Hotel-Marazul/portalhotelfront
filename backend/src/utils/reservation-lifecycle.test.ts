import assert from "node:assert/strict";
import test from "node:test";
import {
  canTransitionReservation,
  isOverdueReservation,
  normalizeReservationStatus,
  transitionTimingError
} from "./reservation-lifecycle.js";

test("a máquina de estados permite apenas o ciclo operacional e cancelamento", () => {
  assert.equal(canTransitionReservation("Pendente", "Confirmada"), true);
  assert.equal(canTransitionReservation("Confirmada", "EmAndamento"), true);
  assert.equal(canTransitionReservation("EmAndamento", "Concluída"), true);
  assert.equal(canTransitionReservation("Pendente", "Cancelada"), true);
  assert.equal(canTransitionReservation("EmAndamento", "Cancelada"), false);
  assert.equal(canTransitionReservation("Concluída", "Pendente"), false);
  assert.equal(canTransitionReservation("Cancelada", "Confirmada"), false);
  assert.equal(normalizeReservationStatus("Concluida"), "Concluída");
});

test("o início da hospedagem respeita o intervalo operacional", () => {
  const checkIn = new Date("2026-09-13T14:00:00Z");
  const checkOut = new Date("2026-09-14T12:00:00Z");
  assert.match(
    transitionTimingError("EmAndamento", checkIn, checkOut, new Date("2026-09-13T13:59:59Z")) ?? "",
    /check-in/
  );
  assert.equal(transitionTimingError("EmAndamento", checkIn, checkOut, new Date("2026-09-13T14:00:00Z")), null);
  assert.match(
    transitionTimingError("EmAndamento", checkIn, checkOut, new Date("2026-09-14T12:00:00Z")) ?? "",
    /check-out/
  );
});

test("uma pendência vencida é uma consulta, não uma transição automática", () => {
  const now = new Date("2026-09-13T12:00:00Z");
  assert.equal(isOverdueReservation("Pendente", new Date("2026-09-12T17:00:00Z"), now), true);
  assert.equal(isOverdueReservation("Confirmada", new Date("2026-09-12T17:00:00Z"), now), true);
  assert.equal(isOverdueReservation("Pendente", new Date("2026-09-14T17:00:00Z"), now), false);
});
