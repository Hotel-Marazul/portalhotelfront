import { Router } from "express";
import { pool } from "../../db/client.js";
import { validate } from "../../middlewares/validate.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { clientIdSchema } from "./clients.schema.js";
import { deleteClientInTransaction } from "./clients-delete.service.js";

export const clientsDeleteRouter = Router();

// Mesmo acesso das outras rotas de /client: qualquer usuário autenticado.
clientsDeleteRouter.delete(
  "/client/:id",
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
