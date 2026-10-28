import { randomUUID } from "crypto";
import { Router } from "express";
import { pool, query } from "../../db/client.js";
import { requireRole } from "../../middlewares/require-role.js";
import { validate } from "../../middlewares/validate.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { HttpError } from "../../utils/http-error.js";
import { pricingRuleBodySchema, pricingRuleIdParamSchema, type PricingRuleBody } from "./pricing-rules.schema.js";

interface PricingRuleRow {
  id: string;
  name: string;
  description: string;
  min_age: number;
  max_age: number;
  price: string;
  catalog_code: string | null;
  billing_basis: "per_daily" | "per_stay";
}

function mapPricingRule(row: PricingRuleRow) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    minAge: row.min_age,
    maxAge: row.max_age,
    price: Number(row.price),
    billingBasis: row.billing_basis,
    catalogCode: row.catalog_code
  };
}

export const pricingRulesRouter = Router();

pricingRulesRouter.get(
  "/GuestPricingRule",
  asyncHandler(async (_req, res) => {
    const rows = await query<PricingRuleRow>(
      `
        SELECT id, name, description, min_age, max_age, price::text AS price, billing_basis, catalog_code
        FROM pricing_rules
        ORDER BY catalog_code NULLS LAST, min_age ASC
      `
    );
    res.json(rows.map(mapPricingRule));
  })
);

pricingRulesRouter.get(
  "/pricing-rules",
  asyncHandler(async (_req, res) => {
    const rows = await query<PricingRuleRow>(
      `
        SELECT id, name, description, min_age, max_age, price::text AS price, billing_basis, catalog_code
        FROM pricing_rules
        ORDER BY catalog_code NULLS LAST, min_age ASC
      `
    );
    res.json(rows.map(mapPricingRule));
  })
);


const DUPLICATE_NAME_MESSAGE = "Já existe uma regra com esse nome.";
const RETURNING = "RETURNING id, name, description, min_age, max_age, price::text AS price, billing_basis, catalog_code";

function isUniqueViolation(error: unknown) {
  return typeof error === "object" && error !== null && (error as { code?: string }).code === "23505";
}

// Criar e editar regra: só gerente. As reservas já criadas guardam o próprio total
// (total_price e pricing_snapshot), então mudar uma regra só vale para novas cotações.
pricingRulesRouter.post(
  "/pricing-rules",
  requireRole("admin"),
  validate({ body: pricingRuleBodySchema }),
  asyncHandler(async (req, res) => {
    const body = req.body as PricingRuleBody;
    const duplicate = await query<{ id: string }>(
      `SELECT id FROM pricing_rules WHERE LOWER(name) = LOWER($1) LIMIT 1`,
      [body.name]
    );
    if (duplicate.length > 0) {
      throw new HttpError(409, DUPLICATE_NAME_MESSAGE);
    }

    try {
      const rows = await query<PricingRuleRow>(
        `INSERT INTO pricing_rules (id, name, description, min_age, max_age, price, billing_basis)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ${RETURNING}`,
        [randomUUID(), body.name, body.description, body.minAge, body.maxAge, body.price, body.billingBasis]
      );
      res.status(201).json(mapPricingRule(rows[0]));
    } catch (error) {
      if (isUniqueViolation(error)) throw new HttpError(409, DUPLICATE_NAME_MESSAGE);
      throw error;
    }
  })
);

pricingRulesRouter.put(
  "/pricing-rules/:id",
  requireRole("admin"),
  validate({ params: pricingRuleIdParamSchema, body: pricingRuleBodySchema }),
  asyncHandler(async (req, res) => {
    const body = req.body as PricingRuleBody;
    const client = await pool.connect();
    let transactionStarted = false;

    try {
      await client.query("BEGIN");
      transactionStarted = true;

      const existing = await client.query<{ id: string; catalog_code: string | null }>(
        `SELECT id, catalog_code FROM pricing_rules WHERE id = $1 FOR UPDATE`,
        [req.params.id]
      );
      if (existing.rowCount === 0) {
        throw new HttpError(404, "Regra não encontrada.");
      }

      const duplicate = await client.query<{ id: string }>(
        `SELECT id FROM pricing_rules WHERE LOWER(name) = LOWER($1) AND id <> $2 LIMIT 1`,
        [body.name, req.params.id]
      );
      if (duplicate.rowCount && duplicate.rowCount > 0) {
        throw new HttpError(409, DUPLICATE_NAME_MESSAGE);
      }

      // Regras de temporada são escolhidas pela idade; duas faixas sobrepostas
      // fariam a reserva falhar com "Não há uma regra de idade única".
      const catalogCode = existing.rows[0].catalog_code;
      if (catalogCode) {
        const overlap = await client.query<{ id: string }>(
          `SELECT id FROM pricing_rules
           WHERE catalog_code = $1 AND id <> $2 AND min_age <= $4 AND max_age >= $3
           LIMIT 1`,
          [catalogCode, req.params.id, body.minAge, body.maxAge]
        );
        if (overlap.rowCount && overlap.rowCount > 0) {
          throw new HttpError(409, "A faixa de idade se sobrepõe a outra regra da mesma temporada.");
        }
      }

      const updated = await client.query<PricingRuleRow>(
        `UPDATE pricing_rules
         SET name = $1, description = $2, min_age = $3, max_age = $4, price = $5, billing_basis = $6
         WHERE id = $7
         ${RETURNING}`,
        [body.name, body.description, body.minAge, body.maxAge, body.price, body.billingBasis, req.params.id]
      );

      await client.query("COMMIT");
      transactionStarted = false;
      res.json(mapPricingRule(updated.rows[0]));
    } catch (error) {
      if (transactionStarted) {
        await client.query("ROLLBACK");
      }
      if (isUniqueViolation(error)) throw new HttpError(409, DUPLICATE_NAME_MESSAGE);
      throw error;
    } finally {
      client.release();
    }
  })
);
