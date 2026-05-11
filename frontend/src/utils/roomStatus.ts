export type OperationalRoomStatus = "Disponivel" | "Manutencao";
export type OperationalRoomStatusFilter = "Todos" | OperationalRoomStatus;

export function normalizeOperationalRoomStatus(status: string): OperationalRoomStatus {
  const normalized = status
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  if (normalized.includes("manuten")) {
    return "Manutencao";
  }

  return "Disponivel";
}

export function toApiRoomStatus(status: OperationalRoomStatus): string {
  return status === "Manutencao" ? "Manuten\u00e7\u00e3o" : "Dispon\u00edvel";
}

export function roomStatusLabel(status: OperationalRoomStatus): string {
  return status === "Manutencao" ? "Manutencao" : "Disponivel";
}
