import assert from "node:assert/strict";
import test from "node:test";
import {
  addReservationCalendarDays,
  formatReservationCalendarDate,
  formatReservationDisplayDate,
  formatReservationPickerDate,
  parseReservationDate,
  parseReservationPickerDate,
} from "../src/utils/reservation.ts";

test("mantém datas civis da reserva no fuso do hotel", () => {
  const date = parseReservationDate("2026-09-13");
  assert.equal(formatReservationCalendarDate(date), "2026-09-13");
  assert.equal(formatReservationPickerDate(parseReservationPickerDate("2026-09-13")), "2026-09-13");
  assert.match(
    formatReservationDisplayDate("2026-09-13", { day: "2-digit", month: "2-digit", year: "numeric" }),
    /13\/09\/2026/
  );
});

test("avança dias civis sem depender do fuso do navegador", () => {
  assert.equal(formatReservationCalendarDate(addReservationCalendarDays("2026-09-13", 1)), "2026-09-14");
  assert.equal(formatReservationCalendarDate(addReservationCalendarDays("2026-09-13", -1)), "2026-09-12");
});

test("converte timestamp operacional para o dia civil do hotel", () => {
  const timestamp = "2026-09-13T02:00:00.000Z";
  assert.match(
    formatReservationDisplayDate(timestamp, { day: "2-digit", month: "2-digit", year: "numeric" }),
    /12\/09\/2026/
  );
  assert.equal(formatReservationPickerDate(parseReservationPickerDate(timestamp)), "2026-09-12");
});
