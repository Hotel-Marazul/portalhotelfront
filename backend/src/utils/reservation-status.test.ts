import assert from "node:assert/strict";
import test from "node:test";
import {
  ACTIVE_RESERVATION_STATUSES,
  BLOCKING_RESERVATION_STATUSES,
  isActiveReservationStatus
} from "./reservation-status.js";

test("separa reserva operacionalmente ativa de estadia que bloqueia datas", () => {
  assert.equal(isActiveReservationStatus("Concluída"), false);
  assert.equal(BLOCKING_RESERVATION_STATUSES.includes("Concluída"), true);
  assert.equal(BLOCKING_RESERVATION_STATUSES.includes("Cancelada"), false);
  assert.equal(ACTIVE_RESERVATION_STATUSES.includes("Cancelada"), false);
});

