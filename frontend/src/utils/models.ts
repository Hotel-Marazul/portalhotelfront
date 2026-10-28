export interface Room {
  displayNumber?: string;
  connectedRoomNumber?: number | null;
  id: string;
  number: number;
  type: string;
  capacity: number;
  price: number;
  status: string;
  categoryId: string;
  dailyPrice?: number;
  singlePrice?: number | null;
  couplePrice?: number | null;
  /** limpo, em_limpeza ou precisa_limpar; ausente em respostas que não trazem a limpeza. */
  housekeepingStatus?: string;
  housekeepingUpdatedAt?: string | null;
  /** Falso quando o gerente desativou o quarto. */
  active?: boolean;
}

export interface Client {
  id: string;
  fullName: string;
  cpf: string;
  email: string;
  automovel: string;
  placa: string;
  fone: string;
  /** Falso quando o gerente desativou o hóspede. */
  active?: boolean;
}

export interface Guest {
  id: string;
  name: string;
  age: number | null;
  pricingRuleId: string;
}

export interface Reservation {
  id: string;               // UUID
  status: string;
  checkInDate: string;      // formato ISO
  checkOutDate: string;     // formato ISO
  totalPrice: number;
  room: Room;
  client: Client;
  guests: Guest[];
}

export interface Category {
  halfBoardPrice?: number | null;
  rateValidFrom?: string | null;
  rateValidUntil?: string | null;
  id: string;
  name: string;
  price: number;
  singlePrice: number | null;
  couplePrice: number;
  roomsCount?: number;
  /** Falso quando o gerente desativou a categoria. */
  active?: boolean;
}

