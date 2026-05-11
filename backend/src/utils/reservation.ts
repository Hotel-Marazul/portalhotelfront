import { PricingRule, ReservationGuest } from "../domain/models.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const INCLUDED_ADDITIONAL_GUESTS = 1;

export function calculateNights(checkInDate: string, checkOutDate: string): number {
  const start = new Date(checkInDate).getTime();
  const end = new Date(checkOutDate).getTime();
  return Math.max(1, Math.ceil((end - start) / DAY_MS));
}

export function calculateReservationTotal(
  dailyPrice: number,
  checkInDate: string,
  checkOutDate: string,
  guests: ReservationGuest[],
  pricingRules: PricingRule[]
): number {
  const nights = calculateNights(checkInDate, checkOutDate);
  const base = dailyPrice * nights;

  const extras = guests.reduce((acc, guest, index) => {
    if (index < INCLUDED_ADDITIONAL_GUESTS || !guest.pricingRuleId) {
      return acc;
    }
    const rule = pricingRules.find((item) => item.id === guest.pricingRuleId);
    if (!rule) {
      return acc;
    }
    return acc + rule.price * nights;
  }, 0);

  return Number((base + extras).toFixed(2));
}
