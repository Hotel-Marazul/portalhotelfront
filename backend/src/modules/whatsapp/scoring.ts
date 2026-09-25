export type QueueLevel = "agora" | "hoje" | "espera";

export type QueueIntent =
  | "reserva_nova"
  | "preco"
  | "alteracao_reserva"
  | "cancelamento"
  | "duvida_estadia"
  | "problema_estadia"
  | "agradecimento"
  | "fornecedor"
  | "outro"
  | "desconhecida";

export interface QueueSignals {
  intent: QueueIntent;
  has_dates: boolean;
  has_guest_count: boolean;
  is_returning_guest: boolean;
  is_in_house: boolean;
  arrives_today: boolean;
  high_demand: boolean;
  no_availability: boolean;
  is_supplier: boolean;
  unknown_contact: boolean;
  rooms_free?: number | null;
  last_stay?: string | null;
}

export interface QueueRule {
  condition: Record<string, unknown> | null;
  weight: -10 | 10;
  title: string;
  status?: "active" | "proposed" | "ignored" | "reverted";
}

export interface ScoreContext {
  awaitingSince?: Date | string | null;
  now?: Date;
  roomsFree?: number | null;
  lastStay?: string | null;
}

export interface ScoreReason {
  text: string;
  weight: number;
}

export interface ScoreResult {
  baseScore: number;
  score: number;
  level: QueueLevel;
  reasons: ScoreReason[];
  waitingText: string | null;
}

const INTENT_SCORE: Record<QueueIntent, { weight: number; text: string }> = {
  problema_estadia: { weight: 55, text: "Problema durante a estadia" },
  reserva_nova: { weight: 40, text: "Pedido de reserva" },
  alteracao_reserva: { weight: 30, text: "Quer alterar a reserva" },
  cancelamento: { weight: 30, text: "Quer cancelar a reserva" },
  preco: { weight: 30, text: "Pergunta de preço" },
  duvida_estadia: { weight: 25, text: "Dúvida sobre a estadia" },
  outro: { weight: 15, text: "" },
  desconhecida: { weight: 20, text: "Sem leitura da IA" },
  agradecimento: { weight: 5, text: "Não tem pergunta" },
  fornecedor: { weight: 0, text: "Mensagem de fornecedor" }
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function minutesWaiting(context: ScoreContext): number {
  if (!context.awaitingSince || !context.now) return 0;
  const since = context.awaitingSince instanceof Date ? context.awaitingSince : new Date(context.awaitingSince);
  if (Number.isNaN(since.getTime())) return 0;
  return Math.max(0, Math.floor((context.now.getTime() - since.getTime()) / 60_000));
}

function waitingLabel(minutes: number): string | null {
  if (minutes <= 0) return null;
  if (minutes < 60) return `Esperando resposta há ${minutes} min`;
  return `Esperando resposta há ${Math.floor(minutes / 60)} h`;
}

export function scoreConversation(
  signals: QueueSignals,
  activeQueueRules: QueueRule[] = [],
  context: ScoreContext = {}
): ScoreResult {
  const reasons: ScoreReason[] = [];
  const intent = INTENT_SCORE[signals.intent];
  let base = intent.weight;
  if (intent.text) reasons.push({ text: intent.text, weight: intent.weight });

  if (signals.has_dates && signals.has_guest_count) {
    base += 15;
    reasons.push({ text: "Datas e pessoas já definidas", weight: 15 });
  }
  if (signals.arrives_today) {
    base += 20;
    reasons.push({ text: "Chega hoje", weight: 20 });
  }
  if (signals.is_in_house) {
    base += 15;
    reasons.push({ text: "Hóspede está no hotel agora", weight: 15 });
  }
  if (signals.high_demand) {
    const roomsFree = context.roomsFree ?? signals.rooms_free;
    base += 5;
    reasons.push({
      text: `Período com poucos quartos livres: restam ${roomsFree ?? "poucos"}`,
      weight: 5
    });
  }
  if (signals.no_availability) {
    reasons.push({ text: "Sem quarto livre para o grupo no período", weight: 0 });
  }
  if (signals.is_returning_guest) {
    reasons.push({
      text: `Já foi hóspede${context.lastStay ?? signals.last_stay ? ` (${context.lastStay ?? signals.last_stay})` : ""}`,
      weight: 0
    });
  }
  if (signals.is_supplier) reasons.push({ text: "Número marcado como fornecedor", weight: 0 });

  const matchingRules = activeQueueRules.filter((rule) => {
    if (rule.status && rule.status !== "active") return false;
    return Object.entries(rule.condition ?? {}).every(([key, value]) => signals[key as keyof QueueSignals] === value);
  });
  const ruleTotal = clamp(
    matchingRules.reduce((sum, rule) => sum + rule.weight, 0),
    -25,
    25
  );
  base += ruleTotal;
  for (const rule of matchingRules) {
    reasons.push({ text: `Regra aprovada: ${rule.title}`, weight: rule.weight });
  }

  const baseScore = clamp(base, 0, 100);
  const waitingMinutes = minutesWaiting(context);
  let score = clamp(baseScore + Math.min(30, waitingMinutes), 0, 100);
  if (signals.is_supplier) score = Math.min(score, 39);
  const level: QueueLevel = score >= 70 ? "agora" : score >= 40 ? "hoje" : "espera";

  reasons.sort((left, right) => {
    const weight = Math.abs(right.weight) - Math.abs(left.weight);
    return weight || (right.weight ? 0 : 1);
  });

  return {
    baseScore,
    score,
    level,
    reasons: reasons.slice(0, 4),
    waitingText: waitingLabel(waitingMinutes)
  };
}
