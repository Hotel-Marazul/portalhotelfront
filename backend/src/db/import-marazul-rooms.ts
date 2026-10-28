import { randomUUID } from "node:crypto";
import { pool } from "./client.js";
import { migrateRoomInventorySchema } from "./room-inventory-schema.js";

const roster = [
  { category: "Super Luxo", numbers: [201,202,203,204,205] },
  { category: "Luxo", numbers: [103,104,105,122,123,131,132] },
  { category: "Standard", numbers: [102,106,108,110,111,121,130] },
  { category: "Simples", numbers: [107,109,112,113,115,117,118,119,120] }
];
const sourceCode = "marazul-summer-reported-2026-10-26";

async function importRooms() {
  await migrateRoomInventorySchema();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SET LOCAL lock_timeout = '5s'");
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", ["marazul-room-roster-2026-10-27"]);
    const database = (await client.query("SELECT current_database() AS name")).rows[0].name;
    if (database !== "portal_hotel") throw new Error("Importação restrita ao banco portal_hotel.");
    const source = await client.query<{ payload: unknown }>("SELECT payload FROM hotel_seasonal_rate_catalogs WHERE code=$1 FOR UPDATE", [sourceCode]);
    if (source.rows.length !== 1) throw new Error("Catálogo sazonal de origem não encontrado.");
    if (Object.hasOwn(source.rows[0].payload as object, "connectedRoomsCorrection20261028")) {
      throw new Error("Cadastro corrigido em 2026-10-28: conjugados 116/117 e 125/126. A importação histórica não pode sobrescrevê-lo.");
    }
    const before = await client.query("SELECT id,number,type,capacity,status,daily_price,category_id,connected_room_number FROM rooms ORDER BY number FOR UPDATE");
    // A separately-booked 116 needs human reconciliation before it can be grouped.
    if (before.rows.some((room) => room.number === 116)) {
      throw new Error("O 116 já existe como unidade independente; reconciliar antes de agrupar.");
    }
    const extra = before.rows.filter((room) => !roster.some((group) => group.numbers.includes(room.number)));
    if (extra.some((room) => room.number !== 101)) {
      throw new Error("Há quartos fora da lista além do 101; revisar antes de importar.");
    }
    const active101 = await client.query(`SELECT 1 FROM reservations r JOIN rooms rm ON rm.id=r.room_id
      WHERE rm.number=101 AND r.status <> 'Cancelada' AND r.check_out_date > NOW() LIMIT 1`);
    if (active101.rowCount) throw new Error("O quarto 101 possui reserva vigente/futura; revisar antes de desativar.");
    for (const group of roster) {
      const categories = await client.query<{ id: string; price: string }>(
        "SELECT id,coalesce(couple_price,price)::text AS price FROM categories WHERE name=$1 FOR SHARE", [group.category]
      );
      if (categories.rows.length !== 1) throw new Error(`Categoria ausente ou ambígua: ${group.category}`);
      const category = categories.rows[0];
      for (const number of group.numbers) {
        const existing = before.rows.find((room) => room.number === number);
        const capacity = number === 115 ? 5 : number === 102 ? 2 : 4;
        await client.query(`INSERT INTO rooms (id,number,type,capacity,daily_price,status,category_id,connected_room_number)
          VALUES ($1,$2,$3,$4,$5,'Disponível',$6,$7)
          ON CONFLICT (number) DO UPDATE SET type=EXCLUDED.type, category_id=EXCLUDED.category_id,
            daily_price=EXCLUDED.daily_price, capacity=EXCLUDED.capacity, connected_room_number=EXCLUDED.connected_room_number`,
        [existing?.id ?? randomUUID(), number, group.category, capacity, category.price, category.id, number === 115 ? 116 : null]);
      }
    }
    await client.query("UPDATE rooms SET status='Manutenção' WHERE number=101");
    await client.query(`UPDATE hotel_seasonal_rate_catalogs SET payload =
      CASE WHEN payload ? 'beforeRoomRosterImport' THEN payload
        ELSE jsonb_set(payload,'{beforeRoomRosterImport}',$2::jsonb) END WHERE code=$1`, [sourceCode, JSON.stringify(before.rows)]);
    await client.query(`UPDATE hotel_seasonal_rate_catalogs SET payload =
      jsonb_set(payload,'{roomRosterImport}',$2::jsonb) WHERE code=$1`, [sourceCode, JSON.stringify({
      reportedOn: "2026-10-27", roster, connectedUnit: { number: 115, connectedNumber: 116, capacity: 5, soloCapacity: 2 },
      capacitiesPendingConfirmation: [], capacitiesConfirmedOn: "2026-10-27", excludedRoom: 101
    })]);
    await client.query("COMMIT");
    console.log(JSON.stringify({ bookableUnits: 28, physicalNumbers: 29, connectedUnit: "115/116", capacity: 5, solo115Capacity: 2, room102Capacity: 2, otherUnitsCapacity: 4, capacitiesConfirmed: true, preservedUnavailable: 101 }));
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally { client.release(); }
}

importRooms().catch((error) => {
  console.error(error instanceof Error ? error.message : "Falha ao importar quartos.");
  process.exitCode = 1;
}).finally(() => pool.end());
