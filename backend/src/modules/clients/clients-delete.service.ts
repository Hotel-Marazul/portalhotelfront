import type { PoolClient } from "pg";
import { HttpError } from "../../utils/http-error.js";

export const CLIENT_HAS_RESERVATIONS_MESSAGE = "Hóspede com reservas não pode ser excluído.";

type Queryable = Pick<PoolClient, "query">;

// Qualquer reserva, inclusive cancelada, impede a exclusão: o histórico aponta para o cliente.
export function canDeleteClient(reservationCount: number): boolean {
  return reservationCount === 0;
}

// Roda dentro de uma transação já aberta pelo chamador.
// FKs para clients(id): reservations.client_id (ON DELETE RESTRICT) é barrada pelo 409;
// whatsapp_contacts.client_id (ON DELETE SET NULL) é desvinculada explicitamente, limpando também linked_at e linked_by_user_id.
export async function deleteClientInTransaction(db: Queryable, clientId: string): Promise<void> {
  const existing = await db.query<{ id: string }>(`SELECT id FROM clients WHERE id = $1 FOR UPDATE`, [clientId]);
  if (existing.rows.length === 0) {
    throw new HttpError(404, "Cliente não encontrado.");
  }

  const reservations = await db.query<{ total: number }>(
    `SELECT COUNT(*)::int AS total FROM reservations WHERE client_id = $1`,
    [clientId]
  );
  if (!canDeleteClient(reservations.rows[0]?.total ?? 0)) {
    throw new HttpError(409, CLIENT_HAS_RESERVATIONS_MESSAGE);
  }

  await db.query(
    `UPDATE whatsapp_contacts
     SET client_id = NULL, linked_at = NULL, linked_by_user_id = NULL, updated_at = NOW()
     WHERE client_id = $1`,
    [clientId]
  );
  await db.query(`DELETE FROM clients WHERE id = $1`, [clientId]);
}
