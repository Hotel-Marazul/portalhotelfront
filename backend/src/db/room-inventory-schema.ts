import { pool } from "./client.js";

/** Each physical room number belongs to exactly one bookable inventory unit. */
export async function migrateRoomInventorySchema() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`
      ALTER TABLE rooms ADD COLUMN IF NOT EXISTS connected_room_number INTEGER NULL
        CHECK (connected_room_number > 0 AND connected_room_number <> number);
      CREATE TABLE IF NOT EXISTS room_inventory_numbers (
        number INTEGER PRIMARY KEY CHECK (number > 0),
        room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS room_inventory_numbers_room_id_idx ON room_inventory_numbers(room_id);
      INSERT INTO room_inventory_numbers(number,room_id)
        SELECT number,id FROM rooms ON CONFLICT (number) DO NOTHING;
      INSERT INTO room_inventory_numbers(number,room_id)
        SELECT connected_room_number,id FROM rooms WHERE connected_room_number IS NOT NULL
        ON CONFLICT (number) DO NOTHING;
      DO $check$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM rooms r JOIN room_inventory_numbers n
            ON n.number=r.number OR n.number=r.connected_room_number
          WHERE n.room_id<>r.id
        ) THEN
          RAISE EXCEPTION 'Um número de quarto pertence a mais de uma unidade de inventário.';
        END IF;
      END;
      $check$;
      CREATE OR REPLACE FUNCTION sync_room_inventory_numbers() RETURNS TRIGGER
      LANGUAGE plpgsql AS $sync$
      BEGIN
        DELETE FROM room_inventory_numbers WHERE room_id=NEW.id;
        INSERT INTO room_inventory_numbers(number,room_id)
          SELECT value,NEW.id FROM unnest(ARRAY[NEW.number,NEW.connected_room_number]) AS value
          WHERE value IS NOT NULL ORDER BY value;
        RETURN NEW;
      END;
      $sync$;
      DROP TRIGGER IF EXISTS rooms_sync_inventory_numbers ON rooms;
      CREATE TRIGGER rooms_sync_inventory_numbers
        AFTER INSERT OR UPDATE OF number,connected_room_number ON rooms
        FOR EACH ROW EXECUTE FUNCTION sync_room_inventory_numbers();
    `);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
