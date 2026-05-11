import { randomUUID } from "crypto";
import { Router } from "express";
import { query } from "../../db/client.js";
import { PricingRule, ReservationGuest } from "../../domain/models.js";
import { validate } from "../../middlewares/validate.js";
import { HttpError } from "../../utils/http-error.js";
import { calculateReservationTotal } from "../../utils/reservation.js";
import { asyncHandler } from "../../utils/async-handler.js";
import {
  createReservationSchema,
  reservationIdSchema,
  updateReservationSchema
} from "./reservations.schema.js";

interface ReservationRow {
  id: string;
  room_id: string;
  client_id: string;
  check_in_date: string;
  check_out_date: string;
  status: string;
  total_price: string;
  room_number: number | null;
  room_type: string | null;
  room_daily_price: string | null;
  client_full_name: string | null;
  client_cpf: string | null;
}

interface GuestRow {
  id: string;
  reservation_id: string;
  name: string;
  age: number;
  pricing_rule_id: string | null;
  rule_id: string | null;
  rule_name: string | null;
  rule_description: string | null;
  rule_price: string | null;
}

interface PricingRuleRow {
  id: string;
  name: string;
  description: string;
  min_age: number;
  max_age: number;
  price: string;
}

interface RoomForReservationRow {
  id: string;
  daily_price: string;
  status: string;
}

interface ClientReferenceRow {
  id: string;
}

interface ReservationReferenceRow {
  id: string;
  room_id: string;
}

export const reservationsRouter = Router();
const ROOM_STATUS_MAINTENANCE = "Manuten\u00e7\u00e3o";
const ACTIVE_RESERVATION_STATUSES = ["Pendente", "Confirmada", "EmAndamento"];

function validateReservationDates(checkInDate: string, checkOutDate: string): void {
  const checkIn = new Date(checkInDate).getTime();
  const checkOut = new Date(checkOutDate).getTime();
  if (Number.isNaN(checkIn) || Number.isNaN(checkOut) || checkOut <= checkIn) {
    throw new HttpError(400, "A data de check-out deve ser posterior ao check-in.");
  }
}

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function isActiveReservationStatus(status: string) {
  return ACTIVE_RESERVATION_STATUSES.includes(status);
}

function isMaintenanceRoomStatus(status: string) {
  return normalizeText(status) === "manutencao";
}

async function ensureRoomIsAvailable(
  roomId: string,
  checkInDate: string,
  checkOutDate: string,
  ignoreReservationId?: string
) {
  const conflicts = await query<{ id: string }>(
    `
      SELECT id
      FROM reservations
      WHERE room_id = $1
        AND status = ANY($5::text[])
        AND ($4::uuid IS NULL OR id <> $4::uuid)
        AND check_in_date < $3::timestamptz
        AND check_out_date > $2::timestamptz
      LIMIT 1
    `,
    [roomId, checkInDate, checkOutDate, ignoreReservationId ?? null, ACTIVE_RESERVATION_STATUSES]
  );

  if (conflicts.length > 0) {
    throw new HttpError(409, "Ja existe uma reserva nesse quarto para o periodo informado.");
  }
}

function mapPricingRules(rows: PricingRuleRow[]): PricingRule[] {
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    minAge: row.min_age,
    maxAge: row.max_age,
    price: Number(row.price)
  }));
}

