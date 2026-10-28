// Regras puras de Categorias e tarifas, testadas em tests/tarifas-data.test.mjs.

/**
 * Nenhuma rota expõe estes valores. Iguais a HOTEL_CHECK_IN_HOUR e
 * HOTEL_CHECK_OUT_HOUR de backend/src/utils/reservation.ts.
 */
export const HOTEL_STAY_RULES = { checkIn: "14:00", checkOut: "12:00", minimumStay: "Nenhuma" } as const;

export interface CategoryLike {
  id: string;
  name: string;
  price: number;
  couplePrice?: number | null;
  halfBoardPrice?: number | null;
  rateValidFrom?: string | null;
  rateValidUntil?: string | null;
}

export interface RoomLike {
  number: number;
  displayNumber?: string;
  connectedRoomNumber?: number | null;
  capacity: number;
  status: string;
  categoryId: string;
}

export interface PricingRuleLike {
  minAge: number;
  maxAge: number;
  price: number;
  billingBasis?: "per_daily" | "per_stay";
}

/** Resposta de GET /api/pricing-rules. */
export interface PricingRuleDto extends PricingRuleLike {
  id: string;
  name: string;
  description?: string;
}

const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** "R$ 528" sem centavos quando o valor é inteiro; "R$ 528,50" quando não. */
export function formatRate(value: number): string {
  const cents = !Number.isInteger(value);
  const text = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: cents ? 2 : 0, maximumFractionDigits: 2 }).format(value);
  return `R$ ${text}`;
}

/** Tarifa de casal da categoria; `price` é o nome antigo do mesmo valor. */
export function couplePriceOf(category: CategoryLike): number {
  return category.couplePrice ?? category.price;
}

/** Da diária mais cara para a mais barata, como o hotel lê a tabela. */
export function sortCategories<T extends CategoryLike>(categories: T[]): T[] {
  return [...categories].sort((a, b) => couplePriceOf(b) - couplePriceOf(a) || a.name.localeCompare(b.name, "pt-BR"));
}

const isMaintenance = (status: string) => status.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase() === "manutencao";

const unitLabel = (room: RoomLike) => room.displayNumber ?? (room.connectedRoomNumber ? `${room.number}/${room.connectedRoomNumber}` : String(room.number));

/**
 * "201 a 205" quando a lista é uma sequência só; senão sequências de três ou
 * mais viram "117–120". Unidade conjugada (115/116) não entra em sequência.
 */
export function formatUnitNumbers(rooms: RoomLike[]): string {
  const sorted = [...rooms].sort((a, b) => a.number - b.number);
  const runs: RoomLike[][] = [];
  for (const room of sorted) {
    const run = runs[runs.length - 1];
    const last = run?.[run.length - 1];
    if (last && !last.connectedRoomNumber && !room.connectedRoomNumber && room.number === last.number + 1) run.push(room);
    else runs.push([room]);
  }
  if (runs.length === 1 && runs[0].length >= 3) return `${runs[0][0].number} a ${runs[0][runs[0].length - 1].number}`;
  return runs
    .flatMap((run) => (run.length >= 3 ? [`${run[0].number}–${run[run.length - 1].number}`] : run.map(unitLabel)))
    .join(", ");
}

const people = (n: number) => `${n} ${n === 1 ? "pessoa" : "pessoas"}`;

/** "até 4 pessoas"; com exceções, "102 até 2 · demais até 4" ou "até 4 · 115/116 até 5". */
export function formatCapacity(rooms: RoomLike[]): string {
  if (rooms.length === 0) return "";
  const counts = new Map<number, number>();
  rooms.forEach((room) => counts.set(room.capacity, (counts.get(room.capacity) ?? 0) + 1));
  const usual = [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0][0];
  if (counts.size === 1) return `até ${people(usual)}`;

  const exceptions = (lower: boolean) =>
    [...counts.keys()]
      .filter((capacity) => (lower ? capacity < usual : capacity > usual))
      .sort((a, b) => a - b)
      .map((capacity) => `${formatUnitNumbers(rooms.filter((room) => room.capacity === capacity))} até ${capacity}`);
  const below = exceptions(true);
  const above = exceptions(false);
  return [...below, below.length ? `demais até ${usual}` : `até ${usual}`, ...above].join(" · ");
}

