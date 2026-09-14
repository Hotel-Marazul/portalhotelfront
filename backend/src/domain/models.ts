export type RoomStatus = "Dispon\u00edvel" | "Manuten\u00e7\u00e3o";
export type ReservationStatus = "Pendente" | "Confirmada" | "EmAndamento" | "Conclu\u00edda" | "Cancelada";
export type ReservationPaymentStage = "Confirmacao" | "CheckIn" | "CheckOut";
export type ReservationPaymentMethod = "Dinheiro" | "Pix" | "CartaoDebito" | "CartaoCredito";

export interface User {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: "admin" | "manager";
}

export interface Category {
  id: string;
  name: string;
  price: number;
  singlePrice: number | null;
  couplePrice: number;
}

export interface Room {
  id: string;
  number: number;
  type: string;
  capacity: number;
  dailyPrice: number;
  status: RoomStatus;
  categoryId: string;
}

export interface Client {
  id: string;
  fullName: string;
  cpf: string;
  email: string;
  fone: string;
  automovel: string;
  placa: string;
}

export interface PricingRule {
  id: string;
  name: string;
  description: string;
  minAge: number;
  maxAge: number;
  price: number;
}

export interface ReservationGuest {
  id: string;
  reservationId: string;
  name: string;
  age: number;
  pricingRuleId: string | null;
}

export interface ReservationPayment {
  id: string;
  reservationId: string;
  stage: ReservationPaymentStage;
  method: ReservationPaymentMethod;
  amount: number;
  note: string;
  entryType?: "payment" | "reversal";
  idempotencyKey?: string | null;
  reversedPaymentId?: string | null;
  createdAt: string;
}

export interface Reservation {
  id: string;
  roomId: string;
  clientId: string;
  checkInDate: string;
  checkOutDate: string;
  status: ReservationStatus;
  version: number;
  createdAt?: string;
  updatedAt?: string;
  audit?: {
    action: string;
    actorType: "user" | "agents-service" | "system" | null;
    occurredAt: string | null;
  };
  totalPrice: number;
  pricing?: {
    rateType: "single" | "couple";
    dailyRate: number;
    priceSource: "catalog" | "manual";
    nights: number;
    additionalDailyTotal: number;
    subtotal: number;
    discountAmount: number;
    totalPrice: number;
    overrideReason?: string;
  } | null;
  guests: ReservationGuest[];
  payments?: ReservationPayment[];
  totalPaid?: number;
  balanceDue?: number;
  financialException?: {
    type: "overpaid" | "invalid_total";
    amount: number;
  } | null;
}
