-- Correção do cadastro confirmada pelo hotel em 2026-10-28.
-- Falha sem alterar dados se houver reservas nas unidades afetadas.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
LOCK TABLE rooms, reservations IN SHARE ROW EXCLUSIVE MODE;

DO $correction$
DECLARE
  source_code CONSTANT TEXT := 'marazul-summer-reported-2026-10-26';
  previous_rooms JSONB;
BEGIN
  IF current_database() <> 'portal_hotel' THEN
    RAISE EXCEPTION 'Correção restrita ao banco portal_hotel.';
  END IF;
  IF EXISTS (SELECT 1 FROM hotel_seasonal_rate_catalogs
    WHERE code=source_code AND payload ? 'connectedRoomsCorrection20261028') THEN
    IF NOT EXISTS (SELECT 1 FROM rooms WHERE number=115 AND connected_room_number IS NULL AND capacity=4)
      OR NOT EXISTS (SELECT 1 FROM rooms WHERE number=116 AND connected_room_number=117 AND capacity=5)
      OR NOT EXISTS (SELECT 1 FROM rooms WHERE number=125 AND connected_room_number=126 AND capacity=5)
      OR EXISTS (SELECT 1 FROM rooms WHERE number IN (117,126)) THEN
      RAISE EXCEPTION 'Cadastro diverge da correção registrada.';
    END IF;
    RETURN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM hotel_seasonal_rate_catalogs WHERE code=source_code)
    OR (SELECT count(*) FROM rooms WHERE number IN (115,117,125,126))<>4
    OR EXISTS (SELECT 1 FROM rooms WHERE number=116)
    OR NOT EXISTS (SELECT 1 FROM rooms WHERE number=115 AND connected_room_number=116 AND capacity=5)
    OR EXISTS (SELECT 1 FROM rooms WHERE number IN (117,125,126) AND connected_room_number IS NOT NULL) THEN
    RAISE EXCEPTION 'Inventário de origem inesperado; revisar antes de corrigir.';
  END IF;
  IF EXISTS (SELECT 1 FROM reservations r JOIN rooms rm ON rm.id=r.room_id
    WHERE rm.number IN (115,117,125,126)) THEN
    RAISE EXCEPTION 'Há reservas vinculadas; reconciliar antes de corrigir.';
  END IF;
  SELECT jsonb_agg(to_jsonb(rm) ORDER BY number) INTO previous_rooms
    FROM rooms rm WHERE number IN (115,117,125,126);

  UPDATE rooms SET connected_room_number=NULL, capacity=4 WHERE number=115;
  UPDATE rooms SET number=116, connected_room_number=117, capacity=5 WHERE number=117;
  DELETE FROM rooms WHERE number=126;
  UPDATE rooms SET connected_room_number=126, capacity=5 WHERE number=125;

  UPDATE hotel_seasonal_rate_catalogs SET payload=jsonb_set(payload,
    '{connectedRoomsCorrection20261028}', jsonb_build_object(
      'reportedOn','2026-10-28','before',previous_rooms,
      'connectedUnits',jsonb_build_array(
        jsonb_build_object('number',116,'connectedNumber',117,'capacity',5),
        jsonb_build_object('number',125,'connectedNumber',126,'capacity',5)),
      'standaloneRoom',115)) WHERE code=source_code;
END;
$correction$;

SELECT number, connected_room_number, capacity FROM rooms
  WHERE number IN (115,116,117,125,126) ORDER BY number;
SELECT number,room_id FROM room_inventory_numbers
  WHERE number IN (115,116,117,125,126) ORDER BY number;
COMMIT;
