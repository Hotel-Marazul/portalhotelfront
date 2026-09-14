import { createHash, randomUUID } from "crypto";
import { Request, Response, Router } from "express";
import { pool, query } from "../../db/client.js";
import { PricingRule, ReservationGuest, ReservationPayment, ReservationPaymentMethod, ReservationPaymentStage, ReservationStatus } from "../../domain/models.js";
import { validate } from "../../middlewares/validate.js";
import { requireRole } from "../../middlewares/require-role.js";
import { HttpError } from "../../utils/http-error.js";
import {
  calculateReservationPricing,
  formatHotelDate,
  HOTEL_TIMEZONE,
  hotelDayBounds,
  ReservationPricingResult,
  hotelCivilDateToUtc,
  nextHotelCivilDateToUtc,
  resolveReservationStayPeriod
} from "../../utils/reservation.js";
import {
  ACTIVE_RESERVATION_STATUSES,
  BLOCKING_RESERVATION_STATUSES
} from "../../utils/reservation-status.js";
import { asyncHandler } from "../../utils/async-handler.js";
import {
  createReservationSchema,
  createReservationPaymentSchema,
  cancelReservationSchema,
  reservationTransitionSchema,
  reverseReservationPaymentSchema,
  reservationIdSchema,
  reservationQuoteSchema,
  reservationListQuerySchema,
  updateReservationSchema
} from "./reservations.schema.js";
import { canTransitionReservation, normalizeReservationStatus, transitionTimingError } from "../../utils/reservation-lifecycle.js";

interface ReservationRow {
  id: string;
  room_id: string;
  client_id: string;
  check_in_date: string;
  check_out_date: string;
  status: string;
  total_price: string;
  rate_type: "single" | "couple" | null;
  base_daily_rate: string | null;
  night_count: number | null;
  additional_daily_total: string | null;
  subtotal_price: string | null;
  price_source: "catalog" | "manual" | null;
  discount_amount: string | null;
  price_override_reason: string | null;
  priced_by: string | null;
  version: number;
  idempotency_key: string | null;
  created_at: string;
  updated_at: string;
  last_event_action: string | null;
  last_event_actor_type: "user" | "agents-service" | "system" | null;
  last_event_created_at: string | null;
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
  capacity: number;
  daily_price: string;
  status: string;
  single_price: string | null;
  couple_price: string | null;
}

interface ClientReferenceRow {
  id: string;
}

interface ReservationReferenceRow {
  id: string;
  room_id: string;
  rate_type?: "single" | "couple" | null;
  base_daily_rate?: string | null;
  discount_amount?: string | null;
  price_source?: "catalog" | "manual" | null;
  price_override_reason?: string | null;
  priced_by?: string | null;
  status?: string;
  version?: number;
  idempotency_key?: string | null;
  idempotency_fingerprint?: string | null;
  total_price?: string;
  check_in_date?: string;
  check_out_date?: string;
}

interface PaymentRow {
  id: string;
  reservation_id: string;
  stage: ReservationPaymentStage;
  method: ReservationPaymentMethod;
  amount: string;
  note: string;
  idempotency_key: string | null;
  entry_type: "payment" | "reversal";
  reversed_payment_id: string | null;
  created_at: string;
}

export const reservationsRouter = Router();
const ROOM_STATUS_MAINTENANCE = "Manuten\u00e7\u00e3o";
const INCLUDED_ADDITIONAL_GUESTS = 1;
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

function moneyToCents(value: number | string) {
  return Math.round(Number(value) * 100);
}

function centsToMoney(value: number) {
  return value / 100;
}

function requestFingerprint(input: unknown) {
  return createHash("sha256").update(JSON.stringify(input)).digest("hex");
}

function assertManualPricingAuthorization(req: Request, body: { dailyRateOverride?: number; discountAmount?: number }) {
  const hasManualAdjustment = body.dailyRateOverride !== undefined || (body.discountAmount ?? 0) > 0;
  if (hasManualAdjustment && req.isAgentsService) {
    throw new HttpError(403, "A identidade técnica não pode alterar o preço manualmente.");
  }
}

function reservationRequestFingerprint(input: {
  roomId: string;
  clientId: string;
  checkInDate: Date;
  checkOutDate: Date;
  status: string;
  guests: ReservationGuest[];
  dailyRateOverride?: number;
  discountAmount?: number;
  priceOverrideReason?: string;
}) {
  return createHash("sha256").update(JSON.stringify({
    roomId: input.roomId,
    clientId: input.clientId,
    checkInDate: input.checkInDate.toISOString(),
    checkOutDate: input.checkOutDate.toISOString(),
    status: input.status,
    guests: input.guests.map(({ name, age, pricingRuleId }) => ({ name, age, pricingRuleId })),
    dailyRateOverride: input.dailyRateOverride ?? null,
    discountAmount: input.discountAmount ?? null,
    priceOverrideReason: input.priceOverrideReason ?? null
  })).digest("hex");
}

function isMaintenanceRoomStatus(status: string) {
  return normalizeText(status) === "manutencao";
}

