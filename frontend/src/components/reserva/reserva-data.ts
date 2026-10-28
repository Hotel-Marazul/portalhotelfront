// Regras puras da reserva aberta, testadas em tests/reserva-data.test.mjs.

export type StepState = "done" | "current" | "todo";
export type PaymentStage = "Confirmacao" | "CheckIn" | "CheckOut";
export type PaymentMethod = "Dinheiro" | "Pix" | "CartaoDebito" | "CartaoCredito";

export const PAYMENT_STAGE_LABELS: Record<PaymentStage, string> = {
  Confirmacao: "Confirmação",
  CheckIn: "Check-in",
  CheckOut: "Check-out",
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  Dinheiro: "Dinheiro",
  Pix: "Pix",
  CartaoDebito: "Cartão de débito",
  CartaoCredito: "Cartão de crédito",
};

/** O primeiro acompanhante completa a tarifa de casal; do segundo em diante, vale a regra por idade. */
export const INCLUDED_ADDITIONAL_GUESTS = 1;

const STEPS = ["Pendente", "Confirmada", "Hospedada", "Concluída"];

function stepIndex(status: string): number {
  switch (status) {
    case "Pendente": return 0;
    case "Confirmada": return 1;
    case "EmAndamento": return 2;
    case "Concluída":
    case "Concluida": return 3;
    default: return -1;
  }
}

export const isClosed = (status: string) => status === "Cancelada" || status === "Concluída" || status === "Concluida";

/** Faixa de andamento. Cancelada não tem passo atual: a faixa fica toda apagada. */
export function progressSteps(status: string): Array<{ label: string; state: StepState }> {
  const current = stepIndex(status);
  return STEPS.map((label, index) => ({
    label,
    state: current < 0 ? "todo" : index < current ? "done" : index === current ? "current" : "todo",
  }));
}

export interface NextStep {
  target: "Confirmada" | "EmAndamento" | "Concluída";
  label: string;
}

export function nextStep(status: string): NextStep | null {
  switch (status) {
    case "Pendente": return { target: "Confirmada", label: "Confirmar reserva" };
    case "Confirmada": return { target: "EmAndamento", label: "Iniciar hospedagem" };
    case "EmAndamento": return { target: "Concluída", label: "Concluir hospedagem" };
    default: return null;
  }
}

/** O backend só cancela Pendente ou Confirmada. */
export const canCancel = (status: string) => status === "Pendente" || status === "Confirmada";

/** Canceladas e concluídas não podem ser editadas (o backend responde 409). */
export const canEdit = (status: string) => !isClosed(status);

interface FinancialLike {
  totalPrice?: number | null;
  totalPaid?: number | null;
  balanceDue?: number | null;
}

/**
 * Total, pago e saldo como o backend calculou. Sem os agregados (lista, ou falha ao carregar o detalhe),
 * devolve null: o navegador não soma pagamentos nem mostra zero no lugar de um dado que não veio.
 */
export function financialSummary(detail: FinancialLike | null | undefined) {
  if (!detail || typeof detail.totalPaid !== "number" || typeof detail.balanceDue !== "number") return null;
  return { total: detail.totalPrice ?? 0, paid: detail.totalPaid, balance: detail.balanceDue };
}

/** Concluir só pede confirmação quando o saldo é conhecido e maior que zero. */
export function needsBalanceWarning(status: string, balance: number | null | undefined): boolean {
  return status === "EmAndamento" && typeof balance === "number" && balance > 0;
}

/** Etapa sugerida para o próximo recebimento, pelo andamento da reserva. */
export function defaultPaymentStage(status: string): PaymentStage {
  if (status === "Confirmada") return "CheckIn";
  if (status === "EmAndamento" || status === "Concluída" || status === "Concluida") return "CheckOut";
  return "Confirmacao";
}

interface PaymentLike {
  id: string;
  amount: number;
  entryType?: "payment" | "reversal";
  reversedPaymentId?: string | null;
}

const toCents = (value: number) => Math.round(value * 100);

/** Quanto de um pagamento ainda pode ser estornado. Estornos vêm com valor negativo. */
export function reversibleAmount(payment: PaymentLike, payments: PaymentLike[]): number {
  if (payment.entryType === "reversal") return 0;
  const reversed = payments
    .filter((entry) => entry.entryType === "reversal" && entry.reversedPaymentId === payment.id)
    .reduce((sum, entry) => sum + Math.abs(toCents(entry.amount)), 0);
  return Math.max(0, toCents(payment.amount) - reversed) / 100;
}