function reservationRowsToDto(reservations: ReservationRow[], guests: GuestRow[]) {
  const guestsByReservation = new Map<string, GuestRow[]>();

  for (const guest of guests) {
    const current = guestsByReservation.get(guest.reservation_id) ?? [];
    current.push(guest);
    guestsByReservation.set(guest.reservation_id, current);
  }

  return reservations.map((reservation) => ({
    id: reservation.id,
    roomId: reservation.room_id,
    clientId: reservation.client_id,
    checkInDate: reservation.check_in_date,
    checkOutDate: reservation.check_out_date,
    status: reservation.status,
    totalPrice: Number(reservation.total_price),
    room:
      reservation.room_number !== null
        ? {
            id: reservation.room_id,
            name: `Quarto ${reservation.room_number}`,
            number: reservation.room_number,
            type: reservation.room_type ?? "",
            dailyPrice: reservation.room_daily_price ? Number(reservation.room_daily_price) : 0
          }
        : undefined,
    client:
      reservation.client_full_name
        ? {
            id: reservation.client_id,
            name: reservation.client_full_name,
            fullName: reservation.client_full_name,
            cpf: reservation.client_cpf ?? ""
          }
        : undefined,
    guests: (guestsByReservation.get(reservation.id) ?? []).map((guest) => ({
      id: guest.id,
      reservationId: guest.reservation_id,
      name: guest.name,
      age: guest.age,
      pricingRuleId: guest.pricing_rule_id,
      pricingRule: guest.rule_id
        ? {
            id: guest.rule_id,
            name: guest.rule_name ?? "",
            description: guest.rule_description ?? "",
            price: guest.rule_price ? Number(guest.rule_price) : 0
          }
        : undefined
    }))
  }));
}

async function getReservationsByIds(reservationIds?: string[]) {
  const filtered = reservationIds?.filter(Boolean) ?? [];
  const hasFilter = filtered.length > 0;

  const reservationRows = await query<ReservationRow>(
    `
      SELECT
        r.id,
        r.room_id,
        r.client_id,
        r.check_in_date::text AS check_in_date,
        r.check_out_date::text AS check_out_date,
        r.status,
        r.total_price::text AS total_price,
        rm.number AS room_number,
        rm.type AS room_type,
        rm.daily_price::text AS room_daily_price,
        cl.full_name AS client_full_name,
        cl.cpf AS client_cpf
      FROM reservations r
      LEFT JOIN rooms rm ON rm.id = r.room_id
      LEFT JOIN clients cl ON cl.id = r.client_id
      WHERE ($1::bool = false OR r.id = ANY($2::uuid[]))
      ORDER BY r.check_in_date DESC, r.created_at DESC
    `,
    [hasFilter, filtered]
  );

  if (reservationRows.length === 0) {
    return [];
  }

  const ids = reservationRows.map((row) => row.id);
  const guestRows = await query<GuestRow>(
    `
      SELECT
        g.id,
        g.reservation_id,
        g.name,
        g.age,
        g.pricing_rule_id,
        pr.id AS rule_id,
        pr.name AS rule_name,
        pr.description AS rule_description,
        pr.price::text AS rule_price
      FROM reservation_guests g
      LEFT JOIN pricing_rules pr ON pr.id = g.pricing_rule_id
      WHERE g.reservation_id = ANY($1::uuid[])
      ORDER BY g.created_at ASC
    `,
    [ids]
  );

  return reservationRowsToDto(reservationRows, guestRows);
}

reservationsRouter.get(
  "/Reservations",
  asyncHandler(async (_req, res) => {
    const reservations = await getReservationsByIds();
    res.json(reservations);
  })
);

reservationsRouter.post(
  "/Reservations",
  validate({ body: createReservationSchema }),
  asyncHandler(async (req, res) => {
    const rooms = await query<RoomForReservationRow>(
      `
        SELECT id, daily_price::text AS daily_price, status
        FROM rooms
        WHERE id = $1
        LIMIT 1
      `,
      [req.body.roomId]
    );
    const room = rooms[0];
    if (!room) {
      throw new HttpError(404, "Quarto nao encontrado.");
    }
    if (isMaintenanceRoomStatus(room.status)) {
      throw new HttpError(400, "Quarto em manutencao nao pode receber reservas.");
    }

    const clients = await query<ClientReferenceRow>(`SELECT id FROM clients WHERE id = $1 LIMIT 1`, [
      req.body.clientId
    ]);
    if (clients.length === 0) {
      throw new HttpError(404, "Cliente nao encontrado.");
    }

    validateReservationDates(req.body.checkInDate, req.body.checkOutDate);
    await ensureRoomIsAvailable(req.body.roomId, req.body.checkInDate, req.body.checkOutDate);

    const pricingRuleRows = await query<PricingRuleRow>(
      `
        SELECT id, name, description, min_age, max_age, price::text AS price
        FROM pricing_rules
      `
    );
    const pricingRules = mapPricingRules(pricingRuleRows);

    const guests: ReservationGuest[] = req.body.guests.map((guest: ReservationGuest) => ({
      id: randomUUID(),
      reservationId: "",
      name: guest.name,
      age: guest.age,
      pricingRuleId: guest.pricingRuleId ?? null
    }));

    const totalPrice = calculateReservationTotal(
      Number(room.daily_price),
      req.body.checkInDate,
      req.body.checkOutDate,
      guests,
      pricingRules
    );

    const reservationId = randomUUID();
    await query(
      `
        INSERT INTO reservations (id, room_id, client_id, check_in_date, check_out_date, status, total_price)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `,
      [
        reservationId,
        req.body.roomId,
        req.body.clientId,
        req.body.checkInDate,
        req.body.checkOutDate,
        req.body.status,
        totalPrice
      ]
    );

    for (const guest of guests) {
      await query(
        `
          INSERT INTO reservation_guests (id, reservation_id, name, age, pricing_rule_id)
          VALUES ($1, $2, $3, $4, $5)
        `,
        [guest.id, reservationId, guest.name, guest.age, guest.pricingRuleId]
      );
    }

    const reservations = await getReservationsByIds([reservationId]);
    res.status(201).json(reservations[0]);
  })
);

