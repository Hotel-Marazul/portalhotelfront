import { pool } from "./client.js";

/**
 * Limpeza por quarto. O check-out (reserva vira Concluída) marca o quarto como
 * "precisa_limpar" por gatilho, venha a mudança de onde vier.
 */
export async function migrateRoomHousekeepingSchema() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`
      ALTER TABLE rooms ADD COLUMN IF NOT EXISTS housekeeping_status TEXT NOT NULL DEFAULT 'limpo'
        CHECK (housekeeping_status IN ('limpo', 'em_limpeza', 'precisa_limpar'));
      ALTER TABLE rooms ADD COLUMN IF NOT EXISTS housekeeping_updated_at TIMESTAMPTZ NULL;
      ALTER TABLE rooms ADD COLUMN IF NOT EXISTS housekeeping_updated_by UUID NULL
        REFERENCES users(id) ON DELETE SET NULL;
      CREATE OR REPLACE FUNCTION mark_room_dirty_on_checkout() RETURNS TRIGGER
      LANGUAGE plpgsql AS $dirty$
      BEGIN
        UPDATE rooms
        SET housekeeping_status = 'precisa_limpar', housekeeping_updated_at = NOW(), housekeeping_updated_by = NULL
        WHERE id = NEW.room_id;
        RETURN NEW;
      END;
      $dirty$;
      DROP TRIGGER IF EXISTS reservations_checkout_marks_room_dirty ON reservations;
      CREATE TRIGGER reservations_checkout_marks_room_dirty
        AFTER UPDATE OF status ON reservations
        FOR EACH ROW
        WHEN (NEW.status = 'Concluída' AND OLD.status IS DISTINCT FROM 'Concluída')
        EXECUTE FUNCTION mark_room_dirty_on_checkout();
    `);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
