import { Router } from "express";
import { query } from "../../db/client.js";
import { asyncHandler } from "../../utils/async-handler.js";

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