function validateReservationGuests(
  guests: ReservationGuest[],
  roomCapacity: number,
  pricingRules: PricingRule[]
) {
  const totalGuestCount = 1 + guests.length;
  if (totalGuestCount > roomCapacity) {
    throw new HttpError(400, `A capacidade do quarto é de ${roomCapacity} hóspede(s).`);
  }

  for (const [index, guest] of guests.entries()) {
    if (index >= INCLUDED_ADDITIONAL_GUESTS && !guest.pricingRuleId) {
      throw new HttpError(400, "Informe a regra de preço dos hóspedes adicionais pagos.");
    }

    if (!guest.pricingRuleId) {
      continue;
    }

    const pricingRule = pricingRules.find((rule) => rule.id === guest.pricingRuleId);
    if (!pricingRule) {
      throw new HttpError(400, "A regra de preço informada não existe.");
    }

    if (guest.age < pricingRule.minAge || guest.age > pricingRule.maxAge) {
      throw new HttpError(
        400,
        `A regra de preço selecionada não é compatível com a idade de ${guest.name}.`
      );
    }
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

function calculateReservationPricingOrHttpError(params: {
  room: RoomForReservationRow;
  guests: ReservationGuest[];
  pricingRules: PricingRule[];
  checkInDate: Date;
  checkOutDate: Date;
  dailyRateOverride?: number;
  discountAmount?: number;
}): ReservationPricingResult {
  try {
    return calculateReservationPricing({
      checkInDate: params.checkInDate.toISOString(),
      checkOutDate: params.checkOutDate.toISOString(),
      guests: params.guests,
      pricingRules: params.pricingRules,
      singlePrice: params.room.single_price === null ? null : Number(params.room.single_price),
      couplePrice: params.room.couple_price === null ? null : Number(params.room.couple_price),
      legacyDailyPrice: Number(params.room.daily_price),
      dailyRateOverride: params.dailyRateOverride,
      discountAmount: params.discountAmount
    });
  } catch (error) {
    throw new HttpError(
      400,
      error instanceof Error ? error.message : "Não foi possível calcular o preço da reserva."
    );
  }
}

interface PricingAdjustmentBody {
  dailyRateOverride?: number;
  discountAmount?: number;
  priceOverrideReason?: string;
  clearDailyRateOverride?: boolean;
}

function resolveReservationPricingSnapshot(params: {
  room: RoomForReservationRow;
  guests: ReservationGuest[];
  pricingRules: PricingRule[];
  checkInDate: Date;
  checkOutDate: Date;
  body: PricingAdjustmentBody;
  existing?: ReservationReferenceRow;
  pricedByUserId?: string;
}) {
  const preserveManualRate =
    params.body.dailyRateOverride === undefined &&
    !params.body.clearDailyRateOverride &&
    params.existing?.price_source === "manual" &&
    params.existing.base_daily_rate !== null &&
    params.existing.base_daily_rate !== undefined;
  const dailyRateOverride = params.body.dailyRateOverride ??
    (preserveManualRate ? Number(params.existing?.base_daily_rate) : undefined);
  const discountAmount = params.body.discountAmount ??
    (params.existing?.discount_amount ? Number(params.existing.discount_amount) : 0);
  const overrideReason = params.body.priceOverrideReason ??
    (params.body.clearDailyRateOverride ? null : params.existing?.price_override_reason ?? null);
  const pricing = calculateReservationPricingOrHttpError({
    room: params.room,
    guests: params.guests,
    pricingRules: params.pricingRules,
    checkInDate: params.checkInDate,
    checkOutDate: params.checkOutDate,
    dailyRateOverride,
    discountAmount
  });

  const hasManualAdjustment = pricing.priceSource === "manual" || pricing.discountAmount > 0;
  if (hasManualAdjustment && !overrideReason) {
    throw new HttpError(400, "Informe o motivo do ajuste manual de preço.");
  }

  const adjustmentSubmitted =
    params.body.dailyRateOverride !== undefined ||
    params.body.discountAmount !== undefined ||
    params.body.priceOverrideReason !== undefined;
  const pricedBy = hasManualAdjustment
    ? adjustmentSubmitted
      ? params.pricedByUserId ?? null
      : params.existing?.priced_by ?? params.pricedByUserId ?? null
    : null;

  return {
    pricing,
    overrideReason,
    pricedBy
  };
}

function reservationPricingToDto(
  reservation: Pick<
    ReservationRow,
    | "rate_type"
    | "base_daily_rate"
    | "night_count"
    | "additional_daily_total"
    | "subtotal_price"
    | "price_source"
    | "discount_amount"
    | "price_override_reason"
    | "total_price"
  >
) {
  if (
    !reservation.rate_type ||
    reservation.base_daily_rate === null ||
    reservation.night_count === null ||
    reservation.additional_daily_total === null ||
    reservation.subtotal_price === null ||
    !reservation.price_source
  ) {
    return null;
  }

  return {
    rateType: reservation.rate_type,
    dailyRate: Number(reservation.base_daily_rate),
    priceSource: reservation.price_source,
    nights: reservation.night_count,
    additionalDailyTotal: Number(reservation.additional_daily_total),
    subtotal: Number(reservation.subtotal_price),
    discountAmount: Number(reservation.discount_amount ?? 0),
    totalPrice: Number(reservation.total_price),
    ...(reservation.price_override_reason
      ? { overrideReason: reservation.price_override_reason }
      : {})
  };
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
    version: reservation.version,
    createdAt: reservation.created_at,
    updatedAt: reservation.updated_at,
    audit: reservation.last_event_action
      ? {
          action: reservation.last_event_action,
          actorType: reservation.last_event_actor_type,
          occurredAt: reservation.last_event_created_at
        }
      : undefined,
    totalPrice: Number(reservation.total_price),
    pricing: reservationPricingToDto(reservation),
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
            cpf: reservation.client_cpf ? `***.***.***-${reservation.client_cpf.replace(/\D/g, "").slice(-2)}` : ""
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
        r.rate_type,
        r.base_daily_rate::text AS base_daily_rate,
        r.night_count,
        r.additional_daily_total::text AS additional_daily_total,
        r.subtotal_price::text AS subtotal_price,
        r.price_source,
        r.discount_amount::text AS discount_amount,
        r.price_override_reason,
        r.priced_by,
        r.version,
        r.idempotency_key::text AS idempotency_key,
        r.idempotency_fingerprint,
        r.created_at::text AS created_at,
        r.updated_at::text AS updated_at,
        last_event.action AS last_event_action,
        last_event.actor_type AS last_event_actor_type,
        last_event.created_at::text AS last_event_created_at,
        rm.number AS room_number,
        rm.type AS room_type,
        rm.daily_price::text AS room_daily_price,
        cl.full_name AS client_full_name,
        cl.cpf AS client_cpf
      FROM reservations r
      LEFT JOIN rooms rm ON rm.id = r.room_id
      LEFT JOIN clients cl ON cl.id = r.client_id
      LEFT JOIN LATERAL (
        SELECT e.action, e.actor_type, e.created_at
        FROM reservation_events e
        WHERE e.reservation_id = r.id
        ORDER BY e.created_at DESC, e.id DESC
        LIMIT 1
      ) AS last_event ON true
      WHERE ($1::bool = false OR r.id = ANY($2::uuid[]))
      ORDER BY r.check_in_date DESC, r.created_at DESC, r.id ASC
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
    entryType: payment.entry_type,
    idempotencyKey: payment.idempotency_key,
    reversedPaymentId: payment.reversed_payment_id,
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
        idempotency_key::text AS idempotency_key,
        entry_type,
        reversed_payment_id::text AS reversed_payment_id,
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
  return reservations.map((reservation) => {
    const payments = paymentsByReservation.get(reservation.id) ?? [];
    const totalPaidCentsRaw = payments.reduce((sum, payment) => sum + moneyToCents(payment.amount), 0);
    const totalPriceCents = moneyToCents(reservation.totalPrice);
    const totalPaidCents = Math.max(0, totalPaidCentsRaw);
    const balanceDueCents = Math.max(0, totalPriceCents - totalPaidCentsRaw);
    const financialException = totalPaidCentsRaw > totalPriceCents
      ? { type: "overpaid" as const, amount: centsToMoney(totalPaidCentsRaw - totalPriceCents) }
      : totalPaidCentsRaw < 0
        ? { type: "invalid_total" as const, amount: centsToMoney(Math.abs(totalPaidCentsRaw)) }
        : null;
    return {
      ...reservation,
      payments,
      totalPaid: centsToMoney(totalPaidCents),
      balanceDue: centsToMoney(balanceDueCents),
      financialException
    };
  });
}

async function getReservationDetailById(reservationId: string) {
  const [reservation] = await getReservationDetailsByIds([reservationId]);
  return reservation ?? null;
}

type ReservationDetailDto = NonNullable<Awaited<ReturnType<typeof getReservationDetailById>>>;

function reservationForAgent(reservation: ReservationDetailDto | null) {
  if (!reservation) return null;
  return {
    id: reservation.id,
    roomId: reservation.roomId,
    clientId: reservation.clientId,
    checkInDate: reservation.checkInDate,
    checkOutDate: reservation.checkOutDate,
    status: reservation.status,
    version: reservation.version,
    totalPrice: reservation.totalPrice,
    guests: reservation.guests.map((guest) => ({
      id: guest.id,
      name: guest.name,
      age: guest.age,
      pricingRuleId: guest.pricingRuleId
    }))
  };
}

function reservationResponse(req: Request, reservation: ReservationDetailDto | null) {
  return req.isAgentsService ? reservationForAgent(reservation) : reservation;
}

async function appendReservationEvent(
  client: { query: (text: string, params?: unknown[]) => Promise<unknown> },
  params: {
    reservationId: string;
    actorId?: string;
    actorType?: "user" | "agents-service" | "system";
    action: string;
    previousState?: unknown;
    nextState?: unknown;
    reason?: string;
    correlationId?: string;
  }
) {
  await client.query(
    `INSERT INTO reservation_events
       (id, reservation_id, actor_type, actor_id, action, previous_state, next_state, reason, correlation_id)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8, $9)`,
    [
      randomUUID(), params.reservationId, params.actorType ?? "user", params.actorId ?? null,
      params.action, JSON.stringify(params.previousState ?? null), JSON.stringify(params.nextState ?? null),
      params.reason ?? null, params.correlationId ?? null
    ]
  );
}

reservationsRouter.post(
  "/reservations/:id/payments/:paymentId/reverse",
  validate({ params: reservationIdSchema.extend({ paymentId: reservationIdSchema.shape.id }), body: reverseReservationPaymentSchema }),
  asyncHandler(async (req, res) => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const reservationRows = await client.query<ReservationReferenceRow>(
        `SELECT id FROM reservations WHERE id = $1 FOR UPDATE`, [req.params.id]
      );
      if (!reservationRows.rows[0]) throw new HttpError(404, "Reserva não encontrada.");
      const originalRows = await client.query<PaymentRow>(
        `SELECT id, reservation_id, stage, method, amount::text AS amount, note,
                idempotency_key::text AS idempotency_key, entry_type, reversed_payment_id::text AS reversed_payment_id,
                created_at::text AS created_at
         FROM reservation_payments WHERE id = $1 AND reservation_id = $2 FOR UPDATE`,
        [req.params.paymentId, req.params.id]
      );
      const original = originalRows.rows[0];
      if (!original || original.entry_type !== "payment") throw new HttpError(404, "Pagamento original não encontrado.");
      const duplicate = await client.query<{
        id: string;
        entry_type: "payment" | "reversal";
        amount: string;
        note: string;
        reversed_payment_id: string | null;
      }>(
        `SELECT id, entry_type, amount::text AS amount, note, reversed_payment_id::text AS reversed_payment_id
         FROM reservation_payments WHERE reservation_id = $1 AND idempotency_key = $2 LIMIT 1`,
        [req.params.id, req.body.idempotencyKey]
      );
      if (duplicate.rows[0]) {
        const previous = duplicate.rows[0];
        if (
          previous.entry_type !== "reversal" ||
          previous.reversed_payment_id !== original.id ||
          previous.note !== req.body.reason ||
          moneyToCents(previous.amount) !== -moneyToCents(req.body.amount)
        ) {
          throw new HttpError(409, "A chave de idempotência já foi usada com dados diferentes.");
        }
        await client.query("COMMIT");
        res.status(200).json({ reservation: await getReservationDetailById(req.params.id), idempotent: true });
        return;
      }
      const priorReversals = await client.query<{ reversed: string }>(
        `SELECT COALESCE(SUM(amount), 0)::text AS reversed FROM reservation_payments WHERE reversed_payment_id = $1`,
        [original.id]
      );
      const reversedCents = Math.abs(moneyToCents(priorReversals.rows[0]?.reversed ?? "0"));
      const originalCents = moneyToCents(original.amount);
      const remainingCents = Math.max(0, originalCents - reversedCents);
      if (moneyToCents(req.body.amount) > remainingCents) {
        throw new HttpError(409, "A reversão excede o valor ainda reversível do pagamento.", {
          remaining: centsToMoney(remainingCents)
        });
      }
      await client.query(
        `INSERT INTO reservation_payments
           (id, reservation_id, stage, method, amount, note, idempotency_key, entry_type, reversed_payment_id, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'reversal', $8, $9)`,
        [randomUUID(), req.params.id, original.stage, original.method, -req.body.amount,
          req.body.reason, req.body.idempotencyKey, original.id, req.user?.id ?? req.agentInitiatorId ?? null]
      );
      await appendReservationEvent(client, {
        reservationId: req.params.id, actorId: req.user?.id ?? req.agentInitiatorId,
        actorType: req.isAgentsService ? "agents-service" : "user", action: "payment_reversed",
        nextState: { paymentId: original.id, amount: req.body.amount }, reason: req.body.reason,
        correlationId: req.body.correlationId ?? req.body.idempotencyKey
      });
      await client.query("COMMIT");
      res.status(201).json({ reservation: await getReservationDetailById(req.params.id) });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  })
);

reservationsRouter.post(
  "/reservations/quote",
  validate({ body: reservationQuoteSchema }),
  asyncHandler(async (req, res) => {
    assertManualPricingAuthorization(req, req.body);
    const stayPeriod = resolveReservationStayPeriod({
      checkInRaw: req.body.checkInDate,
      checkOutRaw: req.body.checkOutDate,
      requireCheckIn: true
    });
    if (!stayPeriod) throw new HttpError(400, "A data de check-out deve ser posterior ao check-in.");

    const [roomRows, clientRows, existingRows] = await Promise.all([
      query<RoomForReservationRow>(
        `SELECT rm.id, rm.capacity, rm.daily_price::text AS daily_price, rm.status,
                c.single_price::text AS single_price, c.couple_price::text AS couple_price
         FROM rooms rm
         INNER JOIN categories c ON c.id = rm.category_id
         WHERE rm.id = $1`,
        [req.body.roomId]
      ),
      query<ClientReferenceRow>(`SELECT id FROM clients WHERE id = $1 LIMIT 1`, [req.body.clientId]),
      req.body.reservationId
        ? query<ReservationReferenceRow>(
            `SELECT id, room_id, rate_type, base_daily_rate::text AS base_daily_rate,
                    discount_amount::text AS discount_amount, price_source,
                    price_override_reason, priced_by
             FROM reservations WHERE id = $1 LIMIT 1`,
            [req.body.reservationId]
          )
        : Promise.resolve([] as ReservationReferenceRow[])
    ]);
    const room = roomRows[0];
    if (!room) throw new HttpError(404, "Quarto não encontrado.");
    if (isMaintenanceRoomStatus(room.status)) throw new HttpError(400, "Quarto em manutenção não pode receber reservas.");
    if (clientRows.length === 0) throw new HttpError(404, "Cliente não encontrado.");
    if (req.body.reservationId && existingRows.length === 0) throw new HttpError(404, "Reserva não encontrada.");

    const conflicts = await query<{ id: string }>(
      `SELECT id FROM reservations
       WHERE room_id = $1
          AND status = ANY($5::text[])
          AND ($4::uuid IS NULL OR id <> $4::uuid)
          AND check_in_date < $3::timestamptz
          AND check_out_date > $2::timestamptz
       LIMIT 1`,
      [room.id, stayPeriod.checkInDate.toISOString(), stayPeriod.checkOutDate.toISOString(), req.body.reservationId ?? null, BLOCKING_RESERVATION_STATUSES]
    );
    if (conflicts.length > 0) {
      throw new HttpError(409, "O quarto não está disponível para o período informado.");
    }

    const guests: ReservationGuest[] = req.body.guests.map((guest: ReservationGuest) => ({
      id: randomUUID(), reservationId: "", name: guest.name, age: guest.age,
      pricingRuleId: guest.pricingRuleId ?? null
    }));
    const ruleIds = Array.from(new Set(guests.map((guest) => guest.pricingRuleId).filter((id): id is string => Boolean(id))));
    const pricingRuleRows = await query<PricingRuleRow>(
      `SELECT id, name, description, min_age, max_age, price::text AS price
       FROM pricing_rules WHERE id = ANY($1::uuid[])`,
      [ruleIds]
    );
    const pricingRules = mapPricingRules(pricingRuleRows);
    validateReservationGuests(guests, room.capacity, pricingRules);
    const { pricing } = resolveReservationPricingSnapshot({
      room,
      guests,
      pricingRules,
      checkInDate: stayPeriod.checkInDate,
      checkOutDate: stayPeriod.checkOutDate,
      body: req.body,
      existing: existingRows[0]
    });

    res.json({
      roomId: room.id,
      clientId: req.body.clientId,
      checkInDate: stayPeriod.checkInDate.toISOString(),
      checkOutDate: stayPeriod.checkOutDate.toISOString(),
      totalGuestCount: guests.length + 1,
      pricing
    });
  })
);

reservationsRouter.get(
  ["/reservations", "/Reservations"],
  validate({ query: reservationListQuerySchema }),
  asyncHandler(async (req, res) => {
    const page = Number(req.query.page ?? 1);
    const pageSize = Number(req.query.pageSize ?? req.query.limit ?? 20);
    const offset = (page - 1) * pageSize;

    const statusFilter = Array.isArray(req.query.status)
      ? req.query.status as string[]
      : req.query.status
        ? [String(req.query.status)]
        : null;
    const searchParam = ((req.query.search ?? req.query.q) as string | undefined)?.trim() || null;
    const roomId = (req.query.roomId as string | undefined) || null;
    const checkInFrom = (req.query.checkInFrom as string | undefined) || null;
    const checkInTo = (req.query.checkInTo as string | undefined) || null;
    const checkOutFrom = (req.query.checkOutFrom as string | undefined) || null;
    const checkOutTo = (req.query.checkOutTo as string | undefined) || null;

    // Build a shared WHERE clause applied to both COUNT and SELECT queries.
    // Parameters are positional; we accumulate them in order.
    const params: unknown[] = [];
    const conditions: string[] = [];

    if (statusFilter) {
      params.push(statusFilter);
      conditions.push(`r.status = ANY($${params.length}::text[])`);
    }
    if (searchParam) {
      const escapedSearch = searchParam.replace(/[\\%_]/g, "\\$&");
      params.push(`%${escapedSearch}%`);
      conditions.push(`cl.full_name ILIKE $${params.length} ESCAPE '\\'`);
    }
    if (roomId) {
      params.push(roomId);
      conditions.push(`r.room_id = $${params.length}::uuid`);
    }
    const addCivilBoundary = (value: string, field: "check_in_date" | "check_out_date", inclusive: boolean) => {
      const boundary = hotelCivilDateToUtc(value, 0);
      if (!boundary) throw new HttpError(400, "Filtro de data inválido.");
      params.push(boundary.toISOString());
      conditions.push(`r.${field} ${inclusive ? ">=" : "<"} $${params.length}::timestamptz`);
    };
    if (checkInFrom) addCivilBoundary(checkInFrom, "check_in_date", true);
    if (checkInTo) {
      const nextDate = nextHotelCivilDateToUtc(checkInTo, 0);
      if (!nextDate) throw new HttpError(400, "Filtro de data inválido.");
      params.push(nextDate.toISOString());
      conditions.push(`r.check_in_date < $${params.length}::timestamptz`);
    }
    if (checkOutFrom) addCivilBoundary(checkOutFrom, "check_out_date", true);
    if (checkOutTo) {
      const nextDate = nextHotelCivilDateToUtc(checkOutTo, 0);
      if (!nextDate) throw new HttpError(400, "Filtro de data inválido.");
      params.push(nextDate.toISOString());
      conditions.push(`r.check_out_date < $${params.length}::timestamptz`);
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
      LEFT JOIN LATERAL (
        SELECT e.action, e.actor_type, e.created_at
        FROM reservation_events e
        WHERE e.reservation_id = r.id
        ORDER BY e.created_at DESC, e.id DESC
        LIMIT 1
      ) AS last_event ON true
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
            r.rate_type,
            r.base_daily_rate::text AS base_daily_rate,
            r.night_count,
            r.additional_daily_total::text AS additional_daily_total,
            r.subtotal_price::text AS subtotal_price,
            r.price_source,
            r.discount_amount::text AS discount_amount,
            r.price_override_reason,
            r.priced_by,
            r.version,
            r.idempotency_key::text AS idempotency_key,
            r.idempotency_fingerprint,
            r.created_at::text AS created_at,
            r.updated_at::text AS updated_at,
            last_event.action AS last_event_action,
            last_event.actor_type AS last_event_actor_type,
            last_event.created_at::text AS last_event_created_at,
            rm.number AS room_number,
            rm.type AS room_type,
            rm.daily_price::text AS room_daily_price,
            cl.full_name AS client_full_name,
            cl.cpf AS client_cpf
          ${baseQuery}
          ORDER BY r.check_in_date DESC, r.created_at DESC, r.id ASC
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
  ["/reservations", "/Reservations"],
  validate({ body: createReservationSchema }),
  asyncHandler(async (req, res) => {
    assertManualPricingAuthorization(req, req.body);
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(`SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`, [req.body.idempotencyKey]);

      const stayPeriod = resolveReservationStayPeriod({
        checkInRaw: req.body.checkInDate,
        checkOutRaw: req.body.checkOutDate,
        requireCheckIn: true
      });
      if (!stayPeriod) {
        throw new HttpError(400, "A data de check-out deve ser posterior ao check-in.");
      }
      const { checkInDate, checkOutDate } = stayPeriod;
      await client.query(`SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`, [req.body.roomId]);
      const requestedStatus = req.body.status ?? "Pendente";
      if (requestedStatus === "Confirmada" && req.user?.role !== "admin") {
        throw new HttpError(403, "Somente um administrador pode criar uma reserva já confirmada.");
      }
      if (requestedStatus === "Confirmada" && !req.body.statusReason) {
        throw new HttpError(400, "Informe a justificativa administrativa para criar Confirmada.");
      }

      const guests: ReservationGuest[] = req.body.guests.map((g: ReservationGuest) => ({
        id: randomUUID(),
        reservationId: "",
        name: g.name,
        age: g.age,
        pricingRuleId: g.pricingRuleId ?? null
      }));
      const fingerprint = reservationRequestFingerprint({
        roomId: req.body.roomId,
        clientId: req.body.clientId,
        checkInDate,
        checkOutDate,
        status: requestedStatus,
        guests,
        dailyRateOverride: req.body.dailyRateOverride,
        discountAmount: req.body.discountAmount,
        priceOverrideReason: req.body.priceOverrideReason
      });
      const existingByKey = await client.query<ReservationReferenceRow>(
        `SELECT id, idempotency_key, idempotency_fingerprint
         FROM reservations
         WHERE idempotency_key = $1
         FOR UPDATE`,
        [req.body.idempotencyKey]
      );
      if (existingByKey.rows[0]) {
        if (existingByKey.rows[0].idempotency_fingerprint !== fingerprint) {
          throw new HttpError(409, "A chave de idempotência já foi usada com dados diferentes.");
        }
        await client.query("COMMIT");
        const existingReservation = await getReservationDetailById(existingByKey.rows[0].id);
        res.status(200).json({ ...reservationResponse(req, existingReservation), idempotent: true });
        return;
      }

      const roomRows = await client.query<RoomForReservationRow>(
        `SELECT rm.id, rm.capacity, rm.daily_price::text AS daily_price, rm.status,
                c.single_price::text AS single_price, c.couple_price::text AS couple_price
         FROM rooms rm
         INNER JOIN categories c ON c.id = rm.category_id
         WHERE rm.id = $1
         FOR UPDATE OF rm`,
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
        [req.body.roomId, checkInDate.toISOString(), checkOutDate.toISOString(), null, BLOCKING_RESERVATION_STATUSES]
      );
      if ((conflicts.rowCount ?? 0) > 0)
        throw new HttpError(409, "Ja existe uma reserva nesse quarto para o periodo informado.");

      const pricingRuleIds = Array.from(
        new Set(
          guests
            .map((guest) => guest.pricingRuleId)
            .filter((id): id is string => Boolean(id))
        )
      );
      const priceRuleRows = await client.query<PricingRuleRow>(
        `SELECT id, name, description, min_age, max_age, price::text AS price
         FROM pricing_rules
         WHERE id = ANY($1::uuid[])`,
        [pricingRuleIds]
      );
      const pricingRules = mapPricingRules(priceRuleRows.rows);
      validateReservationGuests(guests, room.capacity, pricingRules);

      const pricingSnapshot = resolveReservationPricingSnapshot({
        room,
        guests,
        pricingRules,
        checkInDate,
        checkOutDate,
        body: req.body,
        pricedByUserId: req.user?.id
      });
      const { pricing, overrideReason, pricedBy } = pricingSnapshot;

      const reservationId = randomUUID();
      await client.query(
        `INSERT INTO reservations (
           id, room_id, client_id, check_in_date, check_out_date, status, total_price,
           rate_type, base_daily_rate, night_count, additional_daily_total, subtotal_price,
           price_source, discount_amount, price_override_reason, priced_by,
           idempotency_key, idempotency_fingerprint
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)`,
        [
          reservationId,
          req.body.roomId,
          req.body.clientId,
          checkInDate.toISOString(),
          checkOutDate.toISOString(),
          requestedStatus,
          pricing.totalPrice,
          pricing.rateType,
          pricing.dailyRate,
          pricing.nights,
          pricing.additionalDailyTotal,
          pricing.subtotal,
          pricing.priceSource,
          pricing.discountAmount,
          overrideReason,
          pricedBy,
          req.body.idempotencyKey,
          fingerprint
        ]
      );

      for (const guest of guests) {
        await client.query(
          `INSERT INTO reservation_guests (id, reservation_id, name, age, pricing_rule_id)
           VALUES ($1, $2, $3, $4, $5)`,
          [guest.id, reservationId, guest.name, guest.age, guest.pricingRuleId]
        );
      }

      await appendReservationEvent(client, {
        reservationId,
        actorId: req.user?.id ?? req.agentInitiatorId,
        action: "created",
        actorType: req.isAgentsService ? "agents-service" : "user",
        nextState: { status: requestedStatus, version: 1, totalPrice: pricing.totalPrice },
        reason: req.body.statusReason ?? req.body.priceOverrideReason,
        correlationId: req.body.correlationId ?? req.body.idempotencyKey
      });

      await client.query("COMMIT");

      const createdReservation = await getReservationDetailById(reservationId);
      res.status(201).json(reservationResponse(req, createdReservation));
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  })
);

reservationsRouter.put(
  ["/reservations/:id", "/Reservations/:id"],
  validate({ params: reservationIdSchema, body: updateReservationSchema }),
  asyncHandler(async (req, res) => {
    assertManualPricingAuthorization(req, req.body);
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const existingRows = await client.query<ReservationReferenceRow>(
        `SELECT id, room_id, rate_type, base_daily_rate::text AS base_daily_rate,
                discount_amount::text AS discount_amount, price_source,
                price_override_reason, priced_by, status, version,
                total_price::text AS total_price,
                check_in_date::text AS check_in_date, check_out_date::text AS check_out_date
         FROM reservations
         WHERE id = $1
         LIMIT 1
         FOR UPDATE`,
        [req.params.id]
      );
      const existingReservation = existingRows.rows[0];
      if (!existingReservation) throw new HttpError(404, "Reserva nao encontrada.");
      const operationFingerprint = requestFingerprint(req.body);
      if (req.body.idempotencyKey) {
        const replay = await client.query<{ next_state: { requestFingerprint?: string } | null }>(
          `SELECT next_state FROM reservation_events
           WHERE reservation_id = $1 AND action = 'updated' AND correlation_id = $2
           ORDER BY created_at DESC LIMIT 1`,
          [existingReservation.id, req.body.idempotencyKey]
        );
        if (replay.rows[0]) {
          if (replay.rows[0].next_state?.requestFingerprint !== operationFingerprint) {
            throw new HttpError(409, "A chave de idempotência já foi usada com dados diferentes.");
          }
          await client.query("COMMIT");
          res.status(200).json({ ...reservationResponse(req, await getReservationDetailById(existingReservation.id)), idempotent: true });
          return;
        }
      }
      if (existingReservation.version !== req.body.version) {
        throw new HttpError(409, "A reserva foi alterada por outra operação. Atualize os dados e tente novamente.");
      }
      const currentStatus = normalizeReservationStatus(existingReservation.status ?? "");
      if (currentStatus === "Cancelada" || currentStatus === "Concluída") {
        throw new HttpError(409, "Reservas canceladas ou concluídas não podem ser editadas.");
      }
      const roomIds = Array.from(new Set([existingReservation.room_id, req.body.roomId])).sort();
      for (const roomId of roomIds) {
        await client.query(`SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`, [roomId]);
      }
      const roomRows = await client.query<RoomForReservationRow>(
        `SELECT rm.id, rm.capacity, rm.daily_price::text AS daily_price, rm.status,
                c.single_price::text AS single_price, c.couple_price::text AS couple_price
         FROM rooms rm
         INNER JOIN categories c ON c.id = rm.category_id
         WHERE rm.id = ANY($1::uuid[])
         ORDER BY rm.id
         FOR UPDATE OF rm`,
        [roomIds]
      );
      const room = roomRows.rows.find((item) => item.id === req.body.roomId);
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
          existingReservation.id, BLOCKING_RESERVATION_STATUSES]
      );
      if ((conflicts.rowCount ?? 0) > 0)
        throw new HttpError(409, "Ja existe uma reserva nesse quarto para o periodo informado.");

      const guestsProvided = req.body.guests !== undefined;
      const guests: ReservationGuest[] = guestsProvided
        ? req.body.guests.map((g: ReservationGuest) => ({
            id: randomUUID(),
            reservationId: existingReservation.id,
            name: g.name,
            age: g.age,
            pricingRuleId: g.pricingRuleId ?? null
          }))
        : (await client.query<Pick<ReservationGuest, "id" | "name" | "age" | "pricingRuleId">>(
            `SELECT id, name, age, pricing_rule_id AS "pricingRuleId"
             FROM reservation_guests
             WHERE reservation_id = $1
             ORDER BY created_at ASC`,
            [existingReservation.id]
          )).rows.map((guest) => ({
            id: guest.id,
            reservationId: existingReservation.id,
            name: guest.name,
            age: guest.age,
            pricingRuleId: guest.pricingRuleId
          }));

      const pricingRuleIds = Array.from(
        new Set(
          guests
            .map((guest) => guest.pricingRuleId)
            .filter((id): id is string => Boolean(id))
        )
      );
      const priceRuleRows = await client.query<PricingRuleRow>(
        `SELECT id, name, description, min_age, max_age, price::text AS price
         FROM pricing_rules
         WHERE id = ANY($1::uuid[])`,
        [pricingRuleIds]
      );
      const pricingRules = mapPricingRules(priceRuleRows.rows);
      validateReservationGuests(guests, room.capacity, pricingRules);

      const pricingSnapshot = resolveReservationPricingSnapshot({
        room,
        guests,
        pricingRules,
        checkInDate,
        checkOutDate,
        body: req.body,
        existing: existingReservation,
        pricedByUserId: req.user?.id
      });
      const { pricing, overrideReason, pricedBy } = pricingSnapshot;

      await client.query(
        `UPDATE reservations
         SET room_id = $1, client_id = $2, check_in_date = $3, check_out_date = $4,
             status = $5, total_price = $6, rate_type = $7, base_daily_rate = $8,
             night_count = $9, additional_daily_total = $10, subtotal_price = $11,
             price_source = $12, discount_amount = $13, price_override_reason = $14,
             priced_by = $15, version = version + 1, updated_at = NOW()
         WHERE id = $16 AND version = $17`,
        [req.body.roomId, req.body.clientId, checkInDate.toISOString(), checkOutDate.toISOString(),
          existingReservation.status, pricing.totalPrice, pricing.rateType, pricing.dailyRate, pricing.nights,
          pricing.additionalDailyTotal, pricing.subtotal, pricing.priceSource, pricing.discountAmount,
          overrideReason, pricedBy, existingReservation.id, req.body.version]
      );

      if (guestsProvided) {
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
      }

      await appendReservationEvent(client, {
        reservationId: existingReservation.id,
        actorId: req.user?.id ?? req.agentInitiatorId,
        actorType: req.isAgentsService ? "agents-service" : "user",
        action: "updated",
        previousState: {
          roomId: existingReservation.room_id,
          checkInDate: existingReservation.check_in_date,
          checkOutDate: existingReservation.check_out_date,
          status: existingReservation.status,
          totalPrice: existingReservation.total_price ? Number(existingReservation.total_price) : undefined,
          version: existingReservation.version
        },
        nextState: {
          roomId: req.body.roomId,
          clientId: req.body.clientId,
          checkInDate: checkInDate.toISOString(),
          checkOutDate: checkOutDate.toISOString(),
          totalPrice: pricing.totalPrice,
          status: existingReservation.status,
          version: existingReservation.version! + 1,
          requestFingerprint: operationFingerprint
        },
        reason: req.body.priceOverrideReason ?? existingReservation.price_override_reason ?? undefined,
        correlationId: req.body.idempotencyKey ?? req.body.correlationId
      });

      await client.query("COMMIT");

      const updatedReservation = await getReservationDetailById(existingReservation.id);
      res.json(reservationResponse(req, updatedReservation));
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  })
);

async function cancelReservation(req: Request, res: Response) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query<ReservationReferenceRow>(
      `SELECT id, status, version FROM reservations WHERE id = $1 FOR UPDATE`,
      [req.params.id]
    );
    const reservation = result.rows[0];
    if (!reservation) throw new HttpError(404, "Reserva não encontrada.");
    const operationFingerprint = requestFingerprint(req.body);
    if (req.body.idempotencyKey) {
      const replay = await client.query<{ next_state: { requestFingerprint?: string } | null }>(
        `SELECT next_state FROM reservation_events
         WHERE reservation_id = $1 AND action = 'cancelled' AND correlation_id = $2
         ORDER BY created_at DESC LIMIT 1`,
        [reservation.id, req.body.idempotencyKey]
      );
      if (replay.rows[0]) {
        if (replay.rows[0].next_state?.requestFingerprint !== operationFingerprint) {
          throw new HttpError(409, "A chave de idempotência já foi usada com dados diferentes.");
        }
        await client.query("COMMIT");
        res.status(200).json({ ...reservationResponse(req, await getReservationDetailById(reservation.id)), idempotent: true });
        return;
      }
    }
    if (reservation.version !== req.body.version) {
      throw new HttpError(409, "A reserva foi alterada por outra operação. Atualize os dados e tente novamente.");
    }
    const currentStatus = normalizeReservationStatus(reservation.status ?? "");
    if (!currentStatus || !canTransitionReservation(currentStatus, "Cancelada")) {
      throw new HttpError(409, "A reserva só pode ser cancelada enquanto estiver Pendente ou Confirmada.");
    }

    await client.query(
      `UPDATE reservations SET status = 'Cancelada', version = version + 1, updated_at = NOW()
       WHERE id = $1 AND version = $2`,
      [reservation.id, reservation.version]
    );
    await appendReservationEvent(client, {
      reservationId: reservation.id,
      actorId: req.user?.id ?? req.agentInitiatorId,
      actorType: req.isAgentsService ? "agents-service" : "user",
      action: "cancelled",
      previousState: { status: reservation.status, version: reservation.version },
      nextState: {
        status: "Cancelada",
        version: reservation.version! + 1,
        requestFingerprint: operationFingerprint
      },
      reason: req.body.reason,
      correlationId: req.body.idempotencyKey ?? req.body.correlationId
    });
    await client.query("COMMIT");
    res.json(reservationResponse(req, await getReservationDetailById(reservation.id)));
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

reservationsRouter.post(
  "/reservations/:id/cancel",
  validate({ params: reservationIdSchema, body: cancelReservationSchema }),
  asyncHandler(cancelReservation)
);

reservationsRouter.delete(
  "/Reservations/:id",
  validate({ params: reservationIdSchema, body: cancelReservationSchema }),
  asyncHandler(cancelReservation)
);

reservationsRouter.post(
  "/reservations/:id/transitions",
  validate({ params: reservationIdSchema, body: reservationTransitionSchema }),
  asyncHandler(async (req, res) => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const existingRows = await client.query<ReservationReferenceRow>(
        `SELECT id, status, version, check_in_date::text AS check_in_date,
                check_out_date::text AS check_out_date
         FROM reservations WHERE id = $1 FOR UPDATE`,
        [req.params.id]
      );
      const reservation = existingRows.rows[0];
      if (!reservation) throw new HttpError(404, "Reserva não encontrada.");
      const operationFingerprint = requestFingerprint(req.body);
      if (req.body.idempotencyKey) {
        const replay = await client.query<{ next_state: { requestFingerprint?: string } | null }>(
          `SELECT next_state FROM reservation_events
           WHERE reservation_id = $1 AND action = 'status_transition' AND correlation_id = $2
           ORDER BY created_at DESC LIMIT 1`,
          [reservation.id, req.body.idempotencyKey]
        );
        if (replay.rows[0]) {
          if (replay.rows[0].next_state?.requestFingerprint !== operationFingerprint) {
            throw new HttpError(409, "A chave de idempotência já foi usada com dados diferentes.");
          }
          await client.query("COMMIT");
          res.status(200).json({ ...(await getReservationDetailById(reservation.id)), idempotent: true });
          return;
        }
      }
      if (reservation.version !== req.body.version) {
        throw new HttpError(409, "A reserva foi alterada por outra operação. Atualize os dados e tente novamente.");
      }
      const currentStatus = normalizeReservationStatus(reservation.status ?? "");
      const targetStatus = normalizeReservationStatus(req.body.targetStatus);
      if (!currentStatus || !targetStatus || !canTransitionReservation(currentStatus, targetStatus)) {
        throw new HttpError(409, "Transição de status inválida.");
      }
      const timingError = transitionTimingError(
        targetStatus,
        new Date(reservation.check_in_date ?? ""),
        new Date(reservation.check_out_date ?? "")
      );
      if (timingError) throw new HttpError(409, timingError);
      await client.query(
        `UPDATE reservations SET status = $1, version = version + 1, updated_at = NOW()
         WHERE id = $2 AND version = $3`,
        [targetStatus, reservation.id, reservation.version]
      );
      await appendReservationEvent(client, {
        reservationId: reservation.id,
        actorId: req.user?.id ?? req.agentInitiatorId,
        actorType: req.isAgentsService ? "agents-service" : "user",
        action: "status_transition",
        previousState: { status: currentStatus, version: reservation.version },
        nextState: {
          status: targetStatus,
          version: reservation.version! + 1,
          requestFingerprint: operationFingerprint
        },
        reason: req.body.reason,
        correlationId: req.body.idempotencyKey ?? req.body.correlationId
      });
      await client.query("COMMIT");
      res.json(await getReservationDetailById(reservation.id));
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  })
);

reservationsRouter.get(
  ["/reservations/:id/payments", "/Reservations/:id/payments"],
  validate({ params: reservationIdSchema }),
  asyncHandler(async (req, res) => {
    const reservation = await getReservationDetailById(req.params.id);
    if (!reservation) {
      throw new HttpError(404, "Reserva nao encontrada.");
    }

    res.json({ items: reservation.payments ?? [] });
  })
);

reservationsRouter.get(
  ["/reservations/:id([0-9a-fA-F-]{36})", "/Reservations/:id([0-9a-fA-F-]{36})"],
  validate({ params: reservationIdSchema }),
  asyncHandler(async (req, res) => {
    const reservation = await getReservationDetailById(req.params.id);
    if (!reservation) throw new HttpError(404, "Reserva não encontrada.");
    res.json(reservationResponse(req, reservation));
  })
);

reservationsRouter.post(
  ["/reservations/:id/payments", "/Reservations/:id/payments"],
  validate({ params: reservationIdSchema, body: createReservationPaymentSchema }),
  asyncHandler(async (req, res) => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const reservationRows = await client.query<ReservationReferenceRow & { total_price: string }>(
        `
          SELECT
            r.id,
            r.status,
            r.total_price::text AS total_price
          FROM reservations r
          WHERE r.id = $1
          LIMIT 1
          FOR UPDATE
        `,
        [req.params.id]
      );

      const reservation = reservationRows.rows[0];
      if (!reservation) throw new HttpError(404, "Reserva não encontrada.");

      const duplicate = await client.query<{
        id: string;
        stage: ReservationPaymentStage;
        method: ReservationPaymentMethod;
        amount: string;
        note: string;
        entry_type: "payment" | "reversal";
      }>(
        `SELECT id, stage, method, amount::text AS amount, note, entry_type
         FROM reservation_payments
         WHERE reservation_id = $1 AND idempotency_key = $2
         LIMIT 1`,
        [req.params.id, req.body.idempotencyKey]
      );
      if (duplicate.rows[0]) {
        const previous = duplicate.rows[0];
        if (
          previous.entry_type !== "payment" ||
          previous.stage !== req.body.stage ||
          previous.method !== req.body.method ||
          previous.note !== (req.body.note ?? "") ||
          moneyToCents(previous.amount) !== moneyToCents(req.body.amount)
        ) {
          throw new HttpError(409, "A chave de idempotência já foi usada com dados diferentes.");
        }
        await client.query("COMMIT");
        res.status(200).json({ reservation: await getReservationDetailById(req.params.id), idempotent: true });
        return;
      }

      if (reservation.status === "Cancelada") {
        throw new HttpError(400, "Não é possível registrar pagamento para reserva cancelada.");
      }

      const sum = await client.query<{ total_paid: string }>(
        `SELECT COALESCE(SUM(amount), 0)::text AS total_paid
         FROM reservation_payments WHERE reservation_id = $1`,
        [req.params.id]
      );
      const totalPaidCents = moneyToCents(sum.rows[0]?.total_paid ?? "0");
      const balanceDueCents = moneyToCents(reservation.total_price) - totalPaidCents;
      if (moneyToCents(req.body.amount) > Math.max(0, balanceDueCents)) {
        throw new HttpError(409, "O pagamento excede o saldo pendente da reserva.", {
          balanceDue: centsToMoney(Math.max(0, balanceDueCents))
        });
      }

      await client.query(
        `INSERT INTO reservation_payments
           (id, reservation_id, stage, method, amount, note, idempotency_key, entry_type, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'payment', $8)`,
        [randomUUID(), req.params.id, req.body.stage, req.body.method, req.body.amount,
          req.body.note ?? "", req.body.idempotencyKey, req.user?.id ?? req.agentInitiatorId ?? null]
      );
      await appendReservationEvent(client, {
        reservationId: req.params.id,
        actorId: req.user?.id ?? req.agentInitiatorId,
        actorType: req.isAgentsService ? "agents-service" : "user",
        action: "payment_recorded",
        nextState: {
          amount: req.body.amount,
          balanceDue: centsToMoney(Math.max(0, balanceDueCents - moneyToCents(req.body.amount)))
        },
        correlationId: req.body.correlationId ?? req.body.idempotencyKey
      });

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
    const bounds = hotelDayBounds();
    if (!bounds) throw new HttpError(500, "Não foi possível resolver o dia do hotel.");
    const rows = await query<{
      check_ins_hoje: number;
      check_outs_hoje: number;
      reservas_ativas: number;
      pendencias_vencidas: number;
      occupied_rooms: number;
      total_rooms: number;
    }>(
      `
        SELECT
          COUNT(*) FILTER (WHERE status <> 'Cancelada' AND check_in_date >= $3::timestamptz AND check_in_date < $4::timestamptz)::int AS check_ins_hoje,
          COUNT(*) FILTER (WHERE status <> 'Cancelada' AND check_out_date >= $3::timestamptz AND check_out_date < $4::timestamptz)::int AS check_outs_hoje,
          COUNT(*) FILTER (
            WHERE status = ANY($2::text[])
              AND NOT (status IN ('Pendente', 'Confirmada') AND check_out_date < CURRENT_TIMESTAMP)
          )::int AS reservas_ativas,
          COUNT(*) FILTER (
            WHERE status IN ('Pendente', 'Confirmada') AND check_out_date < CURRENT_TIMESTAMP
          )::int AS pendencias_vencidas,
          (
            SELECT COUNT(DISTINCT r.room_id)::int
            FROM reservations r
            INNER JOIN rooms rm ON rm.id = r.room_id
            WHERE rm.status <> $1
              AND r.status = ANY($2::text[])
              AND r.check_in_date < $4::timestamptz
              AND r.check_out_date > $3::timestamptz
          ) AS occupied_rooms,
          (
            SELECT COUNT(*)::int
            FROM rooms
            WHERE status <> $1
          ) AS total_rooms
        FROM reservations
      `,
      [ROOM_STATUS_MAINTENANCE, ACTIVE_RESERVATION_STATUSES, bounds.start.toISOString(), bounds.end.toISOString()]
    );

    const summary = rows[0] ?? {
      check_ins_hoje: 0,
      check_outs_hoje: 0,
      reservas_ativas: 0,
      pendencias_vencidas: 0,
      occupied_rooms: 0,
      total_rooms: 0
    };

    const monthlyRows = await query<{ month_num: string; taxa: number; quarto_noites: number }>(
      `WITH months AS (
         SELECT date_trunc('month', CURRENT_TIMESTAMP AT TIME ZONE $2)
                  - ((5 - month_offset) * INTERVAL '1 month') AS month_start
         FROM generate_series(0, 5) AS series(month_offset)
       ),
       operational_rooms AS (
         SELECT COUNT(*)::numeric AS room_count
         FROM rooms
         WHERE status <> $1
       ),
       occupied_nights AS (
         SELECT m.month_start, COUNT(*)::numeric AS nights
         FROM months m
         CROSS JOIN LATERAL generate_series(
           m.month_start,
           m.month_start + INTERVAL '1 month' - INTERVAL '1 day',
           INTERVAL '1 day'
         ) AS days(day_start)
         INNER JOIN reservations r
           ON r.status = ANY($3::text[])
          -- Check-out is a civil-date boundary; noon is not an extra room-night.
          AND (r.check_in_date AT TIME ZONE $2)::date <= days.day_start::date
          AND (r.check_out_date AT TIME ZONE $2)::date > days.day_start::date
         INNER JOIN rooms rm ON rm.id = r.room_id AND rm.status <> $1
         GROUP BY m.month_start
       )
       SELECT
         TO_CHAR(m.month_start, 'MM') AS month_num,
         COALESCE(o.nights, 0)::int AS quarto_noites,
         COALESCE(ROUND(
           COALESCE(o.nights, 0)
           / NULLIF(rooms.room_count * EXTRACT(DAY FROM (m.month_start + INTERVAL '1 month' - m.month_start)), 0)
           * 100,
           1
         ), 0)::float AS taxa
       FROM months m
       LEFT JOIN occupied_nights o ON o.month_start = m.month_start
       CROSS JOIN operational_rooms rooms
       ORDER BY m.month_start`,
      [ROOM_STATUS_MAINTENANCE, HOTEL_TIMEZONE, BLOCKING_RESERVATION_STATUSES]
    );

    const taxaOcupacaoMes = monthlyRows.map((row) => ({
      mes: MONTH_LABELS[row.month_num] ?? row.month_num,
      taxa: row.taxa,
      quartoNoites: row.quarto_noites
    }));

    res.json({
      taxaOcupacaoMes,
      checkInsHoje: summary.check_ins_hoje,
      checkOutsHoje: summary.check_outs_hoje,
      reservasAtivas: summary.reservas_ativas,
      pendenciasVencidas: summary.pendencias_vencidas
    });
  })
);

