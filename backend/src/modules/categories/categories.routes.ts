import { randomUUID } from "crypto";
import { Router } from "express";
import { pool, query } from "../../db/client.js";
import { requireRole } from "../../middlewares/require-role.js";
import { validate } from "../../middlewares/validate.js";
import { HttpError } from "../../utils/http-error.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { categoryBodySchema, idParamSchema } from "./categories.schema.js";

interface CategoryRow {
  id: string;
  name: string;
  price: string;
  single_price: string | null;
  couple_price: string | null;
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
    couplePrice
  };
}

export const categoriesRouter = Router();

categoriesRouter.get(
  "/Categories",
  asyncHandler(async (_req, res) => {
    const rows = await query<CategoryWithRoomsRow>(
      `
        SELECT
          c.id,
          c.name,
          c.price::text AS price,
          c.single_price::text AS single_price,
          c.couple_price::text AS couple_price,
          COUNT(r.id)::int AS rooms_count
        FROM categories c
        LEFT JOIN rooms r ON r.category_id = c.id
        GROUP BY c.id
        ORDER BY c.name ASC
      `
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
  asyncHandler(async (_req, res) => {
    const rows = await query<CategoryRow>(
      `
        SELECT id, name, price::text AS price,
               single_price::text AS single_price,
               couple_price::text AS couple_price
        FROM categories
        ORDER BY name ASC
      `
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
    const duplicate = await query<{ id: string }>(
      `SELECT id FROM categories WHERE LOWER(name) = LOWER($1) LIMIT 1`,
      [req.body.name]
    );
    if (duplicate.length > 0) {
      throw new HttpError(409, "Já existe uma categoria com esse nome.");
    }

    const couplePrice = req.body.couplePrice ?? req.body.price;
    const category = {
      id: randomUUID(),
      name: req.body.name,
      price: couplePrice,
      singlePrice: req.body.singlePrice ?? null,
      couplePrice
    };

    await query(
      `
        INSERT INTO categories (id, name, price, single_price, couple_price)
        VALUES ($1, $2, $3, $4, $5)
      `,
      [category.id, category.name, category.price, category.singlePrice, category.couplePrice]
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
      }>(
        `SELECT id, price::text AS price, single_price::text AS single_price,
                couple_price::text AS couple_price
         FROM categories WHERE id = $1 LIMIT 1`,
        [req.params.id]
      );
      if (existing.rowCount === 0) {
        throw new HttpError(404, "Categoria não encontrada.");
      }
      const current = existing.rows[0];
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
          SET name = $1, price = $2, single_price = $3, couple_price = $2
          WHERE id = $4
        `,
        [req.body.name, couplePrice, singlePrice, req.params.id]
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
        couplePrice
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

categoriesRouter.delete(
  "/Categories/delete/:id",
  requireRole("admin"),
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res) => {
    const existing = await query<{ id: string }>(
      `SELECT id FROM categories WHERE id = $1 LIMIT 1`,
      [req.params.id]
    );
    if (existing.length === 0) {
      throw new HttpError(404, "Categoria não encontrada.");
    }

    const rooms = await query<{ id: string }>(
      `SELECT id FROM rooms WHERE category_id = $1 LIMIT 1`,
      [req.params.id]
    );
    if (rooms.length > 0) {
      throw new HttpError(400, "Categoria vinculada a quartos e não pode ser removida.");
    }

    await query(`DELETE FROM categories WHERE id = $1`, [req.params.id]);
    res.status(204).send();
  })
);
