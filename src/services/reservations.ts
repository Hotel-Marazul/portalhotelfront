import apiClient from "@/service/api";
import {
  ReservationDto,
  ReservationsResponse,
  ReservationsFilters,
  UpdateReservationStatusDto,
  CreateReservationDto,
  UpdateReservationDto,
} from "@/types/reservations";

/**
 * Converte filtros em query string
 */
function buildQueryString(filters: ReservationsFilters): string {
  const params = new URLSearchParams();
  
  if (filters.page) params.append("page", filters.page.toString());
  if (filters.pageSize) params.append("pageSize", filters.pageSize.toString());
  if (filters.sortBy) params.append("sortBy", filters.sortBy);
  if (filters.sortDir) params.append("sortDir", filters.sortDir);
  if (filters.search) params.append("search", filters.search);
  if (filters.cpf) params.append("cpf", filters.cpf);
  if (filters.id) params.append("id", filters.id);
  if (filters.roomId) params.append("roomId", filters.roomId);
  if (filters.checkInFrom) params.append("checkInFrom", filters.checkInFrom);
  if (filters.checkInTo) params.append("checkInTo", filters.checkInTo);
  if (filters.checkOutFrom) params.append("checkOutFrom", filters.checkOutFrom);
  if (filters.checkOutTo) params.append("checkOutTo", filters.checkOutTo);
  
  // Status como array
  if (filters.status && filters.status.length > 0) {
    filters.status.forEach((status) => {
      params.append("status", status);
    });
  }
  
  return params.toString();
}

/**
 * Busca lista de reservas com filtros e paginação
 */
export async function getReservations(
  cpf: string = ""
): Promise<ReservationsResponse> {
  const url = `/api/Reservations/${cpf}`;
  
  const response = await apiClient.get<ReservationsResponse>(url);
  return response.data;
}

/**
 * Busca uma reserva por ID
 */
export async function getReservationById(id: string): Promise<ReservationDto> {
  const response = await apiClient.get<ReservationDto>(`/api/Reservations/${id}`);
  return response.data;
}

/**
 * Cria uma nova reserva
 */
export async function createReservation(
  data: CreateReservationDto
): Promise<ReservationDto> {
  const response = await apiClient.post<ReservationDto>("/api/Reservations", data);
  return response.data;
}

/**
 * Atualiza uma reserva
 */
export async function updateReservation(
  data: UpdateReservationDto
): Promise<ReservationDto> {
  const response = await apiClient.put<ReservationDto>(
    `/api/Reservations/${data.id}`,
    data
  );
  return response.data;
}

/**
 * Atualiza o status de uma reserva
 */
export async function updateReservationStatus(
  id: string,
  status: UpdateReservationStatusDto
): Promise<ReservationDto> {
  const response = await apiClient.patch<ReservationDto>(
    `/api/Reservations/${id}/status`,
    status
  );
  return response.data;
}

/**
 * Duplica uma reserva (cria nova com dados similares)
 */
export async function duplicateReservation(id: string): Promise<ReservationDto> {
  const reservation = await getReservationById(id);
  
  const newReservation: CreateReservationDto = {
    roomId: reservation.roomId,
    clientId: reservation.clientId,
    checkInDate: reservation.checkInDate,
    checkOutDate: reservation.checkOutDate,
    guests: reservation.guests.map((guest) => ({
      name: guest.name,
      age: guest.age,
      pricingRuleId: guest.pricingRuleId || null,
    })),
  };
  
  return createReservation(newReservation);
}

