import { randomUUID } from "crypto";
import { Router } from "express";
import { pool, query } from "../../db/client.js";
import { PricingRule, ReservationGuest, ReservationPayment, ReservationPaymentMethod, ReservationPaymentStage } from "../../domain/models.js";
import { validate } from "../../middlewares/validate.js";
import { HttpError } from "../../utils/http-error.js";
import { calculateReservationTotal, resolveReservationStayPeriod } from "../../utils/reservation.js";
import { asyncHandler } from "../../utils/async-handler.js";
import {
  createReservationSchema,
  createReservationPaymentSchema,
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

interface PaymentRow {
  id: string;
  reservation_id: string;
  stage: ReservationPaymentStage;
  method: ReservationPaymentMethod;
  amount: string;
  note: string;
  created_at: string;
}

export const reservationsRouter = Router();
const ROOM_STATUS_MAINTENANCE = "Manuten\u00e7\u00e3o";
const ACTIVE_RESERVATION_STATUSES = ["Pendente", "Confirmada", "EmAndamento"];
const MONTH_LABELS: Record<string, string> = {
  "01": "Jan", "02": "Fev", "03": "Mar", "04": "Abr",
  "05": "Mai", "06": "Jun", "07": "Jul", "08": "Ago",
  "09": "Set", "10": "Out", "11": "Nov", "12": "Dez"
};

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

/**
 * WARNING: This check is NOT transactional. Only use inside a BEGIN/COMMIT
 * block with a FOR UPDATE lock on the room row to prevent race conditions.
 * POST and PUT handlers inline their own conflict check within a transaction
 * and do NOT call this function. If you add a new route that calls this
 * function, wrap the entire handler in pool.connect() + BEGIN/COMMIT/ROLLBACK.
 */
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

function paymentRowsToDto(payments: PaymentRow[]): ReservationPayment[] {
  return payments.map((payment) => ({
    id: payment.id,
    reservationId: payment.reservation_id,
    stage: payment.stage,
    method: payment.method,
    amount: Number(payment.amount),
    note: payment.note,
    createdAt: payment.created_at
  }));
}

async function getReservationPaymentsByIds(reservationIds: string[]) {
  if (reservationIds.length === 0) {
    return new Map<string, ReservationPayment[]>();
  }

  const rows = await query<PaymentRow>(
    `
      SELECT
        id,
        reservation_id,
        stage,
        method,
        amount::text AS amount,
        note,
        created_at::text AS created_at
      FROM reservation_payments
      WHERE reservation_id = ANY($1::uuid[])
      ORDER BY created_at DESC
    `,
    [reservationIds]
  );

  const paymentsByReservation = new Map<string, ReservationPayment[]>();
  for (const payment of paymentRowsToDto(rows)) {
    const current = paymentsByReservation.get(payment.reservationId) ?? [];
    current.push(payment);
    paymentsByReservation.set(payment.reservationId, current);
  }

  return paymentsByReservation;
}

async function getReservationDetailsByIds(reservationIds: string[]) {
  const reservations = await getReservationsByIds(reservationIds);
  if (reservations.length === 0) {
    return [];
  }

  const paymentsByReservation = await getReservationPaymentsByIds(reservationIds);
  return reservations.map((reservation) => ({
    ...reservation,
    payments: paymentsByReservation.get(reservation.id) ?? []
  }));
}

async function getReservationDetailById(reservationId: string) {
  const [reservation] = await getReservationDetailsByIds([reservationId]);
  return reservation ?? null;
}

function resolvePaymentStatus(
  stage: ReservationPaymentStage,
  amount: number,
  dailyPrice: number
) {
  if (stage === "Confirmacao" && amount >= dailyPrice) {
    return "Confirmada";
  }

  if (stage === "CheckIn") {
    return "EmAndamento";
  }

  if (stage === "CheckOut") {
    return "Concluída";
  }

  return null;
}

reservationsRouter.get(
  "/Reservations",
  asyncHandler(async (req, res) => {
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 20));
    const offset = (page - 1) * pageSize;

    // Optional server-side filters from query params
    const statusParam = req.query.status as string | undefined;
    const statusFilter: string[] | null =
      statusParam ? statusParam.split(",").map((s) => s.trim()).filter(Boolean) : null;

    const searchParam = ((req.query.search ?? req.query.q) as string | undefined)?.trim() || null;
    const cpfParam = (req.query.cpf as string | undefined)?.replace(/\D/g, "") || null;
    const idParam = (req.query.id as string | undefined)?.trim() || null;
    const roomIdParam = (req.query.roomId as string | undefined)?.trim() || null;
    const checkInFrom = (req.query.checkInFrom as string | undefined)?.trim() || null;
    const checkInTo = (req.query.checkInTo as string | undefined)?.trim() || null;
    const checkOutFrom = (req.query.checkOutFrom as string | undefined)?.trim() || null;
    const checkOutTo = (req.query.checkOutTo as string | undefined)?.trim() || null;

    // Build a shared WHERE clause applied to both COUNT and SELECT queries.
    // Parameters are positional; we accumulate them in order.
    const params: unknown[] = [];
    const conditions: string[] = [];

    if (statusFilter) {
      params.push(statusFilter);
      conditions.push(`r.status = ANY($${params.length}::text[])`);
    }
    if (searchParam) {
      params.push(`%${searchParam}%`);
      conditions.push(`cl.full_name ILIKE $${params.length}`);
    }
    if (cpfParam) {
      params.push(`%${cpfParam}%`);
      conditions.push(`REGEXP_REPLACE(cl.cpf, '\\D', '', 'g') LIKE $${params.length}`);
    }
    if (idParam) {
      params.push(`%${idParam}%`);
      conditions.push(`r.id::text ILIKE $${params.length}`);
    }
    if (roomIdParam) {
      params.push(roomIdParam);
      conditions.push(`r.room_id = $${params.length}::uuid`);
    }
    if (checkInFrom) {
      params.push(checkInFrom);
      conditions.push(`r.check_in_date >= $${params.length}::timestamptz`);
    }
    if (checkInTo) {
      params.push(checkInTo);
      conditions.push(`r.check_in_date <= $${params.length}::timestamptz`);
    }
    if (checkOutFrom) {
      params.push(checkOutFrom);
      conditions.push(`r.check_out_date >= $${params.length}::timestamptz`);
    }
    if (checkOutTo) {
      params.push(checkOutTo);
      conditions.push(`r.check_out_date <= $${params.length}::timestamptz`);
    }

    const whereClause = conditions.length > 0
      ? `WHERE ${conditions.join(" AND ")}`
      : "";

    // COUNT uses same WHERE; LIMIT/OFFSET are appended only on the data query.
    const countParams = [...params];
    const dataParams = [...params, pageSize, offset];
    const limitOffset = `LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}`;

    const baseQuery = `
      FROM reservations r
      LEFT JOIN rooms rm ON rm.id = r.room_id
      LEFT JOIN clients cl ON cl.id = r.client_id
      ${whereClause}
    `;

    const [countRows, reservationRows] = await Promise.all([
      query<{ total: string }>(
        `SELECT COUNT(*)::text AS total ${baseQuery}`,
        countParams
      ),
      query<ReservationRow>(
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
          ${baseQuery}
          ORDER BY r.check_in_date DESC, r.created_at DESC
          ${limitOffset}
        `,
        dataParams
      )
    ]);

    const total = parseInt(countRows[0]?.total ?? "0", 10);

    let items: ReturnType<typeof reservationRowsToDto> = [];
    if (reservationRows.length > 0) {
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
      items = reservationRowsToDto(reservationRows, guestRows);
    }

    res.json({ items, total, page, pageSize });
  })
);

reservationsRouter.post(
  "/Reservations",
  validate({ body: createReservationSchema }),
  asyncHandler(async (req, res) => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const stayPeriod = resolveReservationStayPeriod({
        checkInRaw: req.body.checkInDate,
        checkOutRaw: req.body.checkOutDate,
        requireCheckIn: true
      });
      if (!stayPeriod) {
        throw new HttpError(400, "A data de check-out deve ser posterior ao check-in.");
      }
      const { checkInDate, checkOutDate } = stayPeriod;

      const roomRows = await client.query<RoomForReservationRow>(
        `SELECT id, daily_price::text AS daily_price, status
         FROM rooms WHERE id = $1 FOR UPDATE`,
        [req.body.roomId]
      );
      const room = roomRows.rows[0];
      if (!room) throw new HttpError(404, "Quarto nao encontrado.");
      if (isMaintenanceRoomStatus(room.status))
        throw new HttpError(400, "Quarto em manutencao nao pode receber reservas.");

      const clientRows = await client.query<ClientReferenceRow>(
        `SELECT id FROM clients WHERE id = $1 LIMIT 1`,
        [req.body.clientId]
      );
      if ((clientRows.rowCount ?? 0) === 0)
        throw new HttpError(404, "Cliente nao encontrado.");

      const conflicts = await client.query<{ id: string }>(
        `SELECT id FROM reservations
         WHERE room_id = $1
            AND status = ANY($5::text[])
            AND ($4::uuid IS NULL OR id <> $4::uuid)
            AND check_in_date < $3::timestamptz
            AND check_out_date > $2::timestamptz
          LIMIT 1`,
        [req.body.roomId, checkInDate.toISOString(), checkOutDate.toISOString(), null, ACTIVE_RESERVATION_STATUSES]
      );
      if ((conflicts.rowCount ?? 0) > 0)
        throw new HttpError(409, "Ja existe uma reserva nesse quarto para o periodo informado.");

      const priceRuleRows = await client.query<PricingRuleRow>(
        `SELECT id, name, description, min_age, max_age, price::text AS price FROM pricing_rules`
      );
      const pricingRules = mapPricingRules(priceRuleRows.rows);

      const guests: ReservationGuest[] = req.body.guests.map((g: ReservationGuest) => ({
        id: randomUUID(),
        reservationId: "",
        name: g.name,
        age: g.age,
        pricingRuleId: g.pricingRuleId ?? null
      }));
      const totalPrice = calculateReservationTotal(
        Number(room.daily_price),
        checkInDate.toISOString(),
        checkOutDate.toISOString(),
        guests,
        pricingRules
      );

      const reservationId = randomUUID();
      await client.query(
        `INSERT INTO reservations (id, room_id, client_id, check_in_date, check_out_date, status, total_price)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [reservationId, req.body.roomId, req.body.clientId,
         checkInDate.toISOString(), checkOutDate.toISOString(), req.body.status, totalPrice]
      );

      for (const guest of guests) {
        await client.query(
          `INSERT INTO reservation_guests (id, reservation_id, name, age, pricing_rule_id)
           VALUES ($1, $2, $3, $4, $5)`,
          [guest.id, reservationId, guest.name, guest.age, guest.pricingRuleId]
        );
      }

      await client.query("COMMIT");

      const reservations = await getReservationsByIds([reservationId]);
      res.status(201).json(reservations[0]);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  })
);

reservationsRouter.put(
  "/Reservations/:id",
  validate({ params: reservationIdSchema, body: updateReservationSchema }),
  asyncHandler(async (req, res) => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const existingRows = await client.query<ReservationReferenceRow>(
        `SELECT id, room_id FROM reservations WHERE id = $1 LIMIT 1`,
        [req.params.id]
      );
      const existingReservation = existingRows.rows[0];
      if (!existingReservation) throw new HttpError(404, "Reserva nao encontrada.");

      const roomRows = await client.query<RoomForReservationRow>(
        `SELECT id, daily_price::text AS daily_price, status
         FROM rooms WHERE id = $1 FOR UPDATE`,
        [req.body.roomId]
      );
      const room = roomRows.rows[0];
      if (!room) throw new HttpError(404, "Quarto nao encontrado.");
      if (isMaintenanceRoomStatus(room.status))
        throw new HttpError(400, "Quarto em manutencao nao pode receber reservas.");

      const clientRows = await client.query<ClientReferenceRow>(
        `SELECT id FROM clients WHERE id = $1 LIMIT 1`,
        [req.body.clientId]
      );
      if ((clientRows.rowCount ?? 0) === 0)
        throw new HttpError(404, "Cliente nao encontrado.");

      const stayPeriod = resolveReservationStayPeriod({
        checkInRaw: req.body.checkInDate,
        checkOutRaw: req.body.checkOutDate,
        requireCheckIn: true
      });
      if (!stayPeriod) {
        throw new HttpError(400, "A data de check-out deve ser posterior ao check-in.");
      }
      const { checkInDate, checkOutDate } = stayPeriod;

      const conflicts = await client.query<{ id: string }>(
        `SELECT id FROM reservations
         WHERE room_id = $1
            AND status = ANY($5::text[])
            AND ($4::uuid IS NULL OR id <> $4::uuid)
            AND check_in_date < $3::timestamptz
            AND check_out_date > $2::timestamptz
          LIMIT 1`,
        [req.body.roomId, checkInDate.toISOString(), checkOutDate.toISOString(),
          existingReservation.id, ACTIVE_RESERVATION_STATUSES]
      );
      if ((conflicts.rowCount ?? 0) > 0)
        throw new HttpError(409, "Ja existe uma reserva nesse quarto para o periodo informado.");

      const priceRuleRows = await client.query<PricingRuleRow>(
        `SELECT id, name, description, min_age, max_age, price::text AS price FROM pricing_rules`
      );
      const pricingRules = mapPricingRules(priceRuleRows.rows);

      const guests: ReservationGuest[] = req.body.guests.map((g: ReservationGuest) => ({
        id: randomUUID(),
        reservationId: existingReservation.id,
        name: g.name,
        age: g.age,
        pricingRuleId: g.pricingRuleId ?? null
      }));
      const totalPrice = calculateReservationTotal(
        Number(room.daily_price),
        checkInDate.toISOString(),
        checkOutDate.toISOString(),
        guests,
        pricingRules
      );

      await client.query(
        `UPDATE reservations
         SET room_id = $1, client_id = $2, check_in_date = $3, check_out_date = $4,
             status = $5, total_price = $6
         WHERE id = $7`,
        [req.body.roomId, req.body.clientId, checkInDate.toISOString(), checkOutDate.toISOString(),
          req.body.status, totalPrice, existingReservation.id]
      );

      await client.query(
        `DELETE FROM reservation_guests WHERE reservation_id = $1`,
        [existingReservation.id]
      );

      for (const guest of guests) {
        await client.query(
          `INSERT INTO reservation_guests (id, reservation_id, name, age, pricing_rule_id)
           VALUES ($1, $2, $3, $4, $5)`,
          [guest.id, existingReservation.id, guest.name, guest.age, guest.pricingRuleId]
        );
      }

      await client.query("COMMIT");

      const reservations = await getReservationsByIds([existingReservation.id]);
      res.json(reservations[0]);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  })
);

