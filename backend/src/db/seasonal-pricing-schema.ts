import { pool } from "./client.js";

/** Additive schema only; commercial values are imported explicitly, never seeded. */
export async function migrateSeasonalPricingSchema() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`
      ALTER TABLE categories
        ADD COLUMN IF NOT EXISTS half_board_price NUMERIC(10,2) NULL CHECK (half_board_price > 0),
        ADD COLUMN IF NOT EXISTS rate_valid_from DATE NULL,
        ADD COLUMN IF NOT EXISTS rate_valid_until DATE NULL,
        ADD COLUMN IF NOT EXISTS tariff_catalog_code TEXT NULL;
      ALTER TABLE pricing_rules
        ADD COLUMN IF NOT EXISTS catalog_code TEXT NULL,
        ADD COLUMN IF NOT EXISTS billing_basis TEXT NOT NULL DEFAULT 'per_daily'
          CHECK (billing_basis IN ('per_daily', 'per_stay'));
      ALTER TABLE reservations
        ADD COLUMN IF NOT EXISTS pricing_snapshot JSONB NULL,
        ADD COLUMN IF NOT EXISTS pricing_input_hash TEXT NULL;
    `);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
