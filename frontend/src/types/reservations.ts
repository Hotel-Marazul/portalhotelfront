export type ReservationStatus =
  | "Pendente"
  | "Confirmada"
  | "EmAndamento"
  | "Concluída"
  | "Concluida"
  | "Cancelada";

export type ReservationPaymentStage = "Confirmacao" | "CheckIn" | "CheckOut";
export type ReservationPaymentMethod = "Dinheiro" | "Pix" | "CartaoDebito" | "CartaoCredito";

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
    price?: number;
  };
}

export interface ReservationPaymentDto {
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

export interface ReservationPricingDto {
  rateType: "single" | "couple";
  dailyRate: number;
  priceSource: "catalog" | "manual";
  nights: number;
  additionalDailyTotal: number;
  subtotal: number;
  discountAmount: number;
  totalPrice: number;
  overrideReason?: string;
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
  totalPrice?: number | null;
  pricing?: ReservationPricingDto | null;
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
  payments?: ReservationPaymentDto[];
  totalPaid?: number;
  balanceDue?: number;
  financialException?: {
    type: "overpaid" | "invalid_total";
    amount: number;
  } | null;
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
  search?: string;
  status?: ReservationStatus[];
  roomId?: string;
  checkInFrom?: string;
  checkInTo?: string;
  checkOutFrom?: string;
  checkOutTo?: string;
}

export interface ReservationPaymentInput {
  stage: ReservationPaymentStage;
  method: ReservationPaymentMethod;
  amount: number;
  note?: string;
  idempotencyKey: string;
  correlationId?: string;
}

export interface UpdateReservationStatusDto {
  targetStatus: ReservationStatus;
  version: number;
  reason?: string;
  idempotencyKey?: string;
  correlationId?: string;
}

export interface CreateReservationDto {
  roomId: string;
  clientId: string;
  checkInDate: string;
  checkOutDate: string;
  status?: ReservationStatus;
  guests: Array<{
    name: string;
    age: number;
    pricingRuleId?: string | null;
  }>;
  dailyRateOverride?: number;
  discountAmount?: number;
  priceOverrideReason?: string;
  clearDailyRateOverride?: boolean;
  idempotencyKey: string;
  correlationId?: string;
}

export interface UpdateReservationDto extends Omit<CreateReservationDto, "idempotencyKey"> {
  id: string;
  version: number;
  idempotencyKey?: string;
  correlationId?: string;
}
