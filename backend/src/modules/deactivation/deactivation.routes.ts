import { Router, type Request } from "express";
import type { PoolClient } from "pg";
import { z } from "zod";
import { pool } from "../../db/client.js";
import { requireRole } from "../../middlewares/require-role.js";
import { validate } from "../../middlewares/validate.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { HttpError } from "../../utils/http-error.js";
import { deactivateRecord, reactivateRecord, type DeactivatableRecord } from "./deactivation.service.js";

export const deactivationRouter = Router();

const idParams = z.object({ id: z.string().uuid("Id inválido.") });

async function inTransaction(work: (db: PoolClient) => Promise<void>) {
  const db = await pool.connect();
  try {
    await db.query("BEGIN");
    await work(db);
    await db.query("COMMIT");
  } catch (error) {
    await db.query("ROLLBACK");
    throw error;
  } finally {
    db.release();
  }
}

function userId(req: Request) {
  if (!req.user) throw new HttpError(401, "Token não informado.");
  return req.user.id;
}

const routes: Array<[DeactivatableRecord, string]> = [
  ["client", "/clients"],
  ["room", "/rooms"],
  ["category", "/categories"]
];

// Só o gerente tira um cadastro de uso ou o devolve. Nada é apagado.
for (const [record, base] of routes) {
  deactivationRouter.post(
    `${base}/:id/deactivate`,
    requireRole("admin"),
    validate({ params: idParams }),
    asyncHandler(async (req, res) => {
      await inTransaction((db) => deactivateRecord(db, record, req.params.id, userId(req)));
      res.status(200).json({ id: req.params.id, active: false });
    })
  );
  deactivationRouter.post(
    `${base}/:id/reactivate`,
    requireRole("admin"),
    validate({ params: idParams }),
    asyncHandler(async (req, res) => {
      await inTransaction((db) => reactivateRecord(db, record, req.params.id));
      res.status(200).json({ id: req.params.id, active: true });
    })
  );
}

// Rotas antigas de exclusão, mantidas para o frontend atual: agora desativam.
const legacy: Array<[DeactivatableRecord, string]> = [
  ["client", "/client/:id"],
  ["room", "/Rooms/delete/:id"],
  ["category", "/Categories/delete/:id"]
];
for (const [record, path] of legacy) {
  deactivationRouter.delete(
    path,
    requireRole("admin"),
    validate({ params: idParams }),
    asyncHandler(async (req, res) => {
      await inTransaction((db) => deactivateRecord(db, record, req.params.id, userId(req)));
      res.status(204).end();
    })
  );
}
