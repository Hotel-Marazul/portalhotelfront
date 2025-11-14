export type ReservationStatus = "Pendente" | "Confirmada" | "EmAndamento" | "Concluída" | "Cancelada";

export interface GuestForm {
  id?: string;
  name: string;
  age: number;
  pricingRuleId: string | null;
}

export interface ReservationGuestDto {
  id: string;
  reservationId: string;
  name: string;
  age: number;
  pricingRuleId?: string | null;
  pricingRule?: {
    id: string;
    name: string;
    description?: string;
  };
}

export interface PricingRule {
  id: string;
  name: string;
  description?: string;
  price: number;
  minAge?: number;
  maxAge?: number;
}


export interface ReservationDto {
  id: string;
  roomId: string;
  clientId: string;
  checkInDate: string; // ISO
  checkOutDate: string; // ISO
  status: ReservationStatus;
  totalPrice?: number | null;
  room?: {
    id: string;
    name?: string;
    number?: number;
    type?: string;
    dailyPrice?: number | null;
  };
  client?: {
    id: string;
    name: string;
    fullName?: string;
    cpf: string;
  };
  guests: ReservationGuestDto[];
}

export interface ReservationsResponse {
  items: ReservationDto[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ReservationsFilters {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortDir?: "asc" | "desc";
  search?: string; // Nome do cliente
  cpf?: string;
  id?: string; // ID da reserva
  status?: ReservationStatus[];
  roomId?: string;
  checkInFrom?: string; // ISO date
  checkInTo?: string; // ISO date
  checkOutFrom?: string; // ISO date
  checkOutTo?: string; // ISO date
}

export interface UpdateReservationStatusDto {
  status: ReservationStatus;
}

export interface CreateReservationDto {
  roomId: string;
  clientId: string;
  checkInDate: string; // ISO
  checkOutDate: string; // ISO
  status?: ReservationStatus;
  guests: Array<{
    name: string;
    age: number;
    pricingRuleId?: string | null;
  }>;
}

export interface UpdateReservationDto extends CreateReservationDto {
  id: string;
}

