import { isAxiosError } from "axios";
import apiClient from "../services/api";

// Hóspede, quarto e categoria não são apagados: o gerente desativa e reativa.
export type DeactivatableKind = "client" | "room" | "category";

const BASE: Record<DeactivatableKind, string> = {
  client: "/api/clients",
  room: "/api/rooms",
  category: "/api/categories",
};

export async function deactivateRecord(kind: DeactivatableKind, id: string) {
  await apiClient.post(`${BASE[kind]}/${id}/deactivate`);
}

export async function reactivateRecord(kind: DeactivatableKind, id: string) {
  await apiClient.post(`${BASE[kind]}/${id}/reactivate`);
}

// O cadastro bateu num CPF, número ou nome de um registro desativado: devolve o id dele.
export function inactiveDuplicateId(error: unknown): string | null {
  if (!isAxiosError(error) || error.response?.status !== 409) return null;
  const details = error.response.data?.details;
  return details?.code === "inactive_duplicate" && typeof details.id === "string" ? details.id : null;
}