/** Converte "1.240,50", "1240.50" ou "1240,5" em número; devolve NaN se não for valor. */
export function parseMoneyInput(raw: string): number {
  const text = raw.trim().replace(/\s|R\$/g, "");
  if (!text) return Number.NaN;
  const normalized = text.includes(",") ? text.replace(/\./g, "").replace(",", ".") : text;
  return /^\d+(\.\d{1,2})?$/.test(normalized) ? Number(normalized) : Number.NaN;
}

export function validatePaymentAmount(raw: string): string | null {
  const amount = parseMoneyInput(raw);
  return Number.isFinite(amount) && amount > 0 ? null : "Informe um valor válido para o pagamento";
}

export function validateReversal(raw: string, reason: string, remaining: number): string | null {
  const amount = parseMoneyInput(raw);
  if (!Number.isFinite(amount) || amount <= 0) return "Informe um valor válido para o estorno.";
  if (toCents(amount) > toCents(remaining)) return "O estorno não pode passar do valor ainda estornável do pagamento.";
  if (reason.trim().length < 3) return "Informe o motivo do estorno.";
  return null;
}

export interface EditForm {
  checkIn: Date | null;
  checkOut: Date | null;
  guests: Array<{ name: string; age: number }>;
  dailyRateOverride: string;
  discountAmount: string;
  priceOverrideReason: string;
  hadPricing: boolean;
}

/** As mesmas validações e mensagens da edição anterior, na mesma ordem. */
export function validateReservationEdit(form: EditForm):
  | { error: string }
  | { dailyRate: number | undefined; discount: number | undefined } {
  if (!form.checkIn || !form.checkOut) return { error: "Preencha as datas de check-in e check-out" };
  if (form.checkOut <= form.checkIn) return { error: "A data de check-out deve ser posterior à data de check-in" };
  for (const guest of form.guests) {
    if (!guest.name || guest.age < 0) return { error: "Preencha todos os dados dos hóspedes" };
  }
  const dailyRate = form.dailyRateOverride.trim() ? Number(form.dailyRateOverride) : undefined;
  const discount = form.discountAmount.trim() ? Number(form.discountAmount) : form.hadPricing ? 0 : undefined;
  if (dailyRate !== undefined && (!Number.isFinite(dailyRate) || dailyRate <= 0)) return { error: "Informe uma diária válida." };
  if (discount !== undefined && (!Number.isFinite(discount) || discount < 0)) return { error: "Informe um desconto válido." };
  if ((dailyRate !== undefined || (discount ?? 0) > 0) && !form.priceOverrideReason.trim()) {
    return { error: "Informe o motivo do ajuste manual de preço." };
  }
  return { dailyRate, discount };
}

interface PricingLike {
  rateType: "single" | "couple";
  dailyRate: number;
  priceSource: "catalog" | "manual";
  nights: number;
  additionalDailyTotal: number;
  additionalStayTotal?: number;
  discountAmount: number;
  totalPrice?: number;
}

export interface PriceLine {
  label: string;
  /** null vira "—": o valor existe e é zero. */
  value: number | null;
  adjusted?: boolean;
}

/** Linhas do preço detalhado. O total vem do backend; nada é recalculado aqui. */
export function priceLines(pricing: PricingLike): PriceLine[] {
  const nonZero = (value: number | undefined) => (value && value !== 0 ? value : null);
  return [
    {
      label: `${pricing.nights} ${pricing.nights === 1 ? "diária" : "diárias"} · ${pricing.rateType === "single" ? "solteiro" : "casal"}`,
      value: pricing.dailyRate * pricing.nights,
      adjusted: pricing.priceSource === "manual",
    },
    { label: "Taxas únicas", value: nonZero(pricing.additionalStayTotal) },
    { label: "Adicionais por diária", value: nonZero(pricing.additionalDailyTotal) },
    { label: "Desconto", value: pricing.discountAmount > 0 ? -pricing.discountAmount : null },
  ];
}

const AUDIT_ACTIONS: Record<string, string> = {
  created: "Reserva criada",
  updated: "Reserva alterada",
  status_transition: "Andamento da reserva alterado",
  cancelled: "Reserva cancelada",
  payment_recorded: "Pagamento registrado",
  payment_reversed: "Pagamento estornado",
};

const AUDIT_ACTORS: Record<string, string> = {
  user: "Equipe, pelo portal",
  "agents-service": "Agente do WhatsApp",
  system: "Sistema",
};

export function auditEntry(audit: { action: string; actorType: string | null; occurredAt: string | null } | null | undefined) {
  if (!audit) return null;
  return {
    text: AUDIT_ACTIONS[audit.action] ?? audit.action,
    actor: audit.actorType ? AUDIT_ACTORS[audit.actorType] ?? null : null,
    occurredAt: audit.occurredAt,
  };
}
