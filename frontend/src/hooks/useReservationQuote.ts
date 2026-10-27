"use client";

import { useEffect, useState } from "react";
import apiClient from "../services/api";
import { apiErrorMessage } from "../utils/api-error";
import type { ReservationPricingDto } from "../types/reservations";
import { reservationQuoteKey, type ReservationQuoteInput } from "../utils/reservation";

/** The key also hides stale totals during a change, before the effect runs. */
export function useReservationQuote(input: ReservationQuoteInput | null) {
  const key = reservationQuoteKey(input);
  const [result, setResult] = useState<{ key: string; pricing: ReservationPricingDto | null; error: string | null }>({ key: "", pricing: null, error: null });
  useEffect(() => {
    if (!key) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      apiClient.post<{ pricing: ReservationPricingDto }>("/api/reservations/quote", JSON.parse(key), { signal: controller.signal })
        .then(({ data }) => { if (!controller.signal.aborted) setResult({ key, pricing: data.pricing, error: null }); })
        .catch((error: unknown) => {
          if (!controller.signal.aborted) setResult({ key, pricing: null, error: apiErrorMessage(error, "Não foi possível calcular a reserva.") });
        });
    }, 300);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [key]);
  return {
    pricing: key && result.key === key ? result.pricing : null,
    error: key && result.key === key ? result.error : null,
    pending: Boolean(key && result.key !== key)
  };
}
