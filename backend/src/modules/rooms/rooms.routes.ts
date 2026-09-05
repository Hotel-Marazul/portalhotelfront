import { randomUUID } from "crypto";
import { Router } from "express";
import { query } from "../../db/client.js";
import { requireRole } from "../../middlewares/require-role.js";
import { validate } from "../../middlewares/validate.js";
import { HttpError } from "../../utils/http-error.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { normalizeReservationDateInput, resolveReservationStayPeriod } from "../../utils/reservation.js";
import { createRoomSchema, roomIdSchema, updateRoomSchema } from "./rooms.schema.js";

interface RoomRow {
  id: string;
  number: number;
  type: string;
  capacity: number;
  daily_price: string;
  status: string;
  category_id: string;
}

const ROOM_STATUS_AVAILABLE = "Dispon\u00edvel";
const ROOM_STATUS_MAINTENANCE = "Manuten\u00e7\u00e3o";
const ACTIVE_RESERVATION_STATUSES = ["Pendente", "Confirmada", "EmAndamento"];

function normalizeRoomOperationalStatus(status: string) {
  const normalized = status
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  if (normalized === "manutencao") return ROOM_STATUS_MAINTENANCE;
  return ROOM_STATUS_AVAILABLE;
}

function toRoomResponse(room: RoomRow) {
  const dailyPrice = Number(room.daily_price);

  return {
    id: room.id,
    number: room.number,
    type: room.type,
    capacity: room.capacity,
    price: dailyPrice,
    status: normalizeRoomOperationalStatus(room.status),
    categoryId: room.category_id,
    dailyPrice
  };
}

export const roomsRouter = Router();

