import apiClient from "../../services/api";
import type { Room } from "../../utils/models";
import { normalizeOperationalRoomStatus, toApiRoomStatus, type OperationalRoomStatus } from "../../utils/roomStatus";
import type { HousekeepingStatus } from "./housekeeping";

// O backend responde o status com acento; a tela trabalha com o status normalizado.
export const normalizeRoom = (room: Room): Room => ({ ...room, status: normalizeOperationalRoomStatus(room.status) });

export async function createRoom(body: { number: number; categoryId: string; capacity: number; status: OperationalRoomStatus }) {
  const response = await apiClient.post<Room>("/api/Rooms", {
    roomNumber: body.number,
    categoryId: body.categoryId,
    capacity: body.capacity,
    status: toApiRoomStatus(body.status),
  });
  return normalizeRoom(response.data);
}

// Mesmo PUT da edição; a manutenção liga e desliga por aqui também.
export async function updateRoom(room: Pick<Room, "id" | "number" | "categoryId" | "capacity" | "status">) {
  const response = await apiClient.put<Room>(`/api/Rooms/update/${room.id}`, {
    roomNumber: room.number,
    categoryId: room.categoryId,
    capacity: room.capacity,
    status: toApiRoomStatus(normalizeOperationalRoomStatus(room.status)),
  });
  return normalizeRoom(response.data);
}

export async function deleteRoom(id: string) {
  await apiClient.delete(`/api/Rooms/delete/${id}`);
}

// Recepção e gerente trocam a limpeza; a resposta traz só o estado novo.
export async function updateHousekeeping(id: string, status: HousekeepingStatus) {
  const response = await apiClient.patch<{ id: string; housekeepingStatus: HousekeepingStatus; housekeepingUpdatedAt: string }>(
    `/api/rooms/${id}/housekeeping`,
    { status },
  );
  return response.data;
}
