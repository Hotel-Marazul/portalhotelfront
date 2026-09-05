import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import { env } from "../config/env.js";
import { pool, query } from "./client.js";

const ROOM_STATUS_AVAILABLE = "Dispon\u00edvel";
const ROOM_STATUS_MAINTENANCE = "Manuten\u00e7\u00e3o";

async function createTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('admin', 'manager')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS categories (
      id UUID PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      price NUMERIC(10, 2) NOT NULL CHECK (price > 0),
      single_price NUMERIC(10, 2) NULL CHECK (single_price > 0),
      couple_price NUMERIC(10, 2) NULL CHECK (couple_price > 0),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS rooms (
      id UUID PRIMARY KEY,
      number INTEGER NOT NULL UNIQUE,
      type TEXT NOT NULL,
      capacity INTEGER NOT NULL CHECK (capacity > 0),
      daily_price NUMERIC(10, 2) NOT NULL CHECK (daily_price > 0),
      status TEXT NOT NULL CHECK (status IN ('Livre', 'Ocupado', '${ROOM_STATUS_MAINTENANCE}', '${ROOM_STATUS_AVAILABLE}')),
      category_id UUID NOT NULL REFERENCES categories(id) ON UPDATE CASCADE ON DELETE RESTRICT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS clients (
      id UUID PRIMARY KEY,
      full_name TEXT NOT NULL,
      cpf TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL,
      fone TEXT NOT NULL,
      automovel TEXT NOT NULL DEFAULT '',
      placa TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS pricing_rules (
      id UUID PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      description TEXT NOT NULL,
      min_age INTEGER NOT NULL CHECK (min_age >= 0),
      max_age INTEGER NOT NULL CHECK (max_age >= min_age),
      price NUMERIC(10, 2) NOT NULL CHECK (price >= 0),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS reservations (
      id UUID PRIMARY KEY,
      room_id UUID NOT NULL REFERENCES rooms(id) ON UPDATE CASCADE ON DELETE RESTRICT,
      client_id UUID NOT NULL REFERENCES clients(id) ON UPDATE CASCADE ON DELETE RESTRICT,
      check_in_date TIMESTAMPTZ NOT NULL,
      check_out_date TIMESTAMPTZ NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('Pendente', 'Confirmada', 'EmAndamento', 'Conclu\u00edda', 'Cancelada')),
      total_price NUMERIC(10, 2) NOT NULL CHECK (total_price >= 0),
      rate_type TEXT NULL CHECK (rate_type IN ('single', 'couple')),
      base_daily_rate NUMERIC(10, 2) NULL CHECK (base_daily_rate > 0),
      night_count INTEGER NULL CHECK (night_count > 0),
      additional_daily_total NUMERIC(10, 2) NULL CHECK (additional_daily_total >= 0),
      subtotal_price NUMERIC(10, 2) NULL CHECK (subtotal_price >= 0),
      price_source TEXT NULL CHECK (price_source IN ('catalog', 'manual')),
      discount_amount NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
      price_override_reason TEXT NULL,
      priced_by UUID NULL REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS reservation_guests (
      id UUID PRIMARY KEY,
      reservation_id UUID NOT NULL REFERENCES reservations(id) ON UPDATE CASCADE ON DELETE CASCADE,
      name TEXT NOT NULL,
      age INTEGER NOT NULL CHECK (age >= 0 AND age <= 120),
      pricing_rule_id UUID NULL REFERENCES pricing_rules(id) ON UPDATE CASCADE ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS reservation_payments (
      id UUID PRIMARY KEY,
      reservation_id UUID NOT NULL REFERENCES reservations(id) ON UPDATE CASCADE ON DELETE CASCADE,
      stage TEXT NOT NULL CHECK (stage IN ('Confirmacao', 'CheckIn', 'CheckOut')),
      method TEXT NOT NULL CHECK (method IN ('Dinheiro', 'Pix', 'CartaoDebito', 'CartaoCredito')),
      amount NUMERIC(10, 2) NOT NULL CHECK (amount >= 0),
      note TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_key
      ON users (LOWER(email));
  `);

  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS categories_name_lower_key
      ON categories (LOWER(name));
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_reservations_room_dates
      ON reservations (room_id, check_in_date, check_out_date);
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_reservations_occupancy_period
      ON reservations (check_in_date, check_out_date)
      WHERE status <> 'Cancelada';
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_reservation_guests_reservation_id
      ON reservation_guests (reservation_id);
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_reservation_payments_reservation_id
      ON reservation_payments (reservation_id);
  `);
}

async function migrateReservationPricingSchema() {
  // Expand-only migration: old columns remain available for existing clients.
  await pool.query(`
    ALTER TABLE categories
      ADD COLUMN IF NOT EXISTS single_price NUMERIC(10, 2) NULL CHECK (single_price > 0),
      ADD COLUMN IF NOT EXISTS couple_price NUMERIC(10, 2) NULL CHECK (couple_price > 0)
  `);

  await pool.query(`
    UPDATE categories
    SET couple_price = price
    WHERE couple_price IS NULL
  `);

  await pool.query(`
    ALTER TABLE reservations
      ADD COLUMN IF NOT EXISTS rate_type TEXT NULL CHECK (rate_type IN ('single', 'couple')),
      ADD COLUMN IF NOT EXISTS base_daily_rate NUMERIC(10, 2) NULL CHECK (base_daily_rate > 0),
      ADD COLUMN IF NOT EXISTS night_count INTEGER NULL CHECK (night_count > 0),
      ADD COLUMN IF NOT EXISTS additional_daily_total NUMERIC(10, 2) NULL CHECK (additional_daily_total >= 0),
      ADD COLUMN IF NOT EXISTS subtotal_price NUMERIC(10, 2) NULL CHECK (subtotal_price >= 0),
      ADD COLUMN IF NOT EXISTS price_source TEXT NULL CHECK (price_source IN ('catalog', 'manual')),
      ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
      ADD COLUMN IF NOT EXISTS price_override_reason TEXT NULL,
      ADD COLUMN IF NOT EXISTS priced_by UUID NULL REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL
  `);
}

async function createReservationConstraints() {
  await pool.query(`CREATE EXTENSION IF NOT EXISTS btree_gist`);

  await pool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'reservations_dates_valid'
          AND conrelid = 'reservations'::regclass
      ) THEN
        ALTER TABLE reservations
          ADD CONSTRAINT reservations_dates_valid
          CHECK (check_out_date > check_in_date);
      END IF;
    END $$;
  `);

  await pool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'reservations_no_overlapping_active_stays'
          AND conrelid = 'reservations'::regclass
      ) THEN
        ALTER TABLE reservations
          ADD CONSTRAINT reservations_no_overlapping_active_stays
          EXCLUDE USING gist (
            room_id WITH =,
            tstzrange(check_in_date, check_out_date, '[)') WITH &&
          )
          WHERE (status IN ('Pendente', 'Confirmada', 'EmAndamento'));
      END IF;
    END $$;
  `);
}

async function migrateLegacyRoomStatuses() {
  await pool.query(
    `
      UPDATE rooms
      SET status = $1
      WHERE status IN ('Livre', 'Ocupado')
    `,
    [ROOM_STATUS_AVAILABLE]
  );
}

async function seedDefaults() {
  const users = await query<{ id: string }>("SELECT id FROM users LIMIT 1");
  if (users.length === 0 && env.BOOTSTRAP_ADMIN_EMAIL && env.BOOTSTRAP_ADMIN_PASSWORD) {
    const passwordHash = await bcrypt.hash(env.BOOTSTRAP_ADMIN_PASSWORD, 12);

    await pool.query(
      `
        INSERT INTO users (id, name, email, password_hash, role)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (email) DO NOTHING
      `,
      [
        randomUUID(),
        env.BOOTSTRAP_ADMIN_NAME,
        env.BOOTSTRAP_ADMIN_EMAIL,
        passwordHash,
        "admin"
      ]
    );
  }

  const categories = await query<{ id: string }>("SELECT id FROM categories LIMIT 1");
  if (categories.length === 0) {
    const standardCategoryId = randomUUID();
    const deluxeCategoryId = randomUUID();

    await pool.query(
      `
        INSERT INTO categories (id, name, price, couple_price)
        VALUES
          ($1, 'Standard', 180, 180),
          ($2, 'Deluxe', 320, 320)
      `,
      [standardCategoryId, deluxeCategoryId]
    );

    await pool.query(
      `
        INSERT INTO rooms (id, number, type, capacity, daily_price, status, category_id)
        VALUES
          ($1, 101, 'Standard', 2, 180, $3, $4),
          ($2, 201, 'Deluxe', 3, 320, $3, $5)
      `,
      [randomUUID(), randomUUID(), ROOM_STATUS_AVAILABLE, standardCategoryId, deluxeCategoryId]
    );
  }

  const pricingRules = await query<{ id: string }>("SELECT id FROM pricing_rules LIMIT 1");
  if (pricingRules.length === 0) {
    await pool.query(
      `
        INSERT INTO pricing_rules (id, name, description, min_age, max_age, price)
        VALUES
          ($1, 'Crianca', 'Criancas de 0 a 11 anos', 0, 11, 45),
          ($2, 'Adolescente', 'Adolescentes de 12 a 17 anos', 12, 17, 60),
          ($3, 'Adulto', 'Adultos de 18 a 120 anos', 18, 120, 95)
      `,
      [randomUUID(), randomUUID(), randomUUID()]
    );
  }
}

export async function initializeDatabase() {
  await createTables();
  await migrateReservationPricingSchema();
  await createReservationConstraints();
  await migrateLegacyRoomStatuses();
  await seedDefaults();
}
