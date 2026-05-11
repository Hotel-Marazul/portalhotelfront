import { randomUUID } from "crypto";
import { Router } from "express";
import { query } from "../../db/client.js";
import { validate } from "../../middlewares/validate.js";
import { HttpError } from "../../utils/http-error.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { createRoomSchema, roomIdSchema, updateRoomSchema } from "./rooms.schema.js";
function toRoomResponse(room) {
    const dailyPrice = Number(room.daily_price);
    return {
        id: room.id,
        number: room.number,
        type: room.type,
        capacity: room.capacity,
        price: dailyPrice,
        status: room.status,
        categoryId: room.category_id,
        dailyPrice
    };
}
function parseDate(value) {
    if (!value)
        return null;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        return null;
    }
    return parsed;
}
export const roomsRouter = Router();
roomsRouter.get("/rooms/availability", asyncHandler(async (req, res) => {
    const checkInRaw = typeof req.query.checkIn === "string" ? req.query.checkIn : undefined;
    const checkOutRaw = typeof req.query.checkOut === "string" ? req.query.checkOut : undefined;
    if (!checkInRaw) {
        throw new HttpError(400, "Parametro checkIn obrigatorio.");
    }
    const checkInDate = parseDate(checkInRaw);
    if (!checkInDate) {
        throw new HttpError(400, "Parametro checkIn invalido.");
    }
    const checkOutDate = checkOutRaw ? parseDate(checkOutRaw) : null;
    if (checkOutRaw && !checkOutDate) {
        throw new HttpError(400, "Parametro checkOut invalido.");
    }
    const normalizedCheckOut = checkOutDate ?? new Date(checkInDate.getTime() + 24 * 60 * 60 * 1000);
    if (!checkOutDate && normalizedCheckOut <= checkInDate) {
        throw new HttpError(400, "Periodo invalido.");
    }
    if (checkOutDate && checkOutDate <= checkInDate) {
        throw new HttpError(400, "checkOut deve ser posterior ao checkIn.");
    }
    const rooms = await query(`
        SELECT rm.id, rm.number, rm.type, rm.capacity, rm.daily_price::text AS daily_price, rm.status, rm.category_id
        FROM rooms rm
        WHERE rm.status <> 'Manutenção'
          AND NOT EXISTS (
            SELECT 1
            FROM reservations r
            WHERE r.room_id = rm.id
              AND r.status NOT IN ('Cancelada', 'Concluída')
              AND r.check_in_date < $2::timestamptz
              AND r.check_out_date > $1::timestamptz
          )
        ORDER BY rm.number ASC
      `, [checkInDate.toISOString(), normalizedCheckOut.toISOString()]);
    res.json(rooms.map(toRoomResponse));
}));
roomsRouter.get("/rooms", asyncHandler(async (_req, res) => {
    const rooms = await query(`
        SELECT id, number, type, capacity, daily_price::text AS daily_price, status, category_id
        FROM rooms
        ORDER BY number ASC
      `);
    res.json(rooms.map(toRoomResponse));
}));
roomsRouter.get("/Rooms", asyncHandler(async (_req, res) => {
    const rooms = await query(`
        SELECT id, number, type, capacity, daily_price::text AS daily_price, status, category_id
        FROM rooms
        ORDER BY number ASC
      `);
    res.json(rooms.map(toRoomResponse));
}));
roomsRouter.get("/rooms/summary", asyncHandler(async (_req, res) => {
    const rows = await query(`
        SELECT
          COUNT(*) FILTER (WHERE status = 'Ocupado')::int AS ocupados,
          COUNT(*) FILTER (WHERE status = 'Manutenção')::int AS manutencao,
          COUNT(*)::int AS total
        FROM rooms
      `);
    const summary = rows[0] ?? { ocupados: 0, manutencao: 0, total: 0 };
    const disponiveis = summary.total - summary.ocupados - summary.manutencao;
    res.json({
        ocupados: summary.ocupados,
        disponiveis,
        manutencao: summary.manutencao
    });
}));
roomsRouter.post("/Rooms", validate({ body: createRoomSchema }), asyncHandler(async (req, res) => {
    const numberInUse = await query(`SELECT id FROM rooms WHERE number = $1 LIMIT 1`, [
        req.body.roomNumber
    ]);
    if (numberInUse.length > 0) {
        throw new HttpError(409, "Já existe um quarto com esse número.");
    }
    const categories = await query(`
        SELECT id, name, price::text AS price
        FROM categories
        WHERE id = $1
        LIMIT 1
      `, [req.body.categoryId]);
    const category = categories[0];
    if (!category) {
        throw new HttpError(404, "Categoria não encontrada.");
    }
    const roomId = randomUUID();
    await query(`
        INSERT INTO rooms (id, number, type, capacity, daily_price, status, category_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [
        roomId,
        req.body.roomNumber,
        category.name,
        req.body.capacity,
        Number(category.price),
        req.body.status,
        category.id
    ]);
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
}));
roomsRouter.put("/Rooms/update/:id", validate({ params: roomIdSchema, body: updateRoomSchema }), asyncHandler(async (req, res) => {
    const rooms = await query(`
        SELECT id, number, type, capacity, daily_price::text AS daily_price, status, category_id
        FROM rooms
        WHERE id = $1
        LIMIT 1
      `, [req.params.id]);
    const room = rooms[0];
    if (!room) {
        throw new HttpError(404, "Quarto não encontrado.");
    }
    let number = room.number;
    let type = room.type;
    let capacity = room.capacity;
    let dailyPrice = Number(room.daily_price);
    let status = room.status;
    let categoryId = room.category_id;
    if (req.body.roomNumber !== undefined) {
        const duplicate = await query(`SELECT id FROM rooms WHERE number = $1 AND id <> $2 LIMIT 1`, [req.body.roomNumber, req.params.id]);
        if (duplicate.length > 0) {
            throw new HttpError(409, "Número de quarto já utilizado.");
        }
        number = req.body.roomNumber;
    }
    if (req.body.categoryId) {
        const categories = await query(`
          SELECT id, name, price::text AS price
          FROM categories
          WHERE id = $1
          LIMIT 1
        `, [req.body.categoryId]);
        const category = categories[0];
        if (!category) {
            throw new HttpError(404, "Categoria não encontrada.");
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
    await query(`
        UPDATE rooms
        SET number = $1, type = $2, capacity = $3, daily_price = $4, status = $5, category_id = $6
        WHERE id = $7
      `, [number, type, capacity, dailyPrice, status, categoryId, req.params.id]);
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
}));
roomsRouter.delete("/Rooms/delete/:id", validate({ params: roomIdSchema }), asyncHandler(async (req, res) => {
    const existing = await query(`SELECT id FROM rooms WHERE id = $1 LIMIT 1`, [
        req.params.id
    ]);
    if (existing.length === 0) {
        throw new HttpError(404, "Quarto não encontrado.");
    }
    const activeReservations = await query(`
        SELECT id
        FROM reservations
        WHERE room_id = $1
          AND status NOT IN ('Cancelada', 'Concluída')
        LIMIT 1
      `, [req.params.id]);
    if (activeReservations.length > 0) {
        throw new HttpError(400, "Quarto possui reserva ativa.");
    }
    await query(`DELETE FROM rooms WHERE id = $1`, [req.params.id]);
    res.status(204).send();
}));
