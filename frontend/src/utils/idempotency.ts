export interface IdempotencyAttempt {
  fingerprint: string;
  key: string;
}

export function requestFingerprint(payload: unknown): string {
  return JSON.stringify(payload);
}

export function getIdempotencyAttempt(
  previous: IdempotencyAttempt | null,
  payload: unknown,
): IdempotencyAttempt {
  const fingerprint = requestFingerprint(payload);
  return previous?.fingerprint === fingerprint
    ? previous
    : { fingerprint, key: crypto.randomUUID() };
}
