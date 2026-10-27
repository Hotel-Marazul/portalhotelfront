// Regras puras da Gestão, testadas em tests/gestao-data.test.mjs.

export interface MonthlyOccupancy {
  mes: string;
  taxa: number;
  quartoNoites: number;
}

const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const MINUS = "−";

const decimal = (value: number, digits: number) =>
  value.toLocaleString("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits });

/** Variação relativa entre dois meses. Sem base no mês anterior, não há comparação. */
export function monthChange(current: number, previous: number): number | null {
  if (!Number.isFinite(current) || !Number.isFinite(previous) || previous <= 0) return null;
  return (current - previous) / previous;
}

/** 0,0843… vira "+8,4% vs mês anterior"; queda usa o sinal de menos tipográfico. */
export function formatMonthChange(change: number | null): string | null {
  if (change === null) return null;
  const rounded = Math.round(change * 1000) / 10;
  const sign = rounded > 0 ? "+" : rounded < 0 ? MINUS : "";
  return `${sign}${decimal(Math.abs(rounded), 1)}% vs mês anterior`;
}

/** Diferença de ocupação em pontos percentuais: "+4 pp vs mês anterior". */
export function formatPointsChange(current: number, previous: number): string | null {
  if (!Number.isFinite(current) || !Number.isFinite(previous)) return null;
  const rounded = Math.round(current - previous);
  const sign = rounded > 0 ? "+" : rounded < 0 ? MINUS : "";
  return `${sign}${Math.abs(rounded)} pp vs mês anterior`;
}

/** "R$ 96,4 mil", "R$ 1,2 mi", "R$ 850". Escrito à mão para não depender do ICU de cada ambiente. */
export function formatCompactCurrency(value: number): string {
  const sign = value < 0 ? MINUS : "";
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${sign}R$ ${decimal(Math.round(abs / 100_000) / 10, 1).replace(/,0$/, "")} mi`;
  if (abs >= 1_000) {
    const thousands = Math.round(abs / 100) / 10;
    if (thousands >= 1000) return `${sign}R$ 1 mi`;
    return `${sign}R$ ${decimal(thousands, 1).replace(/,0$/, "")} mil`;
  }
  return `${sign}R$ ${Math.round(abs)}`;
}

/**
 * A receber = receita do mês menos o recebido no mês. Pode ficar negativo:
 * a receita conta pela data de entrada e o recebido pela data do pagamento.
 */
export function amountToReceive(revenue: number, received: number): number {
  return revenue - received;
}

/** "Outubro de 2026 · dia 27 de 31", a partir da data civil do hotel (AAAA-MM-DD). */
export function monthHeading(civilDate: string): { month: string; title: string; detail: string } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(civilDate);
  if (!match) return null;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const name = MONTHS[month - 1];
  if (!name) return null;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return {
    month: name,
    title: `${name.charAt(0).toUpperCase()}${name.slice(1)} de ${year}`,
    detail: `dia ${day} de ${daysInMonth}`,
  };
}

export interface OccupancyBar {
  label: string;
  rate: number;
  roomNights: number;
  /** Altura em % da área do gráfico; a escala vai até 100% de ocupação. */
  height: number;
  current: boolean;
}

/** As barras são os meses que o backend mandou, na mesma ordem; o último é o mês atual. */
export function occupancyBars(months: MonthlyOccupancy[] | null | undefined): OccupancyBar[] {
  if (!Array.isArray(months)) return [];
  return months.map((month, index) => {
    const rate = Number.isFinite(month.taxa) ? month.taxa : 0;
    return {
      label: month.mes,
      rate,
      roomNights: month.quartoNoites,
      height: Math.min(100, Math.max(0, rate)),
      current: index === months.length - 1,
    };
  });
}

export function formatRate(rate: number): string {
  return `${decimal(Math.round(rate), 0)}%`;
}
