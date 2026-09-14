/**
 * Formatação de valores para exibição
 */

import { parseReservationDate, toReservationCalendarDate } from "./reservation.ts";

/**
 * Formata número como moeda brasileira (BRL)
 */
export function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return "R$ 0,00";
  }
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

/**
 * Formata data para formato brasileiro (dd/MM/yyyy)
 */
export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return "-";
  
  const dateObj = parseReservationDate(date);
  
  if (isNaN(dateObj.getTime())) return "-";
  
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(dateObj);
}

/**
 * Formata data e hora para formato brasileiro (dd/MM/yyyy HH:mm)
 */
export function formatDateTime(date: string | Date | null | undefined): string {
  if (!date) return "-";
  
  const dateObj = parseReservationDate(date);
  
  if (isNaN(dateObj.getTime())) return "-";
  
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(dateObj);
}

/**
 * Calcula o número de noites entre duas datas
 */
export function calculateNights(checkIn: string | Date, checkOut: string | Date): number {
  const checkInDate = parseReservationDate(checkIn);
  const checkOutDate = parseReservationDate(checkOut);

  if (Number.isNaN(checkInDate.getTime()) || Number.isNaN(checkOutDate.getTime())) {
    return 0;
  }

  const [startYear, startMonth, startDate] = toReservationCalendarDate(checkIn).split("-").map(Number);
  const [endYear, endMonth, endDate] = toReservationCalendarDate(checkOut).split("-").map(Number);
  return Math.max(0, Math.round(
    (Date.UTC(endYear, endMonth - 1, endDate) - Date.UTC(startYear, startMonth - 1, startDate)) / 86_400_000
  ));
}

/**
 * Formata ID para exibição (primeiros 8 caracteres)
 */
export function formatReservationId(id: string): string {
  if (!id) return "-";
  return id.substring(0, 8).toUpperCase();
}
