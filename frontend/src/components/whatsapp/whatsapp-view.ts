// Montagem de dados da tela do WhatsApp, sem React, para testar com node --test.

interface SuggestionPartLike {
  text: string;
  gap: boolean;
}

/** Trechos a completar da sugestão usada que ainda estão no texto (o backend recusa com 422). */
export function remainingGaps(text: string, parts: SuggestionPartLike[] | null | undefined): string[] {
  if (!parts) return [];
  return parts.filter((part) => part.gap && part.text && text.includes(part.text)).map((part) => part.text);
}

export function gapNotice(count: number): string | null {
  if (count <= 0) return null;
  return count === 1
    ? "Complete o trecho destacado antes de enviar."
    : `Complete os ${count} trechos destacados antes de enviar.`;
}

/** "Inserir aviso" acrescenta o aviso de privacidade ao fim da resposta, uma vez só. */
export function appendPrivacyNotice(text: string, notice: string): string {
  const aviso = notice.trim();
  if (!aviso || text.includes(aviso)) return text;
  const corpo = text.trimEnd();
  return corpo ? `${corpo}\n\n${aviso}` : aviso;
}

export function firstName(displayName: string): string {
  const name = displayName.trim();
  // Contato sem nome aparece pelo telefone: não dá para cortar.
  if (!name || /^\+?[\d\s()-]+$/.test(name)) return name;
  return name.split(/\s+/)[0];
}

export interface AvailabilityRow {
  category: string;
  roomsFree: number | null;
  total: string | null;
}

/** Junta quartos livres e total por categoria numa tabela só, na ordem em que chegaram. */
export function availabilityRows(
  availability: Array<{ category: string; roomsFree: number }>,
  prices: Array<{ category: string; total: string }>,
): AvailabilityRow[] {
  const rows = new Map<string, AvailabilityRow>();
  for (const item of availability) rows.set(item.category, { category: item.category, roomsFree: item.roomsFree, total: null });
  for (const item of prices) {
    const row = rows.get(item.category);
    if (row) row.total = item.total;
    else rows.set(item.category, { category: item.category, roomsFree: null, total: item.total });
  }
  return [...rows.values()];
}

export function percentOf(part: number, total: number): number | null {
  return total > 0 ? Math.round((part * 100) / total) : null;
}
