export interface Room {
  id: string;
  number: number;
  type: string;
  capacity: number;
  price: number;
  status: string;
  categoryId: string;
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
  id: string;
  name: string;
  price: number;
  roomsCount?: number;
}


