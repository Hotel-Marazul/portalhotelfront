import { randomUUID } from "crypto";
import { Router } from "express";
import { pool, query } from "../../db/client.js";
import { requireRole } from "../../middlewares/require-role.js";
import { validate } from "../../middlewares/validate.js";
import { inactiveDuplicateError, showsInactive } from "../deactivation/deactivation.service.js";
import { HttpError } from "../../utils/http-error.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { categoryBodySchema, idParamSchema } from "./categories.schema.js";

interface CategoryRow {
  id: string;
  name: string;
  price: string;
  single_price: string | null;
  couple_price: string | null;
  half_board_price: string | null;
  rate_valid_from: string | null;
  rate_valid_until: string | null;
  active?: boolean;
}

interface CategoryWithRoomsRow extends CategoryRow {
  rooms_count: number;
}

function categoryToResponse(row: CategoryRow) {
  const couplePrice = Number(row.couple_price ?? row.price);

  return {
    id: row.id,
    name: row.name,
    // `price` is retained as the legacy/default couple price.
    price: couplePrice,
    singlePrice: row.single_price === null ? null : Number(row.single_price),
    couplePrice,
    halfBoardPrice: row.half_board_price == null ? null : Number(row.half_board_price),
    rateValidFrom: row.rate_valid_from ?? null,
    rateValidUntil: row.rate_valid_until ?? null,
    ...(row.active === undefined ? {} : { active: row.active })
  };
}

export const categoriesRouter = Router();

categoriesRouter.get(
  "/Categories",
  asyncHandler(async (req, res) => {
    const rows = await query<CategoryWithRoomsRow>(
      `
        SELECT
          c.id,
          c.name,
          c.price::text AS price,
          c.single_price::text AS single_price,
          c.couple_price::text AS couple_price,
          c.half_board_price::text AS half_board_price, c.rate_valid_from::text, c.rate_valid_until::text,
          c.active,
          COUNT(r.id) FILTER (WHERE r.active)::int AS rooms_count
        FROM categories c
        LEFT JOIN rooms r ON r.category_id = c.id
        WHERE c.active OR $1
        GROUP BY c.id
        ORDER BY c.name ASC
      `,
      [showsInactive(req.user?.role, req.query.includeInactive)]
    );

    res.json(
      rows.map((row) => ({
        ...categoryToResponse(row),
        roomsCount: row.rooms_count
      }))
    );
  })
);

categoriesRouter.get(
  "/categories",
  asyncHandler(async (req, res) => {
    const rows = await query<CategoryRow>(
      `
        SELECT id, name, price::text AS price,
               single_price::text AS single_price,
               couple_price::text AS couple_price, active
        FROM categories
        WHERE active OR $1
        ORDER BY name ASC
      `,
      [showsInactive(req.user?.role, req.query.includeInactive)]
    );

    res.json(
      rows.map(categoryToResponse)
    );
  })
);

categoriesRouter.post(
  "/Categories/create",
  requireRole("admin"),
  validate({ body: categoryBodySchema }),
  asyncHandler(async (req, res) => {
    const duplicate = await query<{ id: string; active: boolean }>(
      `SELECT id, active FROM categories WHERE LOWER(name) = LOWER($1) LIMIT 1`,
      [req.body.name]
    );
    if (duplicate[0] && !duplicate[0].active) {
      throw inactiveDuplicateError(duplicate[0].id, "Já existe uma categoria desativada com esse nome. Reative a categoria.");
    }
    if (duplicate.length > 0) {
      throw new HttpError(409, "Já existe uma categoria com esse nome.");
    }

    const couplePrice = req.body.couplePrice ?? req.body.price;
    const category = {
      id: randomUUID(),
      name: req.body.name,
      price: couplePrice,
      singlePrice: req.body.singlePrice ?? null,
      couplePrice,
      halfBoardPrice: req.body.halfBoardPrice ?? null,
      rateValidFrom: req.body.rateValidFrom ?? null,
      rateValidUntil: req.body.rateValidUntil ?? null
    };

    await query(
      `
        INSERT INTO categories (id, name, price, single_price, couple_price, half_board_price, rate_valid_from, rate_valid_until)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `,
      [category.id, category.name, category.price, category.singlePrice, category.couplePrice, category.halfBoardPrice, category.rateValidFrom, category.rateValidUntil]
    );

    res.status(201).json(category);
  })
);

categoriesRouter.put(
  "/Categories/update/:id",
  requireRole("admin"),
  validate({ params: idParamSchema, body: categoryBodySchema }),
  asyncHandler(async (req, res) => {
    const client = await pool.connect();
    let transactionStarted = false;

    try {
      await client.query("BEGIN");
      transactionStarted = true;

      const existing = await client.query<{
        id: string;
        price: string;
        single_price: string | null;
        couple_price: string | null;
        half_board_price: string | null;
        rate_valid_from: string | null;
        rate_valid_until: string | null;
      }>(
        `SELECT id, price::text AS price, single_price::text AS single_price,
                couple_price::text AS couple_price, half_board_price::text AS half_board_price,
                rate_valid_from::text, rate_valid_until::text
         FROM categories WHERE id = $1 LIMIT 1`,
        [req.params.id]
      );
      if (existing.rowCount === 0) {
        throw new HttpError(404, "Categoria não encontrada.");
      }
      const current = existing.rows[0];
      const halfBoardPrice = req.body.halfBoardPrice !== undefined ? req.body.halfBoardPrice : current.half_board_price == null ? null : Number(current.half_board_price);
      const rateValidFrom = req.body.rateValidFrom !== undefined ? req.body.rateValidFrom : current.rate_valid_from;
      const rateValidUntil = req.body.rateValidUntil !== undefined ? req.body.rateValidUntil : current.rate_valid_until;
      if (rateValidFrom && rateValidUntil && rateValidUntil <= rateValidFrom) {
        throw new HttpError(400, "O fim da validade deve ser posterior ao início.");
      }
      const couplePrice = req.body.couplePrice ?? req.body.price ?? Number(current.couple_price ?? current.price);
      const singlePrice =
        req.body.singlePrice !== undefined
          ? req.body.singlePrice
          : current.single_price === null
            ? null
            : Number(current.single_price);

      const duplicate = await client.query<{ id: string }>(
        `SELECT id FROM categories WHERE LOWER(name) = LOWER($1) AND id <> $2 LIMIT 1`,
        [req.body.name, req.params.id]
      );
      if (duplicate.rowCount && duplicate.rowCount > 0) {
        throw new HttpError(409, "Já existe uma categoria com esse nome.");
      }

      await client.query(
        `
          UPDATE categories
          SET name = $1, price = $2, single_price = $3, couple_price = $2,
              half_board_price = $5, rate_valid_from = $6, rate_valid_until = $7
          WHERE id = $4
        `,
        [req.body.name, couplePrice, singlePrice, req.params.id, halfBoardPrice, rateValidFrom, rateValidUntil]
      );

      await client.query(
        `
          UPDATE rooms
          SET type = $1, daily_price = $2
          WHERE category_id = $3
        `,
        [req.body.name, couplePrice, req.params.id]
      );

      await client.query("COMMIT");
      transactionStarted = false;

      res.json({
        id: req.params.id,
        name: req.body.name,
        price: couplePrice,
        singlePrice,
        couplePrice, halfBoardPrice, rateValidFrom, rateValidUntil
      });
    } catch (error) {
      if (transactionStarted) {
        await client.query("ROLLBACK");
      }
      throw error;
    } finally {
      client.release();
    }
  })
);

