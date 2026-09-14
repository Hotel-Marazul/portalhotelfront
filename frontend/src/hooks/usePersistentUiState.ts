"use client";

import { useEffect, useState } from "react";

/**
 * Keeps navigation preferences during the current browser session only.
 * Do not use this hook for guest, payment, document, or reservation-form data.
 */
export function usePersistentUiState<T>(
  key: string,
  initialValue: T,
  isValid: (value: unknown) => value is T,
) {
  const [value, setValue] = useState<T>(initialValue);
  const [restored, setRestored] = useState(false);

  useEffect(() => {
    try {
      const rawValue = window.sessionStorage.getItem(`portal-hotel:${key}`);
      if (!rawValue) return;

      const parsedValue: unknown = JSON.parse(rawValue);
      if (isValid(parsedValue)) setValue(parsedValue);
    } catch {
      // A malformed preference must never block the operational screen.
    } finally {
      setRestored(true);
    }
  }, [key, isValid]);

  useEffect(() => {
    if (!restored) return;
    window.sessionStorage.setItem(`portal-hotel:${key}`, JSON.stringify(value));
  }, [key, restored, value]);

  return [value, setValue] as const;
}
