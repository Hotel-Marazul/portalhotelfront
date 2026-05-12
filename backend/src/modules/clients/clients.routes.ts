import { randomUUID } from "crypto";
import { Router } from "express";
import { query } from "../../db/client.js";
import { validate } from "../../middlewares/validate.js";
import { HttpError } from "../../utils/http-error.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { clientBodySchema, clientIdSchema } from "./clients.schema.js";

interface ClientRow {
  id: string;
  full_name: string;
  cpf: string;
  email: string;
  fone: string;
  automovel: string;
  placa: string;
}

interface ClientReservationRow {
  id: string;
  client_id: string;
  status: string;
  check_in_date: string;
  check_out_date: string;
  total_price: string;
  room_id: string | null;
  room_number: number | null;
  room_status: string | null;
  category_name: string | null;
  category_price: string | null;
}

interface ReservationGuestRow {
  id: string;
  reservation_id: string;
  name: string;
  age: number;
  pricing_rule_description: string | null;
  pricing_rule_price: string | null;
}

interface ReservationSummaryDto {
  id: string;
  status: string;
  checkInDate: string;
  checkOutDate: string;
  totalPrice: number;
  room?: {
    id: string;
    roomNumber: number;
    status: string;
    categoryName: string;
    categoryPrice: number;
  };
  guests: Array<{
    id: string;
    name: string;
    age: number;
    pricingRuleDescription: string;
    pricingRulePrice: number;
  }>;
}

function normalizeCpf(cpf: string): string {
  return cpf.replace(/\D/g, "");
}

function mapClient(row: ClientRow, reservations?: ReservationSummaryDto[]) {
  return {
    id: row.id,
    fullName: row.full_name,
    cpf: row.cpf,
    email: row.email,
    fone: row.fone,
    automovel: row.automovel,
    placa: row.placa,
    reservations: reservations ?? []
  };
}

async function getReservationsByClientIds(clientIds: string[]) {
  if (clientIds.length === 0) {
    return new Map<string, ReservationSummaryDto[]>();
  }

  const reservationRows = await query<ClientReservationRow>(
    `
      SELECT
        r.id,
        r.client_id,
        r.status,
        r.check_in_date::text AS check_in_date,
        r.check_out_date::text AS check_out_date,
        r.total_price::text AS total_price,
        rm.id AS room_id,
        rm.number AS room_number,
        rm.status AS room_status,
        c.name AS category_name,
        c.price::text AS category_price
      FROM reservations r
      LEFT JOIN rooms rm ON rm.id = r.room_id
      LEFT JOIN categories c ON c.id = rm.category_id
      WHERE r.client_id = ANY($1::uuid[])
      ORDER BY r.check_in_date DESC, r.created_at DESC
    `,
    [clientIds]
  );

  if (reservationRows.length === 0) {
    return new Map<string, ReservationSummaryDto[]>();
  }

  const reservationIds = reservationRows.map((row) => row.id);
  const guestRows = await query<ReservationGuestRow>(
    `
      SELECT
        g.id,
        g.reservation_id,
        g.name,
        g.age,
        pr.description AS pricing_rule_description,
        pr.price::text AS pricing_rule_price
      FROM reservation_guests g
      LEFT JOIN pricing_rules pr ON pr.id = g.pricing_rule_id
      WHERE g.reservation_id = ANY($1::uuid[])
      ORDER BY g.created_at ASC
    `,
    [reservationIds]
  );

  const guestsByReservation = new Map<string, ReservationGuestRow[]>();
  for (const guest of guestRows) {
    const current = guestsByReservation.get(guest.reservation_id) ?? [];
    current.push(guest);
    guestsByReservation.set(guest.reservation_id, current);
  }

  const reservationsByClient = new Map<string, ReservationSummaryDto[]>();
  for (const reservation of reservationRows) {
    const mappedReservation: ReservationSummaryDto = {
      id: reservation.id,
      status: reservation.status,
      checkInDate: reservation.check_in_date,
      checkOutDate: reservation.check_out_date,
      totalPrice: Number(reservation.total_price),
      room:
        reservation.room_id && reservation.room_number !== null
          ? {
              id: reservation.room_id,
              roomNumber: reservation.room_number,
              status: reservation.room_status ?? "",
              categoryName: reservation.category_name ?? "",
              categoryPrice: reservation.category_price ? Number(reservation.category_price) : 0
            }
          : undefined,
      guests: (guestsByReservation.get(reservation.id) ?? []).map((guest) => ({
        id: guest.id,
        name: guest.name,
        age: guest.age,
        pricingRuleDescription: guest.pricing_rule_description ?? "",
        pricingRulePrice: guest.pricing_rule_price ? Number(guest.pricing_rule_price) : 0
      }))
    };

    const currentClientReservations = reservationsByClient.get(reservation.client_id) ?? [];
    currentClientReservations.push(mappedReservation);
    reservationsByClient.set(reservation.client_id, currentClientReservations);
  }

  return reservationsByClient;
}

