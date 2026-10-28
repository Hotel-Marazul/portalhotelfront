// Regras puras da nova reserva e do cadastro de cliente, testadas em tests/nova-reserva-data.test.mjs.
import { validateCPF } from "../../utils/cpf.ts";

/* ---------- Cliente ---------- */

export interface ClientFormData {
  fullName: string;
  cpf: string;
  email: string;
  fone: string;
  automovel: string;
  placa: string;
}

export type ClientFormMode = "adicionar" | "editar";
export type ClientFormErrors = Partial<Record<keyof ClientFormData, string>>;

export const emptyClientForm: ClientFormData = { fullName: "", cpf: "", email: "", fone: "", automovel: "", placa: "" };

/** CPF (000.000.000-00) ou CNPJ (00.000.000/0000-00) enquanto se digita. CPF mascarado pelo backend fica como veio. */
export function formatDocument(value: string): string {
  if (value.includes("*")) return value;
  const digits = value.replace(/\D/g, "");
  if (digits.length <= 11) {
    return digits
      .replace(/^(\d{3})(\d)/, "$1.$2")
      .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/\.(\d{3})(\d)/, ".$1-$2")
      .slice(0, 14);
  }
  return digits
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2")
    .slice(0, 18);
}

// Na edição, o CPF vazio ou mascarado não é enviado: o backend mantém o que tem.
const keepsStoredCpf = (cpf: string, mode: ClientFormMode) => mode === "editar" && (cpf.includes("*") || !cpf.trim());

/** As mesmas regras do `clientBodySchema` do backend: para reservar bastam nome e telefone. */
export function validateClientForm(form: ClientFormData, mode: ClientFormMode = "adicionar"): ClientFormErrors {
  const errors: ClientFormErrors = {};
  if (form.fullName.trim().length < 3) errors.fullName = "Informe o nome completo.";
  if (form.fone.trim().length < 8) errors.fone = "Informe um telefone com DDD.";
  const cpf = form.cpf.replace(/\D/g, "");
  if (!keepsStoredCpf(form.cpf, mode) && cpf && !validateCPF(cpf)) errors.cpf = "CPF inválido.";
  const email = form.email.trim();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = "E-mail inválido.";
  return errors;
}

export function clientPayload(form: ClientFormData, mode: ClientFormMode = "adicionar") {
  const { cpf, ...fields } = form;
  return {
    ...fields,
    fullName: fields.fullName.trim(),
    fone: fields.fone.trim(),
    email: fields.email.trim(),
    ...(keepsStoredCpf(cpf, mode) ? {} : { cpf: cpf.replace(/\D/g, "") }),
  };
}

/* ---------- Pessoas ---------- */

export interface Companion {
  kind: "adult" | "child";
  name: string;
  age: number;
  pricingRuleId: string | null;
}

export interface ReservationGuestInput {
  name: string;
  age: number;
  pricingRuleId: string | null;
}

// Idade usada para acompanhante adulto, como a disponibilidade já faz no backend.
export const ADULT_AGE = 18;
// O primeiro acompanhante completa o casal; os seguintes são cobrados pela regra de idade.
export const INCLUDED_COMPANIONS = 1;

/** Adultos primeiro: assim o acompanhante incluído é um adulto, e as crianças pagam pela idade. */
export function orderCompanions(companions: Companion[]): Companion[] {
  return [...companions.filter((c) => c.kind === "adult"), ...companions.filter((c) => c.kind === "child")];
}

export function companionDefaultName(companion: Companion, position: number): string {
  return companion.kind === "adult" ? `Acompanhante ${position}` : `Criança ${position} (${companion.age} anos)`;
}

/** Nomes pendentes ficam vazios; os rótulos visuais não viram identificação do hóspede. */
export function buildGuests(companions: Companion[]): ReservationGuestInput[] {
  return orderCompanions(companions).map((companion) => {
    const name = companion.name.trim();
    return {
      name,
      age: companion.kind === "adult" ? ADULT_AGE : companion.age,
      pricingRuleId: companion.pricingRuleId || null,
    };
  });
}

/** "2 adultos + criança (4)" / "1 adulto + 2 crianças (4 e 7)". O cliente conta como adulto. */
export function peopleSummary(companions: Companion[]): string {
  const adults = 1 + companions.filter((c) => c.kind === "adult").length;
  const ages = companions.filter((c) => c.kind === "child").map((c) => c.age);
  const adultText = `${adults} ${adults === 1 ? "adulto" : "adultos"}`;
  if (ages.length === 0) return adultText;
  const agesText = ages.length === 1 ? String(ages[0]) : `${ages.slice(0, -1).join(", ")} e ${ages[ages.length - 1]}`;
  return `${adultText} + ${ages.length === 1 ? "criança" : `${ages.length} crianças`} (${agesText})`;
}

