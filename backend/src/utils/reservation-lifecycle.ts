import { ReservationStatus } from "../domain/models.js";

const transitionTargets: Record<ReservationStatus, readonly ReservationStatus[]> = {
  Pendente: ["Confirmada", "Cancelada"],
  Confirmada: ["EmAndamento", "Cancelada"],
  EmAndamento: ["Concluída"],
  Concluída: [],
  Cancelada: []
};

export function normalizeReservationStatus(status: string): ReservationStatus | null {
  if (status === "Concluida") return "Concluída";
  return ["Pendente", "Confirmada", "EmAndamento", "Concluída", "Cancelada"].includes(status)
    ? status as ReservationStatus
    : null;
}

export function canTransitionReservation(
  current: ReservationStatus,
  target: ReservationStatus
): boolean {
  return transitionTargets[current].includes(target);
}

export function isOverdueReservation(status: ReservationStatus, checkOutDate: Date, now = new Date()): boolean {
  return (status === "Pendente" || status === "Confirmada") && checkOutDate.getTime() < now.getTime();
}

export function transitionTimingError(
  target: ReservationStatus,
  checkInDate: Date,
  checkOutDate: Date,
  now = new Date()
): string | null {
  if (target !== "EmAndamento") return null;
  if (now.getTime() < checkInDate.getTime()) {
    return "A hospedagem só pode começar a partir do check-in.";
  }
  if (now.getTime() >= checkOutDate.getTime()) {
    return "A hospedagem não pode começar após o check-out.";
  }
  return null;
}

export const RESERVATION_TRANSITIONS = transitionTargets;
