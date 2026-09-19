import { randomUUID } from "crypto";
import { Router } from "express";
import { pool, query } from "../../db/client.js";
import { validate } from "../../middlewares/validate.js";
import { HttpError } from "../../utils/http-error.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { normalizePhone } from "../whatsapp/phone.js";
import { autoLinkContactsForClient } from "../whatsapp/contact-link.service.js";
import { clientBodySchema, clientIdSchema, clientListQuerySchema, updateClientBodySchema } from "./clients.schema.js";

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

function maskCpf(cpf: string): string {
  return `***.***.***-${cpf.replace(/\D/g, "").slice(-2)}`;
}

function mapClient(row: ClientRow, reservations?: ReservationSummaryDto[], includeSensitive = false) {
  return {
    id: row.id,
    fullName: row.full_name,
    cpf: includeSensitive ? row.cpf : maskCpf(row.cpf),
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
        COALESCE(c.couple_price, c.price)::text AS category_price
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

function buildClientSearch(value: unknown): { text: string; cpf: string } {
  if (typeof value !== "string") return { text: "", cpf: "" };

  const normalized = value.trim().slice(0, 100);
  const escaped = normalized.replace(/[\\%_]/g, "\\$&");
  const cpf = normalized.replace(/\D/g, "");
  return {
    text: escaped ? `%${escaped}%` : "",
    cpf: cpf ? `%${cpf}%` : ""
  };
}

export const clientsRouter = Router();

clientsRouter.get(
  "/client",
  validate({ query: clientListQuerySchema }),
  asyncHandler(async (req, res) => {
    const page = Number(req.query.page);
    const limit = Number(req.query.pageSize ?? req.query.limit ?? 20);
    const offset = (page - 1) * limit;
    const search = buildClientSearch(req.query.search);
    const searchConditions: string[] = [];
    const filterParams: string[] = [];
    if (search.text) {
      filterParams.push(search.text);
      searchConditions.push(
        `full_name ILIKE $${filterParams.length} ESCAPE '\\'`,
        `email ILIKE $${filterParams.length} ESCAPE '\\'`,
        `fone ILIKE $${filterParams.length} ESCAPE '\\'`
      );
    }
    if (search.cpf) {
      filterParams.push(search.cpf);
      searchConditions.push(`regexp_replace(cpf, '\\D', '', 'g') ILIKE $${filterParams.length}`);
    }
    const whereClause = searchConditions.length > 0 ? `WHERE ${searchConditions.join(" OR ")}` : "";
    const limitParam = filterParams.length + 1;
    const offsetParam = filterParams.length + 2;

    const [rows, countResult] = await Promise.all([
      query<ClientRow>(
        `SELECT id, full_name, cpf, email, fone, automovel, placa
         FROM clients
         ${whereClause}
         ORDER BY full_name ASC, id ASC
         LIMIT $${limitParam} OFFSET $${offsetParam}`,
        [...filterParams, limit, offset]
      ),
      query<{ total: number }>(
        `SELECT COUNT(*)::int AS total FROM clients ${whereClause}`,
        filterParams
      )
    ]);

    const total = countResult[0]?.total ?? 0;
    const clientIds = rows.map(r => r.id);
    const reservationsByClient = clientIds.length > 0
      ? await getReservationsByClientIds(clientIds)
      : new Map<string, ReservationSummaryDto[]>();
    res.json({
      items: rows.map(row => mapClient(row, reservationsByClient.get(row.id))),
      total,
      page,
      pageSize: limit
    });
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
    res.json(mapClient(client, reservationsByClient.get(client.id), req.user?.role === "admin"));
  })
);

clientsRouter.post(
  "/client/create",
  validate({ body: clientBodySchema }),
  asyncHandler(async (req, res) => {
    const cpf = normalizeCpf(req.body.cpf);
    const client = {
      id: randomUUID(),
      fullName: req.body.fullName,
      cpf,
      email: req.body.email,
      fone: req.body.fone,
      automovel: req.body.automovel ?? "",
      placa: req.body.placa ?? ""
    };
    const foneE164 = normalizePhone(client.fone);
    const db = await pool.connect();

    try {
      await db.query("BEGIN");
      const duplicate = await db.query<{ id: string }>(`SELECT id FROM clients WHERE cpf = $1 LIMIT 1`, [cpf]);
      if (duplicate.rows.length > 0) {
        throw new HttpError(409, "Já existe cliente com este CPF.");
      }

      await db.query(
        `
          INSERT INTO clients (id, full_name, cpf, email, fone, fone_e164, automovel, placa)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `,
        [client.id, client.fullName, client.cpf, client.email, client.fone, foneE164, client.automovel, client.placa]
      );
      await autoLinkContactsForClient(db, client.id, foneE164);
      await db.query("COMMIT");
    } catch (error) {
      await db.query("ROLLBACK");
      throw error;
    } finally {
      db.release();
    }

    res.status(201).json({ ...client, cpf: req.user?.role === "admin" ? client.cpf : maskCpf(client.cpf) });
  })
);

clientsRouter.put(
  "/client/:id",
  validate({ params: clientIdSchema, body: updateClientBodySchema }),
  asyncHandler(async (req, res) => {
    const db = await pool.connect();
    let cpf: string;
    const foneE164 = normalizePhone(req.body.fone);

    try {
      await db.query("BEGIN");
      const existing = await db.query<{ id: string; cpf: string }>(
        `SELECT id, cpf FROM clients WHERE id = $1 LIMIT 1`,
        [req.params.id]
      );
      if (existing.rows.length === 0) {
        throw new HttpError(404, "Cliente não encontrado.");
      }

      cpf = req.body.cpf ? normalizeCpf(req.body.cpf) : existing.rows[0].cpf;
      if (req.body.cpf) {
        const duplicate = await db.query<{ id: string }>(
          `
            SELECT id
            FROM clients
            WHERE cpf = $1 AND id <> $2
            LIMIT 1
          `,
          [cpf, req.params.id]
        );
        if (duplicate.rows.length > 0) {
          throw new HttpError(409, "CPF já cadastrado para outro cliente.");
        }
      }

      await db.query(
        `
          UPDATE clients
          SET full_name = $1, cpf = $2, email = $3, fone = $4, fone_e164 = $5, automovel = $6, placa = $7
          WHERE id = $8
        `,
        [
          req.body.fullName,
          cpf,
          req.body.email,
          req.body.fone,
          foneE164,
          req.body.automovel ?? "",
          req.body.placa ?? "",
          req.params.id
        ]
      );
      await autoLinkContactsForClient(db, req.params.id, foneE164);
      await db.query("COMMIT");
    } catch (error) {
      await db.query("ROLLBACK");
      throw error;
    } finally {
      db.release();
    }

    res.json({
      id: req.params.id,
      fullName: req.body.fullName,
      cpf: req.user?.role === "admin" ? cpf! : maskCpf(cpf!),
      email: req.body.email,
      fone: req.body.fone,
      automovel: req.body.automovel ?? "",
      placa: req.body.placa ?? ""
    });
  })
);
