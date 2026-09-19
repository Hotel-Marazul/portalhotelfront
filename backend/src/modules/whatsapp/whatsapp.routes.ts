import { Router } from "express";
import { env } from "../../config/env.js";
import { pool, query } from "../../db/client.js";
import { requireRole } from "../../middlewares/require-role.js";
import { validate } from "../../middlewares/validate.js";
import { HttpError } from "../../utils/http-error.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { phoneVariants } from "./phone.js";
import {
  whatsappContactIdSchema,
  whatsappContactKindBodySchema,
  whatsappLinkBodySchema
} from "./whatsapp.schema.js";

export const whatsappRouter = Router();

whatsappRouter.use(requireRole("admin", "receptionist"));

whatsappRouter.get("/status", (_req, res) => {
  if (!env.WHATSAPP_ENABLED) {
    res.json({ enabled: false });
    return;
  }

  res.json({ enabled: true });
});

whatsappRouter.use((req, res, next) => {
  if (env.WHATSAPP_ENABLED) {
    next();
    return;
  }

  res.status(404).json({ message: "Módulo WhatsApp desligado." });
});

whatsappRouter.get(
  "/contacts/:id/link-candidates",
  validate({ params: whatsappContactIdSchema }),
  asyncHandler(async (req, res) => {
    const contacts = await query<{ id: string; phone_e164: string; push_name: string }>(
      "SELECT id, phone_e164, push_name FROM whatsapp_contacts WHERE id = $1 LIMIT 1",
      [req.params.id]
    );
    const contact = contacts[0];
    if (!contact) throw new HttpError(404, "Contato WhatsApp não encontrado.");

    const variants = phoneVariants(contact.phone_e164);
    const pushName = contact.push_name.trim().slice(0, 100);
    const candidates = await query<{
      id: string;
      full_name: string;
      fone: string;
      fone_e164: string | null;
      match_kind: "phone" | "name";
    }>(
      `
        SELECT c.id, c.full_name, c.fone, c.fone_e164,
               CASE WHEN c.fone_e164 = ANY($1::text[]) THEN 'phone' ELSE 'name' END AS match_kind
        FROM clients c
        WHERE c.fone_e164 = ANY($1::text[])
           OR ($2 <> '' AND (
                c.full_name ILIKE '%' || $2 || '%'
                OR $2 ILIKE '%' || c.full_name || '%'
              ))
        ORDER BY
          CASE WHEN c.fone_e164 = ANY($1::text[]) THEN 0 ELSE 1 END,
          CASE
            WHEN LOWER(c.full_name) = LOWER($2) THEN 0
            WHEN $2 <> '' AND (c.full_name ILIKE '%' || $2 || '%' OR $2 ILIKE '%' || c.full_name || '%') THEN 1
            ELSE 2
          END,
          c.full_name ASC
        LIMIT 10
      `,
      [variants, pushName]
    );

    res.json({
      candidates: candidates.map((candidate) => ({
        id: candidate.id,
        fullName: candidate.full_name,
        fone: candidate.fone,
        foneE164: candidate.fone_e164,
        match: candidate.match_kind
      }))
    });
  })
);

whatsappRouter.put(
  "/contacts/:id/link",
  validate({ params: whatsappContactIdSchema, body: whatsappLinkBodySchema }),
  asyncHandler(async (req, res) => {
    const db = await pool.connect();
    try {
      await db.query("BEGIN");
      const contact = await db.query<{ id: string }>(
        "SELECT id FROM whatsapp_contacts WHERE id = $1 LIMIT 1",
        [req.params.id]
      );
      if (contact.rows.length === 0) throw new HttpError(404, "Contato WhatsApp não encontrado.");

      const client = await db.query<{ id: string }>("SELECT id FROM clients WHERE id = $1 LIMIT 1", [
        req.body.clientId
      ]);
      if (client.rows.length === 0) throw new HttpError(404, "Cliente não encontrado.");

      await db.query(
        `UPDATE whatsapp_contacts
         SET client_id = $1, linked_by_user_id = $2, linked_at = NOW(), auto_link_blocked = FALSE, updated_at = NOW()
         WHERE id = $3`,
        [req.body.clientId, req.user!.id, req.params.id]
      );
      await db.query("COMMIT");
      res.json({ contactId: req.params.id, clientId: req.body.clientId });
    } catch (error) {
      await db.query("ROLLBACK");
      throw error;
    } finally {
      db.release();
    }
  })
);

whatsappRouter.delete(
  "/contacts/:id/link",
  validate({ params: whatsappContactIdSchema }),
  asyncHandler(async (req, res) => {
    const result = await query(
      `UPDATE whatsapp_contacts
       SET client_id = NULL, linked_by_user_id = $1, linked_at = NOW(), auto_link_blocked = TRUE, updated_at = NOW()
       WHERE id = $2
       RETURNING id`,
      [req.user!.id, req.params.id]
    );
    if (result.length === 0) throw new HttpError(404, "Contato WhatsApp não encontrado.");
    res.status(204).send();
  })
);

whatsappRouter.put(
  "/contacts/:id/kind",
  validate({ params: whatsappContactIdSchema, body: whatsappContactKindBodySchema }),
  asyncHandler(async (req, res) => {
    const result = await query<{ id: string; kind: "guest" | "supplier" }>(
      `UPDATE whatsapp_contacts
       SET kind = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING id, kind`,
      [req.body.kind, req.params.id]
    );
    if (result.length === 0) throw new HttpError(404, "Contato WhatsApp não encontrado.");
    res.json({ contactId: result[0].id, kind: result[0].kind });
  })
);
