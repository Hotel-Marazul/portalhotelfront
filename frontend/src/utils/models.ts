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
}

export interface Client {
  id: string;
  fullName: string;
  cpf: string;
  email: string;
  automovel: string;
  placa: string;
  fone: string;
}

export interface Guest {
  id: string;
  name: string;
  age: number;
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
}