export interface CategoryUnits {
  /** Unidades reserváveis: fora de manutenção. */
  count: number;
  numbers: string;
  capacity: string;
  maintenance: string;
}

export function categoryUnits(rooms: RoomLike[], categoryId: string): CategoryUnits {
  const all = rooms.filter((room) => room.categoryId === categoryId);
  const bookable = all.filter((room) => !isMaintenance(room.status));
  const resting = all.filter((room) => isMaintenance(room.status));
  return {
    count: bookable.length,
    numbers: formatUnitNumbers(bookable),
    capacity: formatCapacity(bookable.length ? bookable : all),
    maintenance: formatUnitNumbers(resting),
  };
}

export function bookableUnitCount(rooms: RoomLike[]): number {
  return rooms.filter((room) => !isMaintenance(room.status)).length;
}

/** Idade acima disto é tratada como "ou mais" (o seed usa 120). */
const OPEN_AGE = 100;

export function formatAgeRange(rule: PricingRuleLike): string {
  if (rule.maxAge >= OPEN_AGE) return `${rule.minAge} anos ou mais`;
  if (rule.minAge === rule.maxAge) return `${rule.minAge} ${rule.minAge === 1 ? "ano" : "anos"}`;
  return `${rule.minAge} a ${rule.maxAge} anos`;
}

/** Linha da regra: "3 a 5 anos · Uma vez por hospedagem · R$ 100". */
export function describeRule(rule: PricingRuleLike): { age: string; basis: string; value: string; free: boolean } {
  const free = rule.price <= 0;
  return {
    age: formatAgeRange(rule),
    basis: free ? "Sem cobrança" : rule.billingBasis === "per_stay" ? "Uma vez por hospedagem" : "Por diária",
    value: free ? "grátis" : formatRate(rule.price),
    free,
  };
}

export function sortRules<T extends PricingRuleLike>(rules: T[]): T[] {
  return [...rules].sort((a, b) => a.minAge - b.minAge);
}

// Datas civis "AAAA-MM-DD" em UTC, para não depender do fuso do navegador.
const toDay = (date: string) => {
  const [y, m, d] = date.slice(0, 10).split("-").map(Number);
  return Date.UTC(y, m - 1, d);
};
const DAY = 86_400_000;
const parts = (time: number) => {
  const date = new Date(time);
  return { y: date.getUTCFullYear(), m: date.getUTCMonth(), d: date.getUTCDate() };
};
const dayMonth = (time: number) => {
  const { m, d } = parts(time);
  return `${d} ${MONTHS[m]}`;
};
const firstOfMonth = (time: number, add = 0) => {
  const { y, m } = parts(time);
  return Date.UTC(y, m + add, 1);
};

export interface ValidityPeriod {
  from: string | null;
  /** Fim exclusivo: o dia da última saída. */
  until: string | null;
  categories: string[];
}

/** Agrupa as categorias com a mesma validade. Categoria sem validade não entra. */
export function validityPeriods(categories: CategoryLike[]): ValidityPeriod[] {
  const periods = new Map<string, ValidityPeriod>();
  for (const category of categories) {
    const from = category.rateValidFrom || null;
    const until = category.rateValidUntil || null;
    if (!from && !until) continue;
    const key = `${from}|${until}`;
    const period = periods.get(key) ?? { from, until, categories: [] };
    period.categories.push(category.name);
    periods.set(key, period);
  }
  return [...periods.values()].sort((a, b) => (a.from ?? "").localeCompare(b.from ?? ""));
}

export type SeasonStatus = "before" | "within" | "after";

export function seasonStatus(period: Pick<ValidityPeriod, "from" | "until">, today: string): SeasonStatus {
  if (period.from && today < period.from) return "before";
  if (period.until && today >= period.until) return "after";
  return "within";
}

/** "Verão 2026/27" quando a validade cobre dezembro a fevereiro; senão nada. */
export function seasonName(period: Pick<ValidityPeriod, "from" | "until">): string | null {
  if (!period.from || !period.until) return null;
  const start = parts(toDay(period.from));
  const last = parts(toDay(period.until) - DAY);
  const crossesYear = last.y === start.y + 1;
  if (!crossesYear || ![10, 11].includes(start.m) || ![1, 2].includes(last.m)) return null;
  return `Verão ${start.y}/${String(last.y % 100).padStart(2, "0")}`;
}

