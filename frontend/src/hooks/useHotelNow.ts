"use client";

import { useEffect, useState } from "react";

const HOTEL_TIMEZONE = "America/Sao_Paulo";

/** Hora atual, atualizada a cada 30 s. Nula até montar, para o HTML pré-renderizado não divergir. */
export function useHotelNow(): Date | null {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

export function hotelHour(date: Date): number {
  return Number(new Intl.DateTimeFormat("pt-BR", { timeZone: HOTEL_TIMEZONE, hour: "2-digit", hourCycle: "h23" }).format(date));
}

export function greetingFor(date: Date): string {
  const hour = hotelHour(date);
  return hour >= 5 && hour < 12 ? "Bom dia" : hour >= 12 && hour < 18 ? "Boa tarde" : "Boa noite";
}

/** "Terça, 27 de outubro · 10:40" */
export function formatHotelDateTime(date: Date): string {
  const weekday = new Intl.DateTimeFormat("pt-BR", { timeZone: HOTEL_TIMEZONE, weekday: "long" }).format(date).replace("-feira", "");
  const day = new Intl.DateTimeFormat("pt-BR", { timeZone: HOTEL_TIMEZONE, day: "numeric", month: "long" }).format(date);
  const time = new Intl.DateTimeFormat("pt-BR", { timeZone: HOTEL_TIMEZONE, hour: "2-digit", minute: "2-digit" }).format(date);
  return `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)}, ${day} · ${time}`;
}