reservationsRouter.put(
  "/Reservations/:id",
  validate({ params: reservationIdSchema, body: updateReservationSchema }),
  asyncHandler(async (req, res) => {
    const existingReservations = await query<ReservationReferenceRow>(
      `
        SELECT id, room_id
        FROM reservations
        WHERE id = $1
        LIMIT 1
      `,
      [req.params.id]
    );
    const existingReservation = existingReservations[0];
    if (!existingReservation) {
      throw new HttpError(404, "Reserva nao encontrada.");
    }

    const rooms = await query<RoomForReservationRow>(
      `
        SELECT id, daily_price::text AS daily_price, status
        FROM rooms
        WHERE id = $1
        LIMIT 1
      `,
      [req.body.roomId]
    );
    const room = rooms[0];
    if (!room) {
      throw new HttpError(404, "Quarto nao encontrado.");
    }
    if (isMaintenanceRoomStatus(room.status)) {
      throw new HttpError(400, "Quarto em manutencao nao pode receber reservas.");
    }

    const clients = await query<ClientReferenceRow>(`SELECT id FROM clients WHERE id = $1 LIMIT 1`, [
      req.body.clientId
    ]);
    if (clients.length === 0) {
      throw new HttpError(404, "Cliente nao encontrado.");
    }

    validateReservationDates(req.body.checkInDate, req.body.checkOutDate);
    await ensureRoomIsAvailable(
      req.body.roomId,
      req.body.checkInDate,
      req.body.checkOutDate,
      existingReservation.id
    );

    const pricingRuleRows = await query<PricingRuleRow>(
      `
        SELECT id, name, description, min_age, max_age, price::text AS price
        FROM pricing_rules
      `
    );
    const pricingRules = mapPricingRules(pricingRuleRows);

    const guests: ReservationGuest[] = req.body.guests.map((guest: ReservationGuest) => ({
      id: randomUUID(),
      reservationId: existingReservation.id,
      name: guest.name,
      age: guest.age,
      pricingRuleId: guest.pricingRuleId ?? null
    }));

    const totalPrice = calculateReservationTotal(
      Number(room.daily_price),
      req.body.checkInDate,
      req.body.checkOutDate,
      guests,
      pricingRules
    );

    await query(
      `
        UPDATE reservations
        SET room_id = $1, client_id = $2, check_in_date = $3, check_out_date = $4, status = $5, total_price = $6
        WHERE id = $7
      `,
      [
        req.body.roomId,
        req.body.clientId,
        req.body.checkInDate,
        req.body.checkOutDate,
        req.body.status,
        totalPrice,
        existingReservation.id
      ]
    );

    await query(`DELETE FROM reservation_guests WHERE reservation_id = $1`, [existingReservation.id]);

    for (const guest of guests) {
      await query(
        `
          INSERT INTO reservation_guests (id, reservation_id, name, age, pricing_rule_id)
          VALUES ($1, $2, $3, $4, $5)
        `,
        [guest.id, existingReservation.id, guest.name, guest.age, guest.pricingRuleId]
      );
    }

    const reservations = await getReservationsByIds([existingReservation.id]);
    res.json(reservations[0]);
  })
);