/** "1 dez → 28 fev": primeira entrada e última noite. */
export function periodLabel(period: Pick<ValidityPeriod, "from" | "until">): string {
  const from = period.from ? dayMonth(toDay(period.from)) : null;
  const last = period.until ? dayMonth(toDay(period.until) - DAY) : null;
  if (from && last) return `${from} → ${last}`;
  if (from) return `a partir de ${from}`;
  return `até ${last}`;
}

/** Aviso quando hoje está fora da validade; null dentro dela. */
export function outOfSeasonNotice(period: Pick<ValidityPeriod, "from" | "until">, today: string): string | null {
  if (seasonStatus(period, today) === "within") return null;
  const before = period.from ? `Até ${dayMonth(toDay(period.from) - DAY)}` : null;
  const after = period.until ? `a partir de ${dayMonth(toDay(period.until))}` : null;
  const when = before && after ? `${before} e ${after}` : before ?? `A${after!.slice(1)}`;
  return `${when} não há tarifa para estas categorias. O sistema não presume preço: a reserva pede diária manual.`;
}

export type BandSegmentKind = "past" | "gap" | "valid" | "after";

export interface ValidityBand {
  months: Array<{ key: string; label: string; left: number; width: number }>;
  segments: Array<{ kind: BandSegmentKind; left: number; width: number }>;
  /** Posição de hoje, em % da faixa. */
  today: number;
}

/**
 * Faixa de meses do mês de hoje (ou do início, se vier antes) até o mês do
 * fim da validade. Antes do início: o que já passou fica neutro e o que falta
 * até a tarifa começar fica listrado.
 */
export function validityBand(period: Pick<ValidityPeriod, "from" | "until">, today: string): ValidityBand {
  const now = toDay(today);
  const from = period.from ? toDay(period.from) : null;
  const until = period.until ? toDay(period.until) : null;
  const start = firstOfMonth(Math.min(now, from ?? now));
  const end = until !== null
    ? firstOfMonth(Math.max(until, now), 1)
    : firstOfMonth(Math.max(now, from ?? now), 3);
  const span = end - start;
  const pct = (time: number) => Math.round(((Math.min(Math.max(time, start), end) - start) / span) * 10_000) / 100;

  const months: ValidityBand["months"] = [];
  for (let month = start; month < end; month = firstOfMonth(month, 1)) {
    const next = firstOfMonth(month, 1);
    const { y, m } = parts(month);
    months.push({ key: `${y}-${m}`, label: MONTHS[m], left: pct(month), width: pct(next) - pct(month) });
  }

  const validStart = from ?? start;
  const validEnd = until ?? end;
  const raw: Array<{ kind: BandSegmentKind; from: number; to: number }> = [
    { kind: "past", from: start, to: Math.min(now, validStart) },
    { kind: "gap", from: Math.max(now, start), to: validStart },
    { kind: "valid", from: validStart, to: validEnd },
    { kind: "after", from: validEnd, to: end },
  ];
  const segments = raw
    .filter((segment) => segment.to > segment.from)
    .map((segment) => ({ kind: segment.kind, left: pct(segment.from), width: pct(segment.to) - pct(segment.from) }));

  return { months, segments, today: pct(now) };
}

/**
 * Valor digitado em reais: "528", "528,50", "R$ 1.250,00". Vazio vira null;
 * texto que não é número vira NaN.
 */
export function parseMoney(text: string): number | null {
  const clean = text.replace(/R\$/g, "").replace(/\s/g, "");
  if (!clean) return null;
  const normalized = clean.includes(",") ? clean.replace(/\./g, "").replace(",", ".") : clean;
  return /^\d+(\.\d{1,2})?$/.test(normalized) ? Number(normalized) : Number.NaN;
}

/** Valor para o campo de texto: 528 → "528", 528.5 → "528,50". */
export function moneyInput(value: number | null | undefined): string {
  if (value === null || value === undefined) return "";
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(".", ",");
}
