// Regras puras da barra de busca, testadas em tests/command-search.test.mjs.

export const ACTIVE_RESERVATION_STATUSES = ["Pendente", "Confirmada", "EmAndamento"] as const;

interface SearchableRoom {
  id: string;
  number: number;
  displayNumber?: string;
}

/** Até 4 dígitos é número de quarto; mais que isso vai para a busca de CPF e telefone. */
export function isRoomNumberQuery(term: string): boolean {
  return /^\d{1,4}$/.test(term.trim());
}

/** Quartos cujo número começa pelo termo; o número exato vem primeiro. "115/116" casa com 115 e com 116. */
export function matchRooms<T extends SearchableRoom>(rooms: T[], term: string, limit = 4): T[] {
  const digits = term.trim();
  if (!isRoomNumberQuery(digits)) return [];
  const numbersOf = (room: T) => (room.displayNumber ?? String(room.number)).split("/").map((part) => part.trim());
  return rooms
    .map((room) => {
      const numbers = numbersOf(room);
      const rank = numbers.includes(digits) ? 0 : numbers.some((number) => number.startsWith(digits)) ? 1 : -1;
      return { room, rank };
    })
    .filter((entry) => entry.rank >= 0)
    .sort((a, b) => a.rank - b.rank || a.room.number - b.room.number)
    .slice(0, limit)
    .map((entry) => entry.room);
}

/** Reservas mais recentes primeiro, pela data de entrada. */
export function newestFirst<T extends { checkInDate: string }>(reservations: T[]): T[] {
  return [...reservations].sort((a, b) => (a.checkInDate < b.checkInDate ? 1 : a.checkInDate > b.checkInDate ? -1 : 0));
}
