import { Router } from "express";
import { query } from "../../db/client.js";
import { asyncHandler } from "../../utils/async-handler.js";
function mapPricingRule(row) {
    return {
        id: row.id,
        name: row.name,
        description: row.description,
        minAge: row.min_age,
        maxAge: row.max_age,
        price: Number(row.price)
    };
}
export const pricingRulesRouter = Router();
pricingRulesRouter.get("/GuestPricingRule", asyncHandler(async (_req, res) => {
    const rows = await query(`
        SELECT id, name, description, min_age, max_age, price::text AS price
        FROM pricing_rules
        ORDER BY min_age ASC
      `);
    res.json(rows.map(mapPricingRule));
}));
pricingRulesRouter.get("/pricing-rules", asyncHandler(async (_req, res) => {
    const rows = await query(`
        SELECT id, name, description, min_age, max_age, price::text AS price
        FROM pricing_rules
        ORDER BY min_age ASC
      `);
    res.json(rows.map(mapPricingRule));
}));
