export const ACTIVE_RESERVATION_STATUSES = ["Pendente", "Confirmada", "EmAndamento"];

// Toda estadia que nao foi cancelada preserva a ocupacao historica do quarto.
export const BLOCKING_RESERVATION_STATUSES = [
  ...ACTIVE_RESERVATION_STATUSES,
  "Concluída"
];

export function isActiveReservationStatus(status: string) {
  return ACTIVE_RESERVATION_STATUSES.includes(status);
}

