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
      role TEXT NOT NULL CHECK (role IN ('admin', 'receptionist')),
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
      version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
      idempotency_key UUID NULL,
      idempotency_fingerprint TEXT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
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
      reservation_id UUID NOT NULL REFERENCES reservations(id) ON UPDATE CASCADE ON DELETE RESTRICT,
      stage TEXT NOT NULL CHECK (stage IN ('Confirmacao', 'CheckIn', 'CheckOut')),
      method TEXT NOT NULL CHECK (method IN ('Dinheiro', 'Pix', 'CartaoDebito', 'CartaoCredito')),
      amount NUMERIC(10, 2) NOT NULL,
      note TEXT NOT NULL DEFAULT '',
      idempotency_key UUID NULL,
      entry_type TEXT NOT NULL DEFAULT 'payment' CHECK (entry_type IN ('payment', 'reversal')),
      reversed_payment_id UUID NULL REFERENCES reservation_payments(id) ON UPDATE CASCADE ON DELETE RESTRICT,
      created_by UUID NULL REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT reservation_payments_amount_by_entry_type CHECK (
        (entry_type = 'payment' AND amount > 0)
        OR (entry_type = 'reversal' AND amount < 0)
      )
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS reservation_events (
      id UUID PRIMARY KEY,
      reservation_id UUID NOT NULL REFERENCES reservations(id) ON UPDATE CASCADE ON DELETE RESTRICT,
      actor_type TEXT NOT NULL CHECK (actor_type IN ('user', 'agents-service', 'system')),
      actor_id UUID NULL REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL,
      action TEXT NOT NULL,
      previous_state JSONB NULL,
      next_state JSONB NULL,
      reason TEXT NULL,
      correlation_id UUID NULL,
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

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_reservation_events_reservation_id
      ON reservation_events (reservation_id, created_at DESC);
  `);

  await pool.query(`
    CREATE OR REPLACE FUNCTION prevent_reservation_event_mutation()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    BEGIN
      RAISE EXCEPTION 'reservation_events is append-only' USING ERRCODE = '55000';
    END;
    $$;
  `);

  await pool.query(`
    DROP TRIGGER IF EXISTS reservation_events_append_only ON reservation_events;
    CREATE TRIGGER reservation_events_append_only
      BEFORE UPDATE OR DELETE ON reservation_events
      FOR EACH ROW EXECUTE FUNCTION prevent_reservation_event_mutation();
  `);
}

async function createWhatsappTables() {
  await pool.query(`
    ALTER TABLE clients ADD COLUMN IF NOT EXISTS fone_e164 TEXT NULL;
    CREATE INDEX IF NOT EXISTS idx_clients_fone_e164 ON clients (fone_e164);
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS whatsapp_instances (
      id UUID PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      connection_state TEXT NOT NULL DEFAULT 'unknown'
        CHECK (connection_state IN ('open', 'connecting', 'close', 'unknown')),
      state_changed_at TIMESTAMPTZ NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS whatsapp_webhook_events (
      id UUID PRIMARY KEY,
      instance_name TEXT NOT NULL,
      event_type TEXT NOT NULL,
      payload JSONB NOT NULL,
      received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      processed_at TIMESTAMPTZ NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      process_error TEXT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_whatsapp_webhook_events_pending
      ON whatsapp_webhook_events (received_at) WHERE processed_at IS NULL;

    CREATE TABLE IF NOT EXISTS whatsapp_contacts (
      id UUID PRIMARY KEY,
      remote_jid TEXT NOT NULL UNIQUE,
      phone_e164 TEXT NOT NULL,
      push_name TEXT NOT NULL DEFAULT '',
      kind TEXT NOT NULL DEFAULT 'guest' CHECK (kind IN ('guest', 'supplier')),
      client_id UUID NULL REFERENCES clients(id) ON DELETE SET NULL,
      linked_by_user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
      linked_at TIMESTAMPTZ NULL,
      auto_link_blocked BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_whatsapp_contacts_phone ON whatsapp_contacts (phone_e164);
    CREATE INDEX IF NOT EXISTS idx_whatsapp_contacts_client ON whatsapp_contacts (client_id);

    CREATE TABLE IF NOT EXISTS whatsapp_conversations (
      id UUID PRIMARY KEY,
      contact_id UUID NOT NULL UNIQUE REFERENCES whatsapp_contacts(id) ON DELETE CASCADE,
      last_message_at TIMESTAMPTZ NULL,
      last_inbound_at TIMESTAMPTZ NULL,
      awaiting_since TIMESTAMPTZ NULL,
      unread_count INTEGER NOT NULL DEFAULT 0 CHECK (unread_count >= 0),
      current_episode_id UUID NULL,
      current_reading_id UUID NULL,
      base_score INTEGER NULL CHECK (base_score BETWEEN 0 AND 100),
      score_reasons JSONB NOT NULL DEFAULT '[]',
      triage_status TEXT NOT NULL DEFAULT 'idle'
        CHECK (triage_status IN ('idle', 'pending', 'running', 'done', 'failed', 'skipped')),
      triage_requested_at TIMESTAMPTZ NULL,
      triage_started_at TIMESTAMPTZ NULL,
      triage_attempts INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_awaiting
      ON whatsapp_conversations (awaiting_since) WHERE awaiting_since IS NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_last_message
      ON whatsapp_conversations (last_message_at DESC);
    CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_triage_pending
      ON whatsapp_conversations (triage_requested_at) WHERE triage_status = 'pending';

    CREATE TABLE IF NOT EXISTS whatsapp_episodes (
      id UUID PRIMARY KEY,
      conversation_id UUID NOT NULL REFERENCES whatsapp_conversations(id) ON DELETE CASCADE,
      started_at TIMESTAMPTZ NOT NULL,
      closed_at TIMESTAMPTZ NULL,
      close_reason TEXT NULL CHECK (close_reason IN ('outcome', 'idle')),
      outcome TEXT NULL CHECK (outcome IN ('booked', 'not_booked', 'not_lead')),
      outcome_set_by_user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
      outcome_set_at TIMESTAMPTZ NULL,
      is_lead BOOLEAN NOT NULL DEFAULT FALSE,
      first_level TEXT NULL CHECK (first_level IN ('agora', 'hoje', 'espera')),
      first_response_at TIMESTAMPTZ NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_episodes_one_open
      ON whatsapp_episodes (conversation_id) WHERE closed_at IS NULL;
    CREATE INDEX IF NOT EXISTS idx_whatsapp_episodes_started
      ON whatsapp_episodes (started_at DESC);

    CREATE TABLE IF NOT EXISTS whatsapp_messages (
      id UUID PRIMARY KEY,
      conversation_id UUID NOT NULL REFERENCES whatsapp_conversations(id) ON DELETE CASCADE,
      episode_id UUID NULL REFERENCES whatsapp_episodes(id) ON DELETE SET NULL,
      provider_message_id TEXT NULL,
      direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
      origin TEXT NOT NULL CHECK (origin IN
        ('guest', 'phone', 'portal_manual', 'portal_suggestion', 'portal_suggestion_edited')),
      media_type TEXT NOT NULL DEFAULT 'text' CHECK (media_type IN
        ('text', 'image', 'audio', 'video', 'document', 'sticker', 'location', 'contact', 'other')),
      body TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL CHECK (status IN ('received', 'sending', 'sent', 'delivered', 'read', 'failed')),
      failure_reason TEXT NULL,
      sent_at TIMESTAMPTZ NOT NULL,
      sent_by_user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
      client_request_id UUID NULL,
      suggestion_id UUID NULL,
      raw JSONB NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT whatsapp_messages_origin_direction CHECK ((direction = 'inbound') = (origin = 'guest'))
    );
    CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_messages_provider_id_key
      ON whatsapp_messages (provider_message_id) WHERE provider_message_id IS NOT NULL;
    CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_messages_client_request_key
      ON whatsapp_messages (client_request_id) WHERE client_request_id IS NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_timeline
      ON whatsapp_messages (conversation_id, sent_at DESC, id DESC);

    CREATE TABLE IF NOT EXISTS whatsapp_ai_readings (
      id UUID PRIMARY KEY,
      conversation_id UUID NOT NULL REFERENCES whatsapp_conversations(id) ON DELETE CASCADE,
      episode_id UUID NULL REFERENCES whatsapp_episodes(id) ON DELETE SET NULL,
      last_message_id UUID NOT NULL REFERENCES whatsapp_messages(id) ON DELETE CASCADE,
      intent TEXT NOT NULL CHECK (intent IN ('reserva_nova', 'preco', 'alteracao_reserva', 'cancelamento',
        'duvida_estadia', 'problema_estadia', 'agradecimento', 'fornecedor', 'outro', 'desconhecida')),
      check_in DATE NULL,
      check_out DATE NULL,
      adults INTEGER NULL CHECK (adults BETWEEN 1 AND 50),
      children_ages INTEGER[] NOT NULL DEFAULT '{}',
      requests TEXT[] NOT NULL DEFAULT '{}',
      missing_fields TEXT[] NOT NULL DEFAULT '{}',
      headline TEXT NOT NULL,
      marker_text TEXT NOT NULL,
      signals JSONB NOT NULL,
      facts JSONB NOT NULL DEFAULT '{}',
      base_score INTEGER NOT NULL,
      level TEXT NOT NULL CHECK (level IN ('agora', 'hoje', 'espera')),
      reasons JSONB NOT NULL,
      model TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_whatsapp_ai_readings_conversation
      ON whatsapp_ai_readings (conversation_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS whatsapp_reply_suggestions (
      id UUID PRIMARY KEY,
      conversation_id UUID NOT NULL REFERENCES whatsapp_conversations(id) ON DELETE CASCADE,
      reply_to_message_id UUID NOT NULL REFERENCES whatsapp_messages(id) ON DELETE CASCADE,
      parts JSONB NOT NULL,
      text TEXT NOT NULL,
      basis TEXT[] NOT NULL DEFAULT '{}',
      rule_ids UUID[] NOT NULL DEFAULT '{}',
      status TEXT NOT NULL DEFAULT 'shown' CHECK (status IN ('shown', 'used', 'dismissed', 'superseded')),
      status_changed_by_user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
      status_changed_at TIMESTAMPTZ NULL,
      model TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_reply_suggestions_live
      ON whatsapp_reply_suggestions (reply_to_message_id) WHERE status <> 'superseded';

    CREATE TABLE IF NOT EXISTS whatsapp_priority_feedback (
      id UUID PRIMARY KEY,
      conversation_id UUID NOT NULL REFERENCES whatsapp_conversations(id) ON DELETE CASCADE,
      episode_id UUID NULL REFERENCES whatsapp_episodes(id) ON DELETE SET NULL,
      reading_id UUID NOT NULL REFERENCES whatsapp_ai_readings(id) ON DELETE CASCADE,
      verdict TEXT NOT NULL CHECK (verdict IN ('correct', 'should_be_higher', 'should_be_lower')),
      level_at_feedback TEXT NOT NULL CHECK (level_at_feedback IN ('agora', 'hoje', 'espera')),
      position_at_feedback INTEGER NOT NULL CHECK (position_at_feedback >= 1),
      user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (reading_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS whatsapp_ai_rules (
      id UUID PRIMARY KEY,
      kind TEXT NOT NULL CHECK (kind IN ('queue', 'reply')),
      status TEXT NOT NULL CHECK (status IN ('proposed', 'active', 'ignored', 'reverted')),
      title TEXT NOT NULL,
      condition JSONB NULL,
      weight INTEGER NULL,
      instruction TEXT NULL,
      condition_key TEXT NOT NULL,
      source TEXT NOT NULL CHECK (source IN ('outcomes', 'corrections', 'edits')),
      evidence JSONB NOT NULL,
      evidence_text TEXT NOT NULL,
      proposed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      decided_by_user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
      decided_at TIMESTAMPTZ NULL,
      CONSTRAINT whatsapp_ai_rules_queue_shape CHECK (
        (kind = 'queue' AND condition IS NOT NULL AND weight IN (-10, 10) AND instruction IS NULL) OR
        (kind = 'reply' AND instruction IS NOT NULL AND condition IS NULL AND weight IS NULL))
    );
    CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_ai_rules_live_key
      ON whatsapp_ai_rules (kind, condition_key) WHERE status IN ('proposed', 'active');

    CREATE TABLE IF NOT EXISTS whatsapp_ai_rule_events (
      id UUID PRIMARY KEY,
      rule_id UUID NOT NULL REFERENCES whatsapp_ai_rules(id) ON DELETE CASCADE,
      action TEXT NOT NULL CHECK (action IN ('proposed', 'accepted', 'ignored', 'reverted')),
      actor_user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS whatsapp_ai_daily_usage (
      usage_date DATE PRIMARY KEY,
      calls INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS whatsapp_job_runs (
      job_name TEXT PRIMARY KEY,
      last_started_at TIMESTAMPTZ NULL,
      last_finished_at TIMESTAMPTZ NULL,
      last_error TEXT NULL,
      last_result JSONB NULL
    );
  `);

  await pool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'whatsapp_conversations_current_episode_fkey'
          AND conrelid = 'whatsapp_conversations'::regclass
      ) THEN
        ALTER TABLE whatsapp_conversations
          ADD CONSTRAINT whatsapp_conversations_current_episode_fkey
          FOREIGN KEY (current_episode_id) REFERENCES whatsapp_episodes(id) ON DELETE SET NULL;
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'whatsapp_conversations_current_reading_fkey'
          AND conrelid = 'whatsapp_conversations'::regclass
      ) THEN
        ALTER TABLE whatsapp_conversations
          ADD CONSTRAINT whatsapp_conversations_current_reading_fkey
          FOREIGN KEY (current_reading_id) REFERENCES whatsapp_ai_readings(id) ON DELETE SET NULL;
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'whatsapp_messages_suggestion_fkey'
          AND conrelid = 'whatsapp_messages'::regclass
      ) THEN
        ALTER TABLE whatsapp_messages
          ADD CONSTRAINT whatsapp_messages_suggestion_fkey
          FOREIGN KEY (suggestion_id) REFERENCES whatsapp_reply_suggestions(id) ON DELETE SET NULL;
      END IF;
    END $$;
  `);

  await pool.query(`
    CREATE OR REPLACE FUNCTION prevent_whatsapp_ai_rule_event_mutation()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    BEGIN
      RAISE EXCEPTION 'whatsapp_ai_rule_events is append-only' USING ERRCODE = '55000';
    END;
    $$;

    DROP TRIGGER IF EXISTS whatsapp_ai_rule_events_append_only ON whatsapp_ai_rule_events;
    CREATE TRIGGER whatsapp_ai_rule_events_append_only
      BEFORE UPDATE OR DELETE ON whatsapp_ai_rule_events
      FOR EACH ROW EXECUTE FUNCTION prevent_whatsapp_ai_rule_event_mutation();
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
      ADD COLUMN IF NOT EXISTS priced_by UUID NULL REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
      ADD COLUMN IF NOT EXISTS idempotency_key UUID NULL,
      ADD COLUMN IF NOT EXISTS idempotency_fingerprint TEXT NULL,
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  `);

  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS reservations_idempotency_key_unique
      ON reservations (idempotency_key)
      WHERE idempotency_key IS NOT NULL
  `);

  await pool.query(`
    ALTER TABLE reservation_payments
      ADD COLUMN IF NOT EXISTS idempotency_key UUID NULL,
      ADD COLUMN IF NOT EXISTS entry_type TEXT NOT NULL DEFAULT 'payment' CHECK (entry_type IN ('payment', 'reversal')),
      ADD COLUMN IF NOT EXISTS reversed_payment_id UUID NULL REFERENCES reservation_payments(id) ON UPDATE CASCADE ON DELETE RESTRICT,
      ADD COLUMN IF NOT EXISTS created_by UUID NULL REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  `);

  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS reservation_payments_idempotency_key_unique
      ON reservation_payments (reservation_id, idempotency_key)
      WHERE idempotency_key IS NOT NULL
  `);

  await pool.query(`
    ALTER TABLE reservation_payments
      DROP CONSTRAINT IF EXISTS reservation_payments_amount_check,
      DROP CONSTRAINT IF EXISTS reservation_payments_amount_nonzero,
      DROP CONSTRAINT IF EXISTS reservation_payments_amount_by_entry_type
  `);

  await pool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'reservation_payments_amount_by_entry_type'
          AND conrelid = 'reservation_payments'::regclass
      ) THEN
        ALTER TABLE reservation_payments
          ADD CONSTRAINT reservation_payments_amount_by_entry_type CHECK (
            (entry_type = 'payment' AND amount > 0)
            OR (entry_type = 'reversal' AND amount < 0)
          ) NOT VALID;
      END IF;
    END $$;
  `);

  await pool.query(`
    ALTER TABLE reservation_payments
      DROP CONSTRAINT IF EXISTS reservation_payments_reservation_id_fkey;
    ALTER TABLE reservation_payments
      ADD CONSTRAINT reservation_payments_reservation_id_fkey
      FOREIGN KEY (reservation_id) REFERENCES reservations(id)
      ON UPDATE CASCADE ON DELETE RESTRICT NOT VALID;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS reservation_events (
      id UUID PRIMARY KEY,
      reservation_id UUID NOT NULL REFERENCES reservations(id) ON UPDATE CASCADE ON DELETE RESTRICT,
      actor_type TEXT NOT NULL CHECK (actor_type IN ('user', 'agents-service', 'system')),
      actor_id UUID NULL REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL,
      action TEXT NOT NULL,
      previous_state JSONB NULL,
      next_state JSONB NULL,
      reason TEXT NULL,
      correlation_id UUID NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS reservation_payments_idempotency_key_unique
      ON reservation_payments (reservation_id, idempotency_key)
      WHERE idempotency_key IS NOT NULL
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_reservation_events_reservation_id
      ON reservation_events (reservation_id, created_at DESC)
  `);
}

async function createReservationConstraints() {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await client.query(`CREATE EXTENSION IF NOT EXISTS btree_gist`);

    await client.query(`
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

    // Adiciona a protecao nova antes de remover a antiga. Se houver dados
    // inconsistentes, a transacao falha e a trava anterior permanece intacta.
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = 'reservations_no_overlapping_stays'
            AND conrelid = 'reservations'::regclass
        ) THEN
          ALTER TABLE reservations
            ADD CONSTRAINT reservations_no_overlapping_stays
            EXCLUDE USING gist (
              room_id WITH =,
              tstzrange(check_in_date, check_out_date, '[)') WITH &&
            )
            WHERE (status <> 'Cancelada');
        END IF;
      END $$;
    `);

    await client.query(`
      ALTER TABLE reservations
        DROP CONSTRAINT IF EXISTS reservations_no_overlapping_active_stays
    `);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

// A recepção era gravada como `manager`, nome que se confundia com "gerente"
// (que é `admin`). Só roda enquanto a restrição antiga ainda aceitar `manager`.
async function migrateLegacyUserRoles() {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await client.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = 'users_role_check'
            AND conrelid = 'users'::regclass
            AND pg_get_constraintdef(oid) LIKE '%manager%'
        ) THEN
          ALTER TABLE users DROP CONSTRAINT users_role_check;
          UPDATE users SET role = 'receptionist' WHERE role = 'manager';
          ALTER TABLE users
            ADD CONSTRAINT users_role_check
            CHECK (role IN ('admin', 'receptionist'));
        END IF;
      END $$;
    `);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function migrateLegacyRoomStatuses() {
  await pool.query(
    `
      UPDATE rooms
      SET status = CASE WHEN status IN ('Manutencao', '${ROOM_STATUS_MAINTENANCE}')
                        THEN '${ROOM_STATUS_MAINTENANCE}'
                        ELSE $1
                   END
      WHERE status IN ('Livre', 'Ocupado', 'Disponivel', 'Manutencao')
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
  await createWhatsappTables();
  await migrateLegacyUserRoles();
  await migrateReservationPricingSchema();
  await createReservationConstraints();
  await migrateLegacyRoomStatuses();
  await seedDefaults();
}
