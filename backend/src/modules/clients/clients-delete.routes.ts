import { Router } from "express";
import { pool } from "../../db/client.js";
import { requireRole } from "../../middlewares/require-role.js";
import { validate } from "../../middlewares/validate.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { clientIdSchema } from "./clients.schema.js";
import { deleteClientInTransaction } from "./clients-delete.service.js";

export const clientsDeleteRouter = Router();

// Exclusão é irreversível (pedido LGPD): só o gerente. A recepção cadastra e edita.
clientsDeleteRouter.delete(
  "/client/:id",
  requireRole("admin"),
  validate({ params: clientIdSchema }),
  asyncHandler(async (req, res) => {
    const db = await pool.connect();
    try {
      await db.query("BEGIN");
      await deleteClientInTransaction(db, req.params.id);
      await db.query("COMMIT");
    } catch (error) {
      await db.query("ROLLBACK");
      throw error;
    } finally {
      db.release();
    }

    res.status(204).end();
  })
);
