---
tags: [tecnico, arquitetura, adr]
---

# Decisões de Arquitetura (ADRs)

## ADR-001: Three-tier com comunicação HTTP

**Data:** (anterior ao projeto atual)  
**Status:** Aceito

**Contexto:** Sistema composto por frontend (Next.js), backend API (Express) e serviço de IA (FastAPI).

**Decisão:** Três containers independentes comunicando via HTTP sobre rede bridge Docker. Sem shared packages ou monorepo linking.

**Consequências:**
- (+) Serviços independentes — podem ser escalados separadamente
- (+) Linguagens diferentes por serviço (TS para app, Python para IA)
- (-) Latência de rede interna para cada chamada entre serviços
- (-) Sem tipagem compartilhada — duplicação de tipos entre frontend e backend

---

## ADR-002: PostgreSQL raw com `pg` pool (sem ORM)

**Data:** (anterior ao projeto atual)  
**Status:** Aceito

**Contexto:** Escolha de camada de acesso ao banco.

**Decisão:** `pg` pool com queries parametrizadas diretamente. Sem ORM (Prisma, TypeORM, Drizzle).

**Consequências:**
- (+) Controle total do SQL — queries otimizadas
- (+) Sem abstração que esconda comportamento do banco
- (-) Sem migrations automáticas — schema gerenciado manualmente em `init.ts`
- (-) Sem type safety automático das queries — tipos definidos manualmente em `models.ts`

---

## ADR-003: JWT via cookie httpOnly (não localStorage)

**Data:** (anterior ao projeto atual)  
**Status:** Aceito

**Contexto:** Estratégia de autenticação no frontend.

**Decisão:** JWT emitido como cookie httpOnly, não exposto ao JavaScript do browser.

**Consequências:**
- (+) Protege contra XSS — JS não pode ler o token
- (+) Cookies usam `httpOnly`, `sameSite=lax` e CORS com origens explícitas
- (-) Backend também aceita via header `Authorization: Bearer` para compatibilidade com agents service

---

## ADR-004: Transações DB com pool.connect() + BEGIN/COMMIT

**Data:** 2026-05-11  
**Status:** Implementado

**Contexto:** Reservas criam/atualizam múltiplas tabelas (`reservations` + `reservation_guests`) sem transação.

**Decisão:** Usar `pool.connect()` para obter cliente dedicado, envolver mutations em `BEGIN/COMMIT/ROLLBACK`.

**Referência:** `backend/src/db/seed.ts` já usa este padrão corretamente.

---

## ADR-005: Constraint PostgreSQL para prevenir overbooking

**Data:** 2026-05-11  
**Status:** Aceito e implementado em 2026-09-05

**Contexto:** Race condition entre verificação de disponibilidade e INSERT de reserva.

**Opção A:** `SELECT FOR UPDATE` no quarto dentro de transação — locking a nível de aplicação  
**Opção B:** Exclusion constraint com `tstzrange` — locking a nível de banco

**Decisão:** usar as duas camadas. A transação com `SELECT FOR UPDATE` fornece erro amigável pela API, e a constraint do banco garante integridade mesmo diante de concorrência ou outro caminho de escrita. Somente `Cancelada` deixa de bloquear datas; `Concluída` preserva a ocupação histórica.

```sql
-- Constraint aplicada pelo initializeDatabase
ALTER TABLE reservations 
ADD CONSTRAINT reservations_no_overlapping_stays
EXCLUDE USING GIST (
  room_id WITH =,
  tstzrange(check_in_date, check_out_date, '[)') WITH &&
) WHERE (status <> 'Cancelada');
```

---

## ADR-006: Testes sem framework adicional

**Data:** 2026-09-13
**Status:** Aceito

**Decisão:** Usar `node:test` para o backend, scripts Python executáveis para os agentes e `node:test` para a lógica isolada da agenda. Não adicionar Vitest/Jest apenas para cobrir funções puras.

**Motivo:** mantém a suíte pequena e compatível com os três runtimes; testes de integração usam PostgreSQL real quando disponíveis.

---

## ADR-007: Gateway autenticado para agentes

**Data:** 2026-09-13
**Status:** Implementado

O navegador chama `/api/agent/*` no backend com a sessão do usuário. O backend usa `AGENTS_API_KEY` para chamar o FastAPI, e o contexto do usuário iniciador é assinado. O FastAPI usa `BACKEND_BEARER_TOKEN` para retornar ao backend e aceita somente a allowlist operacional.

## ADR-008: Eventos e lançamentos append-only

**Data:** 2026-09-13
**Status:** Implementado

Cancelamentos, transições, alterações críticas e pagamentos geram eventos imutáveis. Correções financeiras são lançamentos `reversal` negativos relacionados ao original; nenhum caminho HTTP edita ou apaga o registro original.

## Padrão de transação DB (referência)

```typescript
// Padrão correto — baseado em seed.ts
const client = await pool.connect();
try {
  await client.query('BEGIN');
  
  const result = await client.query(
    'INSERT INTO reservations (...) VALUES ($1, $2, ...) RETURNING id',
    [...]
  );
  
  for (const guest of guests) {
    await client.query(
      'INSERT INTO reservation_guests (...) VALUES ($1, $2, ...)',
      [result.rows[0].id, ...]
    );
  }
  
  await client.query('COMMIT');
  return result.rows[0];
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  client.release();
}
```
