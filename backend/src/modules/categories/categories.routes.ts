import { randomUUID } from "crypto";
import { Router } from "express";
import { query } from "../../db/client.js";
import { validate } from "../../middlewares/validate.js";
import { HttpError } from "../../utils/http-error.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { categoryBodySchema, idParamSchema } from "./categories.schema.js";

interface CategoryRow {
  id: string;
  name: string;
  price: string;
}

interface CategoryWithRoomsRow extends CategoryRow {
  rooms_count: number;
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
          COUNT(r.id)::int AS rooms_count
        FROM categories c
        LEFT JOIN rooms r ON r.category_id = c.id
        GROUP BY c.id
        ORDER BY c.name ASC
      `
    );

    res.json(
      rows.map((row) => ({
        id: row.id,
        name: row.name,
        price: Number(row.price),
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
        SELECT id, name, price::text AS price
        FROM categories
        ORDER BY name ASC
      `
    );

    res.json(
      rows.map((row) => ({
        id: row.id,
        name: row.name,
        price: Number(row.price)
      }))
    );
  })
);

categoriesRouter.post(
  "/Categories/create",
  validate({ body: categoryBodySchema }),
  asyncHandler(async (req, res) => {
    const duplicate = await query<{ id: string }>(
      `SELECT id FROM categories WHERE LOWER(name) = LOWER($1) LIMIT 1`,
      [req.body.name]
    );
    if (duplicate.length > 0) {
      throw new HttpError(409, "Já existe uma categoria com esse nome.");
    }

    const category = {
      id: randomUUID(),
      name: req.body.name,
      price: req.body.price
    };

    await query(
      `
        INSERT INTO categories (id, name, price)
        VALUES ($1, $2, $3)
      `,
      [category.id, category.name, category.price]
    );

    res.status(201).json(category);
  })
);

categoriesRouter.put(
  "/Categories/update/:id",
  validate({ params: idParamSchema, body: categoryBodySchema }),
  asyncHandler(async (req, res) => {
    const existing = await query<{ id: string }>(
      `SELECT id FROM categories WHERE id = $1 LIMIT 1`,
      [req.params.id]
    );
    if (existing.length === 0) {
      throw new HttpError(404, "Categoria não encontrada.");
    }

    const duplicate = await query<{ id: string }>(
      `SELECT id FROM categories WHERE LOWER(name) = LOWER($1) AND id <> $2 LIMIT 1`,
      [req.body.name, req.params.id]
    );
    if (duplicate.length > 0) {
      throw new HttpError(409, "Já existe uma categoria com esse nome.");
    }

    await query(
      `
        UPDATE categories
        SET name = $1, price = $2
        WHERE id = $3
      `,
      [req.body.name, req.body.price, req.params.id]
    );

    await query(
      `
        UPDATE rooms
        SET type = $1, daily_price = $2
        WHERE category_id = $3
      `,
      [req.body.name, req.body.price, req.params.id]
    );

    res.json({
      id: req.params.id,
      name: req.body.name,
      price: req.body.price
    });
  })
);

categoriesRouter.delete(
  "/Categories/delete/:id",
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

