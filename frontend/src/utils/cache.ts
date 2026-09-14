// Sistema simples de cache para requisições
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresIn: number; // em milissegundos
}

class RequestCache {
  private cache: Map<string, CacheEntry<unknown>> = new Map();
  private defaultExpiresIn = 5 * 60 * 1000; // 5 minutos por padrão

  set<T>(key: string, data: T, expiresIn?: number): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      expiresIn: expiresIn || this.defaultExpiresIn,
    });
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const now = Date.now();
    const isExpired = now - entry.timestamp > entry.expiresIn;

    if (isExpired) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;

    const now = Date.now();
    const isExpired = now - entry.timestamp > entry.expiresIn;

    if (isExpired) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  clear(key?: string): void {
    if (key) {
      this.cache.delete(key);
    } else {
      this.cache.clear();
    }
  }

  clearMatching(prefix: string): void {
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) this.cache.delete(key);
    }
  }

  // Limpa entradas expiradas
  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.expiresIn) {
        this.cache.delete(key);
      }
    }
  }
}

// Conversas antigas persistidas por versões anteriores não devem sobreviver a logout
// ou troca de usuário. A tela atual mantém o histórico somente em memória.
const LEGACY_AGENT_STORAGE_KEYS = ["agents.conversation_id", "agents.messages"] as const;

export function clearAgentConversationStorage(): void {
  if (typeof window === "undefined") return;
  for (const key of LEGACY_AGENT_STORAGE_KEYS) window.localStorage.removeItem(key);
}

// Instância singleton
export const requestCache = new RequestCache();

// Limpa cache expirado a cada 1 minuto
if (typeof window !== 'undefined') {
  setInterval(() => {
    requestCache.cleanup();
  }, 60 * 1000);
}
