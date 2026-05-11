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
- (-) Vulnerável a CSRF — sem token CSRF implementado atualmente
- (-) Backend também aceita via header `Authorization: Bearer` para compatibilidade com agents service

---

## ADR-004: Transações DB com pool.connect() + BEGIN/COMMIT

**Data:** 2026-05-11  
**Status:** Definido (pendente implementação)

**Contexto:** Reservas criam/atualizam múltiplas tabelas (`reservations` + `reservation_guests`) sem transação.

**Decisão:** Usar `pool.connect()` para obter cliente dedicado, envolver mutations em `BEGIN/COMMIT/ROLLBACK`.

**Referência:** `backend/src/db/seed.ts` já usa este padrão corretamente.

---

## ADR-005: Constraint PostgreSQL para prevenir overbooking

**Data:** 2026-05-11  
**Status:** Avaliando

**Contexto:** Race condition entre verificação de disponibilidade e INSERT de reserva.

**Opção A:** `SELECT FOR UPDATE` no quarto dentro de transação — locking a nível de aplicação  
**Opção B:** Exclusion constraint com `tsrange` — locking a nível de banco

**Preferência:** Opção B (constraint de banco) — mais robusto, independente do código.

```sql
-- Exemplo de constraint tsrange
ALTER TABLE reservations 
ADD CONSTRAINT no_overbooking 
EXCLUDE USING GIST (
  room_id WITH =,
  tsrange(check_in_date, check_out_date) WITH &&
) WHERE (status != 'Cancelada');
```

---

## ADR-006: Testes com Vitest (backend + frontend)

**Data:** 2026-05-11  
**Status:** Definido (pendente implementação)

**Decisão:** Vitest para backend (alinhado com ESM), Vitest + @testing-library/react para frontend.

**Motivo:** Backend usa `"type": "module"` no `package.json` — Jest tem problemas com ESM nativo. Vitest funciona out-of-box.

---

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
