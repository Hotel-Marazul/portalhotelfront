export function normalizePhone(raw: string): string | null {
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);

  if (digits.length === 10 || digits.length === 11) {
    digits = `55${digits}`;
  }
  if ((digits.length !== 12 && digits.length !== 13) || !digits.startsWith("55")) {
    return null;
  }

  return `+${digits}`;
}

export function phoneFromJid(jid: string): string | null {
  return normalizePhone(jid.split("@", 1)[0] ?? "");
}

export function phoneVariants(e164: string): string[] {
  const normalized = normalizePhone(e164);
  if (!normalized) return [];

  const digits = normalized.slice(1);
  const subscriber = digits.slice(4);
  if (digits.length === 13 && subscriber.startsWith("9")) {
    return [normalized, `+${digits.slice(0, 4)}${subscriber.slice(1)}`];
  }
  if (digits.length === 12 && /^[6-9]/.test(subscriber)) {
    return [normalized, `+${digits.slice(0, 4)}9${subscriber}`];
  }

  return [normalized];
}