roomsRouter.get(
  "/rooms/availability",
  asyncHandler(async (req, res) => {
    const checkInRaw = typeof req.query.checkIn === "string" ? req.query.checkIn : undefined;
    const checkOutRaw = typeof req.query.checkOut === "string" ? req.query.checkOut : undefined;

    if (!checkInRaw) {
      throw new HttpError(400, "Parametro checkIn obrigatorio.");
    }
    if (!normalizeReservationDateInput(checkInRaw, "checkIn")) {
      throw new HttpError(400, "Parametro checkIn invalido.");
    }

    const stayPeriod = resolveReservationStayPeriod({
      checkInRaw,
      checkOutRaw,
      requireCheckIn: true
    });
    if (!stayPeriod) {
      throw new HttpError(400, "checkOut deve ser posterior ao checkIn.");
    }
    const { checkInDate, checkOutDate } = stayPeriod;

    const rooms = await query<RoomRow>(
      `
        SELECT rm.id, rm.number, rm.type, rm.capacity, rm.daily_price::text AS daily_price, rm.status, rm.category_id
        FROM rooms rm
        WHERE rm.status <> $3
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
      [checkInDate.toISOString(), checkOutDate.toISOString(), ROOM_STATUS_MAINTENANCE, ACTIVE_RESERVATION_STATUSES]
    );

    res.json(rooms.map(toRoomResponse));
  })
);

roomsRouter.get(
  "/rooms",
  asyncHandler(async (_req, res) => {
    const rooms = await query<RoomRow>(
      `
        SELECT id, number, type, capacity, daily_price::text AS daily_price, status, category_id
        FROM rooms
        ORDER BY number ASC
      `
    );
    res.json(rooms.map(toRoomResponse));
  })
);

roomsRouter.get(
  "/Rooms",
  asyncHandler(async (_req, res) => {
    const rooms = await query<RoomRow>(
      `
        SELECT id, number, type, capacity, daily_price::text AS daily_price, status, category_id
        FROM rooms
        ORDER BY number ASC
      `
    );
    res.json(rooms.map(toRoomResponse));
  })
);

roomsRouter.get(
  "/rooms/summary",
  asyncHandler(async (req, res) => {
    const checkInRaw = typeof req.query.checkIn === "string" ? req.query.checkIn : undefined;
    const checkOutRaw = typeof req.query.checkOut === "string" ? req.query.checkOut : undefined;

    const stayPeriod = resolveReservationStayPeriod({
      checkInRaw,
      checkOutRaw,
      requireCheckIn: false
    });
    if (!stayPeriod) {
      throw new HttpError(400, "checkOut deve ser posterior ao checkIn.");
    }
    const { checkInDate, checkOutDate } = stayPeriod;

    const rows = await query<{ ocupados: number; manutencao: number; operacionais: number }>(
      `
        SELECT
          COUNT(*) FILTER (WHERE rm.status = $3)::int AS manutencao,
          COUNT(*) FILTER (WHERE rm.status <> $3)::int AS operacionais,
          COUNT(DISTINCT rm.id) FILTER (
            WHERE rm.status <> $3
              AND r.id IS NOT NULL
          )::int AS ocupados
        FROM rooms rm
        LEFT JOIN reservations r
          ON r.room_id = rm.id
         AND r.status = ANY($4::text[])
         AND r.check_in_date < $2::timestamptz
         AND r.check_out_date > $1::timestamptz
      `,
      [checkInDate.toISOString(), checkOutDate.toISOString(), ROOM_STATUS_MAINTENANCE, ACTIVE_RESERVATION_STATUSES]
    );

    const summary = rows[0] ?? { ocupados: 0, manutencao: 0, operacionais: 0 };
    const disponiveis = Math.max(0, summary.operacionais - summary.ocupados);

    res.json({
      checkIn: checkInDate.toISOString(),
      checkOut: checkOutDate.toISOString(),
      ocupados: summary.ocupados,
      disponiveis,
      manutencao: summary.manutencao
    });
  })
);

roomsRouter.post(
  "/Rooms",
  requireRole("admin"),
  validate({ body: createRoomSchema }),
  asyncHandler(async (req, res) => {
    const numberInUse = await query<{ id: string }>(`SELECT id FROM rooms WHERE number = $1 LIMIT 1`, [
      req.body.roomNumber
    ]);
    if (numberInUse.length > 0) {
      throw new HttpError(409, "Ja existe um quarto com esse numero.");
    }

    const categories = await query<{ id: string; name: string; price: string }>(
      `
        SELECT id, name, price::text AS price
        FROM categories
        WHERE id = $1
        LIMIT 1
      `,
      [req.body.categoryId]
    );
    const category = categories[0];
    if (!category) {
      throw new HttpError(404, "Categoria nao encontrada.");
    }

    const roomId = randomUUID();
    await query(
      `
        INSERT INTO rooms (id, number, type, capacity, daily_price, status, category_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `,
      [
        roomId,
        req.body.roomNumber,
        category.name,
        req.body.capacity,
        Number(category.price),
        req.body.status,
        category.id
      ]
    );

    res.status(201).json({
      id: roomId,
      number: req.body.roomNumber,
      type: category.name,
      capacity: req.body.capacity,
      price: Number(category.price),
      status: req.body.status,
      categoryId: category.id,
      dailyPrice: Number(category.price)
    });
  })
);

roomsRouter.put(
  "/Rooms/update/:id",
  requireRole("admin"),
  validate({ params: roomIdSchema, body: updateRoomSchema }),
  asyncHandler(async (req, res) => {
    const rooms = await query<RoomRow>(
      `
        SELECT id, number, type, capacity, daily_price::text AS daily_price, status, category_id
        FROM rooms
        WHERE id = $1
        LIMIT 1
      `,
      [req.params.id]
    );
    const room = rooms[0];
    if (!room) {
      throw new HttpError(404, "Quarto nao encontrado.");
    }

    let number = room.number;
    let type = room.type;
    let capacity = room.capacity;
    let dailyPrice = Number(room.daily_price);
    let status = normalizeRoomOperationalStatus(room.status);
    let categoryId = room.category_id;

    if (req.body.roomNumber !== undefined) {
      const duplicate = await query<{ id: string }>(
        `SELECT id FROM rooms WHERE number = $1 AND id <> $2 LIMIT 1`,
        [req.body.roomNumber, req.params.id]
      );
      if (duplicate.length > 0) {
        throw new HttpError(409, "Numero de quarto ja utilizado.");
      }
      number = req.body.roomNumber;
    }

    if (req.body.categoryId) {
      const categories = await query<{ id: string; name: string; price: string }>(
        `
          SELECT id, name, price::text AS price
          FROM categories
          WHERE id = $1
          LIMIT 1
        `,
        [req.body.categoryId]
      );
      const category = categories[0];
      if (!category) {
        throw new HttpError(404, "Categoria nao encontrada.");
      }

      categoryId = category.id;
      type = category.name;
      dailyPrice = Number(category.price);
    }

    if (req.body.capacity !== undefined) {
      capacity = req.body.capacity;
    }

    if (req.body.status !== undefined) {
      status = req.body.status;
    }

    await query(
      `
        UPDATE rooms
        SET number = $1, type = $2, capacity = $3, daily_price = $4, status = $5, category_id = $6
        WHERE id = $7
      `,
      [number, type, capacity, dailyPrice, status, categoryId, req.params.id]
    );

    res.json({
      id: req.params.id,
      number,
      type,
      capacity,
      price: dailyPrice,
      status,
      categoryId,
      dailyPrice
    });
  })
);

roomsRouter.delete(
  "/Rooms/delete/:id",
  requireRole("admin"),
  validate({ params: roomIdSchema }),
  asyncHandler(async (req, res) => {
    const existing = await query<{ id: string }>(`SELECT id FROM rooms WHERE id = $1 LIMIT 1`, [
      req.params.id
    ]);
    if (existing.length === 0) {
      throw new HttpError(404, "Quarto nao encontrado.");
    }

    const activeReservations = await query<{ id: string }>(
      `
        SELECT id
        FROM reservations
        WHERE room_id = $1
          AND status = ANY($2::text[])
        LIMIT 1
      `,
      [req.params.id, ACTIVE_RESERVATION_STATUSES]
    );
    if (activeReservations.length > 0) {
      throw new HttpError(400, "Quarto possui reserva ativa.");
    }

    await query(`DELETE FROM rooms WHERE id = $1`, [req.params.id]);
    res.status(204).send();
  })
);
