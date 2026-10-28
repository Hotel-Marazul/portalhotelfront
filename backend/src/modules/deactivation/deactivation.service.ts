import type { PoolClient } from "pg";
import { HttpError } from "../../utils/http-error.js";
import { HOTEL_TIMEZONE } from "../../utils/reservation.js";
import { ACTIVE_RESERVATION_STATUSES } from "../../utils/reservation-status.js";

export type DeactivatableRecord = "client" | "room" | "category";

type Queryable = Pick<PoolClient, "query">;

const RECORDS: Record<DeactivatableRecord, { table: string; notFound: string }> = {
  client: { table: "clients", notFound: "Hóspede não encontrado." },
  room: { table: "rooms", notFound: "Quarto não encontrado." },
  category: { table: "categories", notFound: "Categoria não encontrada." }
};

export const CLIENT_HAS_FUTURE_RESERVATIONS_MESSAGE = "Hóspede com reserva futura ou em casa não pode ser desativado.";
export const ROOM_HAS_FUTURE_RESERVATIONS_MESSAGE = "Quarto com reserva futura não pode ser desativado.";
export const CATEGORY_HAS_ACTIVE_ROOMS_MESSAGE = "Categoria com quartos ativos não pode ser desativada. Desative os quartos antes.";

// Reserva que ainda não saiu: ativa e com saída depois de hoje no fuso do hotel.
const FUTURE_RESERVATION_SQL = `
  status = ANY($2::text[]) AND check_out_date > (NOW() AT TIME ZONE '${HOTEL_TIMEZONE}')::date
`;

async function lockRecord(db: Queryable, record: DeactivatableRecord, id: string) {
  const { table, notFound } = RECORDS[record];
  const result = await db.query<{ id: string; active: boolean }>(
    `SELECT id, active FROM ${table} WHERE id = $1 FOR UPDATE`,
    [id]
  );
  if (!result.rows[0]) throw new HttpError(404, notFound);
  return result.rows[0];
}

async function assertCanDeactivate(db: Queryable, record: DeactivatableRecord, id: string) {
  if (record === "category") {
    const rooms = await db.query(`SELECT 1 FROM rooms WHERE category_id = $1 AND active LIMIT 1`, [id]);
    if (rooms.rows.length > 0) throw new HttpError(409, CATEGORY_HAS_ACTIVE_ROOMS_MESSAGE);
    return;
  }
  const column = record === "client" ? "client_id" : "room_id";
  const future = await db.query(
    `SELECT 1 FROM reservations WHERE ${column} = $1 AND ${FUTURE_RESERVATION_SQL} LIMIT 1`,
    [id, ACTIVE_RESERVATION_STATUSES]
  );
  if (future.rows.length > 0) {
    throw new HttpError(409, record === "client" ? CLIENT_HAS_FUTURE_RESERVATIONS_MESSAGE : ROOM_HAS_FUTURE_RESERVATIONS_MESSAGE);
  }
}

// Roda dentro de uma transação aberta pelo chamador. Nunca apaga a linha: o histórico aponta para ela.
export async function deactivateRecord(db: Queryable, record: DeactivatableRecord, id: string, userId: string) {
  const current = await lockRecord(db, record, id);
  if (!current.active) return;
  await assertCanDeactivate(db, record, id);
  await db.query(
    `UPDATE ${RECORDS[record].table} SET active = FALSE, deactivated_at = NOW(), deactivated_by = $2 WHERE id = $1`,
    [id, userId]
  );
}

export async function reactivateRecord(db: Queryable, record: DeactivatableRecord, id: string) {
  const current = await lockRecord(db, record, id);
  if (current.active) return;
  await db.query(
    `UPDATE ${RECORDS[record].table} SET active = TRUE, deactivated_at = NULL, deactivated_by = NULL WHERE id = $1`,
    [id]
  );
}

// Recadastro de um valor único que pertence a um desativado: a tela oferece reativar esse id.
export function inactiveDuplicateError(id: string, message: string) {
  return new HttpError(409, message, { code: "inactive_duplicate", id });
}

// Só o gerente enxerga desativados, e só quando pede.
export function showsInactive(role: string | undefined, includeInactive: unknown) {
  return role === "admin" && includeInactive === "true";
}
