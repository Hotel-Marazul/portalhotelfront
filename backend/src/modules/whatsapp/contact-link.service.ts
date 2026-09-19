import type { PoolClient } from "pg";
import { phoneVariants } from "./phone.js";

async function findUniqueClientId(client: PoolClient, phoneE164: string) {
  const variants = phoneVariants(phoneE164);
  if (variants.length === 0) return null;

  const result = await client.query<{ id: string }>(
    `SELECT id
     FROM clients
     WHERE fone_e164 = ANY($1::text[])
     LIMIT 2`,
    [variants]
  );
  return result.rows.length === 1 ? result.rows[0].id : null;
}

export async function autoLinkContact(client: PoolClient, contactId: string, phoneE164: string) {
  const clientId = await findUniqueClientId(client, phoneE164);
  if (!clientId) return false;

  const result = await client.query(
    `UPDATE whatsapp_contacts
     SET client_id = $1, linked_at = NOW(), linked_by_user_id = NULL, updated_at = NOW()
     WHERE id = $2 AND client_id IS NULL AND auto_link_blocked = FALSE`,
    [clientId, contactId]
  );
  return result.rowCount === 1;
}

export async function autoLinkContactsForClient(client: PoolClient, clientId: string, phoneE164: string | null) {
  if (!phoneE164) return 0;
  const variants = phoneVariants(phoneE164);
  if (variants.length === 0) return 0;

  const result = await client.query(
    `UPDATE whatsapp_contacts
     SET client_id = $1, linked_at = NOW(), linked_by_user_id = NULL, updated_at = NOW()
     WHERE client_id IS NULL
       AND auto_link_blocked = FALSE
       AND phone_e164 = ANY($2::text[])
       AND (SELECT COUNT(*) FROM clients WHERE fone_e164 = ANY($2::text[])) = 1`,
    [clientId, variants]
  );
  return result.rowCount ?? 0;
}
