import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import test from "node:test";

for (const timezone of ["UTC", "Pacific/Auckland"]) {
  test(`datas civis permanecem estáveis com TZ=${timezone}`, () => {
    const output = execFileSync(
      process.execPath,
      ["--import", "tsx", "--input-type=module", "-e", `
        import { formatHotelDate, resolveReservationStayPeriod } from './src/utils/reservation.ts';
        const period = resolveReservationStayPeriod({ checkInRaw: '2026-09-13', checkOutRaw: '2026-09-19', requireCheckIn: true });
        console.log(JSON.stringify({ checkIn: formatHotelDate(period.checkInDate), checkOut: formatHotelDate(period.checkOutDate) }));
      `],
      { cwd: process.cwd(), env: { ...process.env, TZ: timezone }, encoding: "utf8" }
    );
    const result = JSON.parse(output.trim()) as { checkIn: string; checkOut: string };
    assert.deepEqual(result, { checkIn: "2026-09-13", checkOut: "2026-09-19" });
  });
}
