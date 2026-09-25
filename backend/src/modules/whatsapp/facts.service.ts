import { formatHotelDate, hotelCivilDateToUtc, calculateReservationPricing } from "../../utils/reservation.js";
import type { PricingRule, ReservationGuest } from "../../domain/models.js";
import { query } from "../../db/client.js";
import { findAvailableRooms } from "../rooms/availability.service.js";

interface ReadingFactsInput {
  checkIn: string | null;
  checkOut: string | null;
  adults: number | null;
  childrenAges: number[];
}

interface CategoryRow {
  id: string;
  name: string;
  price: string;
  single_price: string | null;
  couple_price: string | null;
}

function pricingGuests(reading: ReadingFactsInput, rules: PricingRule[]): ReservationGuest[] {
  const adults = Math.max(0, (reading.adults ?? 0) - 1);
  const guests: ReservationGuest[] = Array.from({ length: adults }, (_, index) => ({
    id: `adult-${index + 1}`,
    reservationId: "",
    name: "adulto",
    age: 18,
    pricingRuleId: null
  }));
  for (const [index, age] of reading.childrenAges.entries()) {
    const rule = rules.find((item) => age >= item.minAge && age <= item.maxAge);
    guests.push({
      id: `child-${index + 1}`,
      reservationId: "",
      name: "criança",
      age,
      pricingRuleId: rule?.id ?? null
    });
  }
  return guests;
}

export async function buildConversationFacts(conversationId: string, reading: ReadingFactsInput) {
  const contact = await query<{ client_id: string | null }>(
    `SELECT contact.client_id
     FROM whatsapp_conversations conversation
     JOIN whatsapp_contacts contact ON contact.id = conversation.contact_id
     WHERE conversation.id = $1 LIMIT 1`,
    [conversationId]
  );
  const categories = await query<CategoryRow>(
    `SELECT id, name, price::text, single_price::text, couple_price::text FROM categories ORDER BY name`
  );
  const rulesRows = await query<{
    id: string; description: string; min_age: number; max_age: number; price: string;
  }>("SELECT id, description, min_age, max_age, price::text FROM pricing_rules ORDER BY min_age");
  const rules: PricingRule[] = rulesRows.map((rule) => ({
    id: rule.id,
    name: rule.description,
    description: rule.description,
    minAge: rule.min_age,
    maxAge: rule.max_age,
    price: Number(rule.price)
  }));
  const operational = await query<{ count: number }>(
    "SELECT COUNT(*)::int AS count FROM rooms WHERE status <> 'Manutenção'"
  );
  let availability: Array<{ category: string; roomsFree: number }> = [];
  let prices: Array<{ category: string; total: string }> = [];
  if (reading.checkIn && reading.checkOut && reading.adults) {
    const checkIn = hotelCivilDateToUtc(reading.checkIn, 0);
    const checkOut = hotelCivilDateToUtc(reading.checkOut, 0);
    if (checkIn && checkOut) {
      const rooms = await findAvailableRooms(checkIn, checkOut, reading.adults + reading.childrenAges.length);
      const roomsByCategory = new Map<string, number>();
      for (const room of rooms) roomsByCategory.set(room.category_id, (roomsByCategory.get(room.category_id) ?? 0) + 1);
      availability = categories
        .filter((category) => roomsByCategory.has(category.id))
        .map((category) => ({ category: category.name, roomsFree: roomsByCategory.get(category.id) ?? 0 }));
      const guests = pricingGuests(reading, rules);
      for (const category of categories.filter((item) => roomsByCategory.has(item.id))) {
        try {
          const pricing = calculateReservationPricing({
            checkInDate: reading.checkIn,
            checkOutDate: reading.checkOut,
            guests,
            pricingRules: rules,
            singlePrice: category.single_price ? Number(category.single_price) : null,
            couplePrice: category.couple_price ? Number(category.couple_price) : null,
            legacyDailyPrice: Number(category.price)
          });
          prices.push({ category: category.name, total: pricing.totalPrice.toFixed(2) });
        } catch {
          // A category without enough pricing data is omitted, never guessed.
        }
      }
    }
  }
  const reservations = contact[0]?.client_id
    ? await query<{
        id: string; status: string; room_number: number | null; category_name: string | null;
        check_in: string; check_out: string;
      }>(
        `SELECT r.id, r.status, rm.number AS room_number, category.name AS category_name,
                r.check_in_date::text AS check_in, r.check_out_date::text AS check_out
         FROM reservations r
         LEFT JOIN rooms rm ON rm.id = r.room_id
         LEFT JOIN categories category ON category.id = rm.category_id
         WHERE r.client_id = $1 AND r.status IN ('Pendente', 'Confirmada', 'EmAndamento')
         ORDER BY r.check_in_date ASC LIMIT 3`,
        [contact[0].client_id]
      )
    : [];
  const lastStay = contact[0]?.client_id
    ? await query<{ month: string }>(
      `SELECT to_char(check_in_date, 'YYYY-MM') AS month
       FROM reservations WHERE client_id = $1 AND status = 'Concluída'
       ORDER BY check_out_date DESC LIMIT 1`,
      [contact[0].client_id]
    )
    : [];
  return {
    hotelToday: formatHotelDate(new Date()),
    stay: {
      checkIn: reading.checkIn,
      checkOut: reading.checkOut,
      nights: reading.checkIn && reading.checkOut
        ? Math.max(0, Math.round((Date.parse(`${reading.checkOut}T00:00:00Z`) - Date.parse(`${reading.checkIn}T00:00:00Z`)) / 86_400_000))
        : null,
      adults: reading.adults,
      childrenAges: reading.childrenAges
    },
    availability,
    operationalRooms: operational[0]?.count ?? 0,
    prices: reading.adults ? prices : [],
    reservations: reservations.map((reservation) => ({
      code: reservation.id.slice(0, 8).toUpperCase(),
      status: reservation.status,
      room: reservation.room_number === null ? "" : String(reservation.room_number),
      category: reservation.category_name ?? "",
      checkIn: reservation.check_in,
      checkOut: reservation.check_out
    })),
    lastStay: lastStay[0]?.month ?? null
  };
}