reservationsRouter.get(
  "/reservations/revenue-summary",
  requireRole("admin"),
  asyncHandler(async (_req, res) => {
    const rows = await query<{
      receita_hoje: string;
      receita_mes_atual: string;
      receita_mes_anterior: string;
      recebida_hoje: string;
      recebida_mes_atual: string;
      recebida_mes_anterior: string;
    }>(
      `
        WITH hotel_clock AS (
          SELECT CURRENT_TIMESTAMP AT TIME ZONE $1 AS now_local
        ),
        reserved AS (
          SELECT
            COALESCE(SUM(r.total_price) FILTER (
              WHERE r.status <> 'Cancelada'
                AND (r.check_in_date AT TIME ZONE $1)::date = now_local::date
            ), 0)::text AS receita_hoje,
            COALESCE(SUM(r.total_price) FILTER (
              WHERE r.status <> 'Cancelada'
                AND date_trunc('month', r.check_in_date AT TIME ZONE $1) = date_trunc('month', now_local)
            ), 0)::text AS receita_mes_atual,
            COALESCE(SUM(r.total_price) FILTER (
              WHERE r.status <> 'Cancelada'
                AND date_trunc('month', r.check_in_date AT TIME ZONE $1) = date_trunc('month', now_local - INTERVAL '1 month')
            ), 0)::text AS receita_mes_anterior
          FROM reservations r CROSS JOIN hotel_clock
        ),
        received AS (
          SELECT
            COALESCE(SUM(p.amount) FILTER (
              WHERE (p.created_at AT TIME ZONE $1)::date = now_local::date
            ), 0)::text AS recebida_hoje,
            COALESCE(SUM(p.amount) FILTER (
              WHERE date_trunc('month', p.created_at AT TIME ZONE $1) = date_trunc('month', now_local)
            ), 0)::text AS recebida_mes_atual,
            COALESCE(SUM(p.amount) FILTER (
              WHERE date_trunc('month', p.created_at AT TIME ZONE $1) = date_trunc('month', now_local - INTERVAL '1 month')
            ), 0)::text AS recebida_mes_anterior
          FROM reservation_payments p CROSS JOIN hotel_clock
        )
        SELECT reserved.*, received.* FROM reserved CROSS JOIN received
      `,
      [HOTEL_TIMEZONE]
    );

    const revenue = rows[0] ?? {
      receita_hoje: "0",
      receita_mes_atual: "0",
      receita_mes_anterior: "0",
      recebida_hoje: "0",
      recebida_mes_atual: "0",
      recebida_mes_anterior: "0"
    };

    const toCivilDate = (value: Date) => {
      const year = value.getUTCFullYear();
      const month = String(value.getUTCMonth() + 1).padStart(2, "0");
      const day = String(value.getUTCDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    };
    const currentCivilDate = formatHotelDate(new Date());
    const [currentYear, currentMonth, currentDay] = currentCivilDate.split("-").map(Number);
    const currentMonthStartCivil = toCivilDate(new Date(Date.UTC(currentYear, currentMonth - 1, 1)));
    const nextMonthStartCivil = toCivilDate(new Date(Date.UTC(currentYear, currentMonth, 1)));
    const previousMonthStartCivil = toCivilDate(new Date(Date.UTC(currentYear, currentMonth - 2, 1)));
    const todayEndCivil = toCivilDate(new Date(Date.UTC(currentYear, currentMonth - 1, currentDay + 1)));
    const reportPeriod = (civilFrom: string, civilToExclusive: string) => {
      const from = hotelCivilDateToUtc(civilFrom);
      const to = hotelCivilDateToUtc(civilToExclusive);
      if (!from || !to) throw new HttpError(500, "Não foi possível resolver o período do relatório.");
      return {
        timezone: HOTEL_TIMEZONE,
        civilFrom,
        civilToExclusive,
        from: from.toISOString(),
        to: to.toISOString(),
        interval: "[from,to)"
      };
    };
    const periods = {
      today: reportPeriod(currentCivilDate, todayEndCivil),
      currentMonth: reportPeriod(currentMonthStartCivil, nextMonthStartCivil),
      previousMonth: reportPeriod(previousMonthStartCivil, currentMonthStartCivil)
    };
    const reservedCriterion = "Soma de reservations.total_price para reservas com status diferente de Cancelada, agrupada pela data civil do check-in.";
    const receivedCriterion = "Soma líquida de reservation_payments.amount, incluindo reversões compensatórias, agrupada pela data civil de created_at.";
    const receitaHoje = Number(revenue.receita_hoje);
    const receitaMesAtual = Number(revenue.receita_mes_atual);
    const receitaMesAnterior = Number(revenue.receita_mes_anterior);
    const recebidaHoje = Number(revenue.recebida_hoje);
    const recebidaMesAtual = Number(revenue.recebida_mes_atual);
    const recebidaMesAnterior = Number(revenue.recebida_mes_anterior);

    res.json({
      receitaHoje,
      receitaMesAtual,
      receitaMesAnterior,
      recebidaHoje,
      recebidaMesAtual,
      recebidaMesAnterior,
      metadata: {
        timezone: HOTEL_TIMEZONE,
        indicators: {
          receitaHoje: { value: receitaHoje, period: periods.today, criterion: reservedCriterion },
          receitaMesAtual: { value: receitaMesAtual, period: periods.currentMonth, criterion: reservedCriterion },
          receitaMesAnterior: { value: receitaMesAnterior, period: periods.previousMonth, criterion: reservedCriterion },
          recebidaHoje: { value: recebidaHoje, period: periods.today, criterion: receivedCriterion },
          recebidaMesAtual: { value: recebidaMesAtual, period: periods.currentMonth, criterion: receivedCriterion },
          recebidaMesAnterior: { value: recebidaMesAnterior, period: periods.previousMonth, criterion: receivedCriterion }
        }
      }
    });
  })
);