reservationsRouter.delete(
  "/Reservations/:id",
  validate({ params: reservationIdSchema }),
  asyncHandler(async (req, res) => {
    const existingReservations = await query<ReservationReferenceRow>(
      `
        SELECT id, room_id
        FROM reservations
        WHERE id = $1
        LIMIT 1
      `,
      [req.params.id]
    );
    const reservation = existingReservations[0];
    if (!reservation) {
      throw new HttpError(404, "Reserva nao encontrada.");
    }

    await query(`DELETE FROM reservations WHERE id = $1`, [req.params.id]);
    res.status(204).send();
  })
);

reservationsRouter.get(
  "/reservations/counter-summary",
  asyncHandler(async (_req, res) => {
    const rows = await query<{
      check_ins_hoje: number;
      check_outs_hoje: number;
      reservas_ativas: number;
      occupied_rooms: number;
      total_rooms: number;
    }>(
      `
        SELECT
          COUNT(*) FILTER (WHERE check_in_date::date = CURRENT_DATE)::int AS check_ins_hoje,
          COUNT(*) FILTER (WHERE check_out_date::date = CURRENT_DATE)::int AS check_outs_hoje,
          COUNT(*) FILTER (WHERE status = ANY($2::text[]))::int AS reservas_ativas,
          (
            SELECT COUNT(DISTINCT r.room_id)::int
            FROM reservations r
            INNER JOIN rooms rm ON rm.id = r.room_id
            WHERE rm.status <> $1
              AND r.status = ANY($2::text[])
              AND r.check_in_date < (CURRENT_DATE + INTERVAL '1 day')
              AND r.check_out_date > CURRENT_DATE
          ) AS occupied_rooms,
          (
            SELECT COUNT(*)::int
            FROM rooms
            WHERE status <> $1
          ) AS total_rooms
        FROM reservations
      `,
      [ROOM_STATUS_MAINTENANCE, ACTIVE_RESERVATION_STATUSES]
    );

    const summary = rows[0] ?? {
      check_ins_hoje: 0,
      check_outs_hoje: 0,
      reservas_ativas: 0,
      occupied_rooms: 0,
      total_rooms: 0
    };

    const occupancyRate =
      summary.total_rooms === 0 ? 0 : (summary.occupied_rooms / summary.total_rooms) * 100;

    res.json({
      taxaOcupacaoMes: [
        { mes: "Jan", taxa: occupancyRate },
        { mes: "Fev", taxa: occupancyRate },
        { mes: "Mar", taxa: occupancyRate }
      ],
      checkInsHoje: summary.check_ins_hoje,
      checkOutsHoje: summary.check_outs_hoje,
      reservasAtivas: summary.reservas_ativas
    });
  })
);

reservationsRouter.get(
  "/reservations/revenue-summary",
  asyncHandler(async (_req, res) => {
    const rows = await query<{
      receita_hoje: string;
      receita_mes_atual: string;
      receita_mes_anterior: string;
    }>(
      `
        SELECT
          COALESCE(SUM(total_price) FILTER (WHERE check_in_date::date = CURRENT_DATE), 0)::text AS receita_hoje,
          COALESCE(SUM(total_price) FILTER (
            WHERE date_trunc('month', check_in_date) = date_trunc('month', CURRENT_DATE)
          ), 0)::text AS receita_mes_atual,
          COALESCE(SUM(total_price) FILTER (
            WHERE date_trunc('month', check_in_date) = date_trunc('month', CURRENT_DATE - INTERVAL '1 month')
          ), 0)::text AS receita_mes_anterior
        FROM reservations
      `
    );

    const revenue = rows[0] ?? {
      receita_hoje: "0",
      receita_mes_atual: "0",
      receita_mes_anterior: "0"
    };

    res.json({
      receitaHoje: Number(revenue.receita_hoje),
      receitaMesAtual: Number(revenue.receita_mes_atual),
      receitaMesAnterior: Number(revenue.receita_mes_anterior)
    });
  })
);
