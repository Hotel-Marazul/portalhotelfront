import { randomUUID } from "node:crypto";
import { z } from "zod";
import { pool } from "./client.js";
import { migrateSeasonalPricingSchema } from "./seasonal-pricing-schema.js";

const code = "marazul-summer-reported-2026-10-26";
const money = z.number().finite().nonnegative();
const catalogSchema = z.object({
  coupleRates: z.array(z.object({ category: z.string().min(2), breakfast: money.positive(), halfBoard: money.positive() })).length(4),
  additionalGuestRates: z.array(z.object({
    minAge: z.number().int().min(0), maxAge: z.number().int().nullable(), amount: money,
    billingBasis: z.enum(["free", "per_stay", "per_daily"])
  })).length(4)
});

async function activate() {
  await migrateSeasonalPricingSchema();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SET LOCAL lock_timeout = '5s'");
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [code]);
    const catalog = await client.query<{ payload: unknown }>(
      "SELECT payload FROM hotel_seasonal_rate_catalogs WHERE code = $1 FOR UPDATE", [code]
    );
    const source = catalogSchema.parse(catalog.rows[0]?.payload);
    const starts = "2026-12-01";
    const ends = "2027-03-01";
    // Keep pre-activation values for review without touching reservation history.
    const before = await client.query(
      "SELECT id, name, price, single_price, couple_price, half_board_price, rate_valid_from, rate_valid_until, tariff_catalog_code FROM categories ORDER BY name"
    );
    await client.query(`UPDATE hotel_seasonal_rate_catalogs
      SET payload = CASE WHEN payload ? 'beforeOperationalActivation' THEN payload
        ELSE jsonb_set(payload, '{beforeOperationalActivation}', $2::jsonb) END
      WHERE code = $1`, [code, JSON.stringify(before.rows)]);

    for (const rate of source.coupleRates) {
      const matches = await client.query<{ id: string }>(
        "SELECT id FROM categories WHERE lower(name) = lower($1) FOR UPDATE", [rate.category]
      );
      if (matches.rows.length > 1) throw new Error(`Categoria ambígua: ${rate.category}`);
      const id = matches.rows[0]?.id ?? randomUUID();
      if (matches.rows.length === 0) {
        await client.query("INSERT INTO categories (id,name,price,couple_price) VALUES ($1,$2,$3,$3)", [id, rate.category, rate.breakfast]);
      }
      await client.query(`UPDATE categories SET price=$2, couple_price=$2, half_board_price=$3,
        rate_valid_from=$4, rate_valid_until=$5, tariff_catalog_code=$6 WHERE id=$1`,
      [id, rate.breakfast, rate.halfBoard, starts, ends, code]);
      await client.query("UPDATE rooms SET type=$2, daily_price=$3 WHERE category_id=$1", [id, rate.category, rate.breakfast]);
    }
    for (const rule of source.additionalGuestRates) {
      const name = `Verão — ${rule.minAge}${rule.maxAge == null ? '+' : ` a ${rule.maxAge}`} anos`;
      const basis = rule.billingBasis === "per_stay" ? "per_stay" : "per_daily";
      const description = rule.amount === 0 ? "Gratuito" : basis === "per_stay" ? "Taxa única por hóspede por hospedagem" : "Valor por hóspede por diária";
      await client.query(`INSERT INTO pricing_rules (id,name,description,min_age,max_age,price,billing_basis,catalog_code)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
        ON CONFLICT (name) DO UPDATE SET description=EXCLUDED.description,min_age=EXCLUDED.min_age,
          max_age=EXCLUDED.max_age,price=EXCLUDED.price,billing_basis=EXCLUDED.billing_basis,catalog_code=EXCLUDED.catalog_code`,
      [randomUUID(), name, description, rule.minAge, rule.maxAge ?? 120, rule.amount, basis, code]);
    }
    await client.query(`UPDATE hotel_seasonal_rate_catalogs SET payload =
      jsonb_set(payload, '{operationalActivation}', $2::jsonb) WHERE code=$1`,
    [code, JSON.stringify({ validFrom: starts, validUntil: ends, status: "operational_categories", minimumStay: null })]);
    await client.query("COMMIT");
    console.log("Tarifas operacionais ativadas: 4 categorias, 8 preços, 4 faixas etárias; 2026-12-01 a 2027-03-01 (fim exclusivo).");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

activate().catch((error) => {
  console.error(error instanceof Error ? error.message : "Falha ao ativar tarifas.");
  process.exitCode = 1;
}).finally(() => pool.end());
