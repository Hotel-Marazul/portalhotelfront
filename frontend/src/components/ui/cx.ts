// Junta classes do Tailwind ignorando as condicionais vazias.
export function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}