export const clientsRouter = Router();

clientsRouter.get(
  "/client",
  asyncHandler(async (req, res) => {
    const page   = Math.max(1, parseInt(req.query.page  as string ?? "1",  10) || 1);
    const limit  = Math.min(100, Math.max(1, parseInt(req.query.limit as string ?? "20", 10) || 20));
    const offset = (page - 1) * limit;

    const [rows, countResult] = await Promise.all([
      query<ClientRow>(
        `SELECT id, full_name, cpf, email, fone, automovel, placa
         FROM clients ORDER BY full_name ASC
         LIMIT $1 OFFSET $2`,
        [limit, offset]
      ),
      query<{ total: number }>(
        `SELECT COUNT(*)::int AS total FROM clients`
      )
    ]);

    const total = countResult[0]?.total ?? 0;
    // mapClient sem segundo argumento — reservations fica [] por default
    // Nao chamar getReservationsByClientIds aqui — elimina N+1 queries
    res.json({ items: rows.map(row => mapClient(row)), total, page, pageSize: limit });
  })
);

clientsRouter.get(
  "/client/:id",
  validate({ params: clientIdSchema }),
  asyncHandler(async (req, res) => {
    const rows = await query<ClientRow>(
      `
        SELECT id, full_name, cpf, email, fone, automovel, placa
        FROM clients
        WHERE id = $1
        LIMIT 1
      `,
      [req.params.id]
    );

    const client = rows[0];
    if (!client) {
      throw new HttpError(404, "Cliente não encontrado.");
    }

    const reservationsByClient = await getReservationsByClientIds([client.id]);
    res.json(mapClient(client, reservationsByClient.get(client.id)));
  })
);

clientsRouter.post(
  "/client/create",
  validate({ body: clientBodySchema }),
  asyncHandler(async (req, res) => {
    const cpf = normalizeCpf(req.body.cpf);
    const duplicate = await query<{ id: string }>(`SELECT id FROM clients WHERE cpf = $1 LIMIT 1`, [cpf]);
    if (duplicate.length > 0) {
      throw new HttpError(409, "Já existe cliente com este CPF.");
    }

    const client = {
      id: randomUUID(),
      fullName: req.body.fullName,
      cpf,
      email: req.body.email,
      fone: req.body.fone,
      automovel: req.body.automovel ?? "",
      placa: req.body.placa ?? ""
    };

    await query(
      `
        INSERT INTO clients (id, full_name, cpf, email, fone, automovel, placa)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `,
      [client.id, client.fullName, client.cpf, client.email, client.fone, client.automovel, client.placa]
    );

    res.status(201).json(client);
  })
);

clientsRouter.put(
  "/client/:id",
  validate({ params: clientIdSchema, body: clientBodySchema }),
  asyncHandler(async (req, res) => {
    const existing = await query<{ id: string }>(`SELECT id FROM clients WHERE id = $1 LIMIT 1`, [
      req.params.id
    ]);
    if (existing.length === 0) {
      throw new HttpError(404, "Cliente não encontrado.");
    }

    const cpf = normalizeCpf(req.body.cpf);
    const duplicate = await query<{ id: string }>(
      `
        SELECT id
        FROM clients
        WHERE cpf = $1 AND id <> $2
        LIMIT 1
      `,
      [cpf, req.params.id]
    );
    if (duplicate.length > 0) {
      throw new HttpError(409, "CPF já cadastrado para outro cliente.");
    }

    await query(
      `
        UPDATE clients
        SET full_name = $1, cpf = $2, email = $3, fone = $4, automovel = $5, placa = $6
        WHERE id = $7
      `,
      [
        req.body.fullName,
        cpf,
        req.body.email,
        req.body.fone,
        req.body.automovel ?? "",
        req.body.placa ?? "",
        req.params.id
      ]
    );

    res.json({
      id: req.params.id,
      fullName: req.body.fullName,
      cpf,
      email: req.body.email,
      fone: req.body.fone,
      automovel: req.body.automovel ?? "",
      placa: req.body.placa ?? ""
    });
  })
);
