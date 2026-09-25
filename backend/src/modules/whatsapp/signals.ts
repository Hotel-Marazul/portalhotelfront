import { query } from "../../db/client.js";
import type { TriageAgentResponse } from "./agents-client.js";
import type { QueueSignals } from "./scoring.js";

export async function buildQueueSignals(
  conversationId: string,
  reading: TriageAgentResponse,
  hotelToday: string,
  facts: { availability?: Array<{ roomsFree?: number }>; operationalRooms?: number }
): Promise<QueueSignals> {
  const rows = await query<{
    kind: "guest" | "supplier";
    client_id: string | null;
    returning_guest: boolean;
    in_house: boolean;
    arrives_today: boolean;
    last_stay: string | null;
  }>(
    `SELECT contact.kind, contact.client_id,
       EXISTS (SELECT 1 FROM reservations r WHERE r.client_id = contact.client_id AND r.status = 'Concluída') AS returning_guest,
       EXISTS (SELECT 1 FROM reservations r WHERE r.client_id = contact.client_id AND r.status = 'EmAndamento') AS in_house,
       EXISTS (SELECT 1 FROM reservations r WHERE r.client_id = contact.client_id
         AND r.status IN ('Pendente', 'Confirmada') AND r.check_in_date = $2::date) AS arrives_today,
       (SELECT to_char(r.check_in_date, 'YYYY-MM') FROM reservations r
        WHERE r.client_id = contact.client_id AND r.status = 'Concluída'
        ORDER BY r.check_out_date DESC LIMIT 1) AS last_stay
     FROM whatsapp_conversations conversation
     JOIN whatsapp_contacts contact ON contact.id = conversation.contact_id
     WHERE conversation.id = $1
     LIMIT 1`,
    [conversationId, hotelToday]
  );
  const row = rows[0];
  const checkIn = reading.checkIn ?? null;
  const checkOut = reading.checkOut ?? null;
  const hasDates = Boolean(checkIn && checkOut && checkOut > checkIn && checkIn >= hotelToday);
  const roomsFree = (facts.availability ?? []).reduce((sum, item) => sum + Number(item.roomsFree ?? 0), 0);
  const operationalRooms = Math.max(0, Number(facts.operationalRooms ?? 0));
  return {
    intent: reading.intent,
    has_dates: hasDates,
    has_guest_count: Number(reading.adults ?? 0) >= 1,
    is_returning_guest: Boolean(row?.returning_guest),
    is_in_house: Boolean(row?.in_house),
    arrives_today: Boolean(row?.arrives_today),
    high_demand: hasDates && roomsFree > 0 && operationalRooms > 0 && roomsFree <= operationalRooms * 0.2,
    no_availability: hasDates && roomsFree === 0,
    is_supplier: row?.kind === "supplier",
    unknown_contact: !row?.client_id,
    rooms_free: roomsFree,
    last_stay: row?.last_stay ?? null
  };
}
