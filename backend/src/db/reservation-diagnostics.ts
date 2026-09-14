import { pool } from "./client.js";
import { formatHotelDate, hotelCivilDateToUtc } from "../utils/reservation.js";

function proposedOperationalTimestamp(value: string, hour: number) {
  const current = new Date(value);
  if (Number.isNaN(current.getTime())) return null;
  return hotelCivilDateToUtc(formatHotelDate(current), hour)?.toISOString() ?? null;
}

function timestampDifferenceSeconds(current: string, proposed: string | null) {
  if (!proposed) return null;
  const currentTime = new Date(current).getTime();
  const proposedTime = new Date(proposed).getTime();
  return Number.isFinite(currentTime) && Number.isFinite(proposedTime)
    ? Math.round((proposedTime - currentTime) / 1000)
    : null;
}

async function main() {
  const [statuses, overlaps, overpayments, overdue, timestamps, constraints] = await Promise.all([
    pool.query(`SELECT status, COUNT(*)::int AS count FROM reservations GROUP BY status ORDER BY status`),
    pool.query(`
      SELECT a.id::text AS reservation_id, b.id::text AS conflicting_reservation_id,
             a.room_id::text AS room_id
      FROM reservations a
      JOIN reservations b ON a.room_id = b.room_id AND a.id < b.id
        AND a.status <> 'Cancelada' AND b.status <> 'Cancelada'
        AND a.check_in_date < b.check_out_date AND a.check_out_date > b.check_in_date
      ORDER BY a.id, b.id
    `),
    pool.query(`
      SELECT r.id::text AS reservation_id,
             r.total_price::numeric AS total_price,
             COALESCE(SUM(p.amount), 0)::numeric AS total_paid,
             (COALESCE(SUM(p.amount), 0) - r.total_price)::numeric AS excess
      FROM reservations r
      LEFT JOIN reservation_payments p ON p.reservation_id = r.id
      GROUP BY r.id, r.total_price
      HAVING COALESCE(SUM(p.amount), 0) > r.total_price
      ORDER BY r.id
    `),
    pool.query(`
      SELECT id::text AS reservation_id, status, check_out_date::text AS check_out_date
      FROM reservations
      WHERE status IN ('Pendente', 'Confirmada') AND check_out_date < CURRENT_TIMESTAMP
      ORDER BY check_out_date, id
    `),
    pool.query(`
      SELECT id::text AS id, status,
             check_in_date::text AS check_in_date,
             check_out_date::text AS check_out_date,
             created_at::text AS created_at,
             updated_at::text AS updated_at
      FROM reservations ORDER BY created_at DESC, id DESC LIMIT 10
    `),
    pool.query(`
      SELECT conname, pg_get_constraintdef(oid) AS definition
      FROM pg_constraint
      WHERE conrelid = 'reservations'::regclass
      ORDER BY conname
    `)
  ]);

  const timestampSamples = timestamps.rows.map((row) => {
    const proposedCheckIn = proposedOperationalTimestamp(row.check_in_date, 14);
    const proposedCheckOut = proposedOperationalTimestamp(row.check_out_date, 12);
    return {
      ...row,
      proposed_check_in_date: proposedCheckIn,
      proposed_check_out_date: proposedCheckOut,
      check_in_difference_seconds: timestampDifferenceSeconds(row.check_in_date, proposedCheckIn),
      check_out_difference_seconds: timestampDifferenceSeconds(row.check_out_date, proposedCheckOut),
      migration_action: "review_only_no_automatic_update"
    };
  });

  console.log(JSON.stringify({
    mode: "read-only",
    countsByStatus: statuses.rows,
    activeOverlaps: overlaps.rows,
    overpaidReservations: overpayments.rows,
    overdueReservations: overdue.rows.map((row) => ({ ...row, proposed_action: "manual_review_only" })),
    timestampSamples,
    reservationConstraints: constraints.rows
  }, null, 2));
}

main()
  .catch((error) => {
    console.error("Reservation diagnostic failed:", error instanceof Error ? error.message : "unknown error");
    process.exitCode = 1;
  })
  .finally(async () => pool.end());
