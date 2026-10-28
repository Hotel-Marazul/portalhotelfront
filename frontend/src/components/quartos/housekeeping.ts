// Limpeza por quarto (add-room-housekeeping-status). Quarto em manutenção mostra a manutenção, não a limpeza.

export type HousekeepingStatus = "limpo" | "em_limpeza" | "precisa_limpar";

// Rótulos curtos para caber no seletor do painel do quarto.
const LABELS: Record<HousekeepingStatus, string> = { limpo: "Pronto", em_limpeza: "Limpando", precisa_limpar: "A limpar" };

export const HOUSEKEEPING_OPTIONS = (["limpo", "em_limpeza", "precisa_limpar"] as const).map((value) => ({ value, label: LABELS[value] }));

export function isHousekeepingStatus(value: unknown): value is HousekeepingStatus {
  return value === "limpo" || value === "em_limpeza" || value === "precisa_limpar";
}

/** null quando o backend não mandou o estado (versão antiga) ou o quarto está em manutenção. */
export function housekeepingOf(room: { housekeepingStatus?: string | null }, maintenance: boolean): HousekeepingStatus | null {
  if (maintenance || !isHousekeepingStatus(room.housekeepingStatus)) return null;
  return room.housekeepingStatus;
}

export const housekeepingLabel = (status: HousekeepingStatus) => LABELS[status];

/** Pronto fica neutro; o resto pede atenção da recepção. */
export const housekeepingNeedsAttention = (status: HousekeepingStatus) => status !== "limpo";
