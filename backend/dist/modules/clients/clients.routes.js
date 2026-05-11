import { randomUUID } from "crypto";
import { Router } from "express";
import { query } from "../../db/client.js";
import { validate } from "../../middlewares/validate.js";
import { HttpError } from "../../utils/http-error.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { clientBodySchema, clientIdSchema } from "./clients.schema.js";
function normalizeCpf(cpf) {
    return cpf.replace(/\D/g, "");
}
function mapClient(row) {
    return {
        id: row.id,
        fullName: row.full_name,
        cpf: row.cpf,
        email: row.email,
        fone: row.fone,
        automovel: row.automovel,
        placa: row.placa
    };
}
export const clientsRouter = Router();
clientsRouter.get("/client", asyncHandler(async (_req, res) => {
    const rows = await query(`
        SELECT id, full_name, cpf, email, fone, automovel, placa
        FROM clients
        ORDER BY full_name ASC
      `);
    res.json(rows.map(mapClient));
}));
clientsRouter.get("/client/:id", validate({ params: clientIdSchema }), asyncHandler(async (req, res) => {
    const rows = await query(`
        SELECT id, full_name, cpf, email, fone, automovel, placa
        FROM clients
        WHERE id = $1
        LIMIT 1
      `, [req.params.id]);
    const client = rows[0];
    if (!client) {
        throw new HttpError(404, "Cliente não encontrado.");
    }
    res.json(mapClient(client));
}));
clientsRouter.post("/client/create", validate({ body: clientBodySchema }), asyncHandler(async (req, res) => {
    const cpf = normalizeCpf(req.body.cpf);
    const duplicate = await query(`SELECT id FROM clients WHERE cpf = $1 LIMIT 1`, [cpf]);
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
    await query(`
        INSERT INTO clients (id, full_name, cpf, email, fone, automovel, placa)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [client.id, client.fullName, client.cpf, client.email, client.fone, client.automovel, client.placa]);
    res.status(201).json(client);
}));
clientsRouter.put("/client/:id", validate({ params: clientIdSchema, body: clientBodySchema }), asyncHandler(async (req, res) => {
    const existing = await query(`SELECT id FROM clients WHERE id = $1 LIMIT 1`, [
        req.params.id
    ]);
    if (existing.length === 0) {
        throw new HttpError(404, "Cliente não encontrado.");
    }
    const cpf = normalizeCpf(req.body.cpf);
    const duplicate = await query(`
        SELECT id
        FROM clients
        WHERE cpf = $1 AND id <> $2
        LIMIT 1
      `, [cpf, req.params.id]);
    if (duplicate.length > 0) {
        throw new HttpError(409, "CPF já cadastrado para outro cliente.");
    }
    await query(`
        UPDATE clients
        SET full_name = $1, cpf = $2, email = $3, fone = $4, automovel = $5, placa = $6
        WHERE id = $7
      `, [
        req.body.fullName,
        cpf,
        req.body.email,
        req.body.fone,
        req.body.automovel ?? "",
        req.body.placa ?? "",
        req.params.id
    ]);
    res.json({
        id: req.params.id,
        fullName: req.body.fullName,
        cpf,
        email: req.body.email,
        fone: req.body.fone,
        automovel: req.body.automovel ?? "",
        placa: req.body.placa ?? ""
    });
}));