/* ---------- Quartos ---------- */

export interface AvailableRoom {
  id: string;
  number: number;
  displayNumber?: string;
  type: string;
  capacity: number;
  categoryId?: string;
  couplePrice?: number | null;
  price?: number;
}

export interface RoomGroup {
  key: string;
  name: string;
  couplePrice: number | null;
  rooms: AvailableRoom[];
}

export const roomLabel = (room: AvailableRoom) => room.displayNumber ?? String(room.number);

/**
 * Agrupa os quartos livres por categoria e separa os que não comportam o grupo,
 * pelo mesmo critério do backend (`capacity >= guestCount`).
 */
export function groupRooms(rooms: AvailableRoom[], guestCount: number, categoryNames: Record<string, string> = {}) {
  const fits = rooms.filter((room) => room.capacity >= guestCount);
  const excluded = rooms.filter((room) => room.capacity < guestCount).sort((a, b) => a.number - b.number);
  const groups = new Map<string, RoomGroup>();
  for (const room of [...fits].sort((a, b) => a.number - b.number)) {
    const key = room.categoryId ?? room.type;
    const group = groups.get(key) ?? {
      key,
      name: (room.categoryId && categoryNames[room.categoryId]) || room.type,
      couplePrice: room.couplePrice ?? room.price ?? null,
      rooms: [],
    };
    group.rooms.push(room);
    groups.set(key, group);
  }
  return {
    groups: [...groups.values()].sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
    excluded,
  };
}

const joinPt = (items: string[]) => items.length === 1 ? items[0] : `${items.slice(0, -1).join(", ")} e ${items[items.length - 1]}`;

/** "O 102 não aparece porque comporta só 2 pessoas." — uma frase por capacidade. */
export function excludedRoomsMessage(excluded: AvailableRoom[]): string {
  const byCapacity = new Map<number, AvailableRoom[]>();
  for (const room of excluded) byCapacity.set(room.capacity, [...(byCapacity.get(room.capacity) ?? []), room]);
  return [...byCapacity.entries()]
    .sort(([a], [b]) => a - b)
    .map(([capacity, rooms]) => {
      const people = `${capacity} ${capacity === 1 ? "pessoa" : "pessoas"}`;
      return rooms.length === 1
        ? `O ${roomLabel(rooms[0])} não aparece porque comporta só ${people}.`
        : `Os quartos ${joinPt(rooms.map(roomLabel))} não aparecem porque comportam só ${people}.`;
    })
    .join(" ");
}

/* ---------- Preço e período ---------- */

export interface PriceAdjustment {
  dailyRateOverride: string;
  discountAmount: string;
  priceOverrideReason: string;
}

export const hasPriceAdjustment = (adjustment: PriceAdjustment) =>
  adjustment.dailyRateOverride.trim() !== "" || Number(adjustment.discountAmount.replace(",", ".")) > 0;

const toAmount = (value: string) => value.trim() ? Number(value.trim().replace(",", ".")) : undefined;

/** Campos do ajuste já convertidos, ou a mensagem do primeiro erro. */
export function parsePriceAdjustment(adjustment: PriceAdjustment):
  | { error: string }
  | { error: null; dailyRateOverride?: number; discountAmount?: number; priceOverrideReason?: string } {
  const dailyRateOverride = toAmount(adjustment.dailyRateOverride);
  const discountAmount = toAmount(adjustment.discountAmount);
  if (dailyRateOverride !== undefined && (!Number.isFinite(dailyRateOverride) || dailyRateOverride <= 0)) {
    return { error: "Informe uma diária válida." };
  }
  if (discountAmount !== undefined && (!Number.isFinite(discountAmount) || discountAmount < 0)) {
    return { error: "Informe um desconto válido." };
  }
  const reason = adjustment.priceOverrideReason.trim();
  if ((dailyRateOverride !== undefined || (discountAmount ?? 0) > 0) && !reason) {
    return { error: "Informe o motivo do ajuste manual de preço." };
  }
  if (reason && reason.length < 3) return { error: "O motivo do ajuste precisa de pelo menos 3 letras." };
  return {
    error: null,
    ...(dailyRateOverride !== undefined ? { dailyRateOverride } : {}),
    ...(discountAmount !== undefined ? { discountAmount } : {}),
    ...(reason ? { priceOverrideReason: reason } : {}),
  };
}

/** Datas no formato AAAA-MM-DD do calendário do hotel. */
export function periodError(checkIn: string | null, checkOut: string | null): string | null {
  if (!checkIn || !checkOut) return null;
  return checkOut <= checkIn ? "O check-out deve ser posterior ao check-in." : null;
}