reservationsRouter.delete(
  "/Reservations/:id",
  validate({ params: reservationIdSchema }),
  asyncHandler(async (req, res) => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const existingRows = await client.query<ReservationReferenceRow>(
        `SELECT id, room_id FROM reservations WHERE id = $1 LIMIT 1`,
        [req.params.id]
      );
      const reservation = existingRows.rows[0];
      if (!reservation) {
        throw new HttpError(404, "Reserva nao encontrada.");
      }

      await client.query(
        `DELETE FROM reservation_guests WHERE reservation_id = $1`,
        [req.params.id]
      );
      await client.query(
        `DELETE FROM reservations WHERE id = $1`,
        [req.params.id]
      );

      await client.query("COMMIT");
      res.status(204).send();
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  })
);

reservationsRouter.get(
  "/Reservations/:id/payments",
  validate({ params: reservationIdSchema }),
  asyncHandler(async (req, res) => {
    const reservation = await getReservationDetailById(req.params.id);
    if (!reservation) {
      throw new HttpError(404, "Reserva nao encontrada.");
    }

    res.json({ items: reservation.payments ?? [] });
  })
);

reservationsRouter.post(
  "/Reservations/:id/payments",
  validate({ params: reservationIdSchema, body: createReservationPaymentSchema }),
  asyncHandler(async (req, res) => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const reservationRows = await client.query<
        ReservationReferenceRow & { status: string; room_daily_price: string | null }
      >(
        `
          SELECT
            r.id,
            r.room_id,
            r.status,
            rm.daily_price::text AS room_daily_price
          FROM reservations r
          INNER JOIN rooms rm ON rm.id = r.room_id
          WHERE r.id = $1
          LIMIT 1
          FOR UPDATE
        `,
        [req.params.id]
      );

      const reservation = reservationRows.rows[0];
      if (!reservation) {
        throw new HttpError(404, "Reserva nao encontrada.");
      }

      if (reservation.status === "Cancelada" || reservation.status === "Concluída") {
        throw new HttpError(400, "Nao e possivel registrar pagamento para esta reserva.");
      }

      const paymentId = randomUUID();
      await client.query(
        `
          INSERT INTO reservation_payments (id, reservation_id, stage, method, amount, note)
          VALUES ($1, $2, $3, $4, $5, $6)
        `,
        [
          paymentId,
          req.params.id,
          req.body.stage,
          req.body.method,
          req.body.amount,
          req.body.note ?? ""
        ]
      );

      const nextStatus = resolvePaymentStatus(
        req.body.stage,
        req.body.amount,
        Number(reservation.room_daily_price ?? 0)
      );

      if (nextStatus) {
        await client.query(
          `UPDATE reservations SET status = $1 WHERE id = $2`,
          [nextStatus, req.params.id]
        );
      }

      await client.query("COMMIT");

      const updatedReservation = await getReservationDetailById(req.params.id);
      res.status(201).json({ reservation: updatedReservation });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
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

    const monthlyRows = await query<{ month_num: string; taxa: number }>(
      `SELECT
         TO_CHAR(date_trunc('month', check_in_date), 'MM') AS month_num,
         ROUND(
           COUNT(DISTINCT room_id)::numeric
           / NULLIF((SELECT COUNT(*) FROM rooms WHERE status <> $1), 0)
           * 100,
           1
         )::float AS taxa
       FROM reservations
       WHERE status = ANY($2::text[])
         AND check_in_date >= NOW() - INTERVAL '6 months'
       GROUP BY date_trunc('month', check_in_date)
       ORDER BY date_trunc('month', check_in_date)`,
      [ROOM_STATUS_MAINTENANCE, ACTIVE_RESERVATION_STATUSES]
    );

    const taxaOcupacaoMes = monthlyRows.map((row) => ({
      mes: MONTH_LABELS[row.month_num] ?? row.month_num,
      taxa: row.taxa
    }));

    res.json({
      taxaOcupacaoMes,
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
