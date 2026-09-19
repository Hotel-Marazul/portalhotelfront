import { query } from "../../db/client.js";
import { BLOCKING_RESERVATION_STATUSES } from "../../utils/reservation-status.js";

const ROOM_STATUS_MAINTENANCE = "Manutenção";

export interface AvailableRoomRow {
  id: string;
  number: number;
  type: string;
  capacity: number;
  daily_price: string;
  status: string;
  category_id: string;
  single_price: string | null;
  couple_price: string | null;
}

export async function findAvailableRooms(
  checkInDate: Date,
  checkOutDate: Date,
  guestCount: number
) {
  return query<AvailableRoomRow>(
    `
      SELECT rm.id, rm.number, rm.type, rm.capacity,
             rm.daily_price::text AS daily_price, rm.status, rm.category_id,
             c.single_price::text AS single_price, c.couple_price::text AS couple_price
      FROM rooms rm
      INNER JOIN categories c ON c.id = rm.category_id
      WHERE rm.status <> $3
        AND rm.capacity >= $5
        AND NOT EXISTS (
          SELECT 1
          FROM reservations r
          WHERE r.room_id = rm.id
            AND r.status = ANY($4::text[])
            AND r.check_in_date < $2::timestamptz
            AND r.check_out_date > $1::timestamptz
        )
      ORDER BY rm.number ASC
    `,
    [
      checkInDate.toISOString(),
      checkOutDate.toISOString(),
      ROOM_STATUS_MAINTENANCE,
      BLOCKING_RESERVATION_STATUSES,
      guestCount
    ]
  );
}
