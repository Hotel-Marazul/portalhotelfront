---
tags: [bugs, tecnico, critico]
---

# Bugs Conhecidos

Mapeados em 2026-05-11 via varredura do codebase.

---

## 🔴 Crítico

### sem-transacao
**Sem transação DB em create/update de reserva**

- **Arquivo:** `backend/src/modules/reservations/reservations.routes.ts` linhas 303–327 (create), 408–434 (update)
- **Impacto:** Crash entre INSERT da reserva e INSERT dos hóspedes → reserva sem hóspedes no banco
- **Fix:** `pool.connect()` + `BEGIN/COMMIT/ROLLBACK` — seed.ts já tem o padrão correto
- **Status:** 🔴 Aberto

---

### overbooking
**Race condition na verificação de disponibilidade**

- **Arquivo:** `backend/src/modules/reservations/reservations.routes.ts` linhas 93–116 e 276–316
- **Impacto:** Dois requests simultâneos passam na verificação e criam reservas sobrepostas para o mesmo quarto
- **Fix opção A:** `SELECT FOR UPDATE` no quarto dentro de transação
- **Fix opção B:** Constraint de exclusão `tsrange` no PostgreSQL — mais robusto
- **Status:** 🔴 Aberto

---

### dashboard-fake
**Dados de ocupação mensal são hardcoded**

- **Arquivo:** `backend/src/modules/reservations/reservations.routes.ts` linhas 511-515
- **Código:**
  ```typescript
  taxaOcupacaoMes: [
    { mes: "Jan", taxa: occupancyRate },
    { mes: "Fev", taxa: occupancyRate },
    { mes: "Mar", taxa: occupancyRate }
  ]
  ```
- **Impacto:** Gráfico no dashboard mostra três barras idênticas — não é dado real
- **Fix:** Query com `date_trunc('month', check_in_date)` agrupando por mês histórico
- **Status:** 🔴 Aberto

---

## 🟠 Alto

### agents-sem-auth
**Agente FastAPI sem autenticação**

- **Arquivo:** `agents/app/router.py`
- **Impacto:** Qualquer requisição na porta 5051 pode criar/editar/deletar reservas via chat
- **Fix:** API key obrigatória no header; `BACKEND_BEARER_TOKEN` não-opcional
- **Status:** 🟠 Aberto

### credenciais-git
**Credenciais padrão admin/admin no docker-compose.yaml**

- **Arquivo:** `docker-compose.yaml` linhas 44-46, 87-89; `backend/src/config/env.ts` linha 15
- **Impacto:** Credenciais triviais comprometidas para qualquer um que clonar o repo
- **Fix:** Remover defaults de `env.ts`. Mover para `.env.compose` (gitignored)
- **Status:** 🟠 Aberto

### pricing-first-guest
**Primeiro hóspede sempre incluído — regra sem documentação ou teste**

- **Arquivo:** `backend/src/utils/reservation.ts` linhas 22-31
- **Constante:** `INCLUDED_ADDITIONAL_GUESTS = 1`
- **Impacto:** Se regra mudar, não há testes protegendo contra regressão
- **Status:** 🟠 Sem cobertura de testes

### ver-reserva-noop
**Botão "Ver Detalhes" em /reservas não faz nada**

- **Arquivo:** `frontend/src/app/reservas/page.tsx` linha 337
- **Impacto:** Feature incompleta — click silencioso
- **Status:** 🟠 Aberto

---

## 🟡 Médio

### rotas-pascal-case
**Rotas duplicadas em PascalCase e kebab-case**

- Rooms: `/rooms` e `/Rooms`
- Reservations: `/Reservations`
- Auth: `/User/login`
- **Fix:** Padronizar para kebab-case, deprecar PascalCase
- **Status:** 🟡 Dívida técnica

### dist-no-git
**`backend/dist/` commitado no repositório**

- **Impacto:** Drift entre `src/` compilado e `dist/` em produção
- **Fix:** Adicionar `backend/dist/` ao `.gitignore`, remover do histórico
- **Status:** 🟡 Dívida técnica

### sem-paginacao
**`GET /Reservations` e `GET /client` retornam todos os registros sem limite**

- **Impacto:** Crescimento do dataset degrada performance e aumenta payload
- **Fix:** Paginação server-side com `LIMIT/OFFSET` ou cursor
- **Status:** 🟡 Performance

### cpf-backend
**CPF não validado com dígito verificador no backend**

- **Arquivo:** `backend/src/modules/clients/clients.schema.ts`
- **Impacto:** CPFs inválidos (mas com 11 dígitos) são aceitos
- **Fix:** Implementar algoritmo de validação do dígito verificador no Zod schema
- **Status:** 🟡 Aberto

### rate-limit-login
**Rate limit global — sem limite dedicado no endpoint de login**

- **Arquivo:** `backend/src/middlewares/security.ts`
- **Limite atual:** 200 req / 15 min (global para todas as rotas)
- **Fix:** Limiter dedicado de 10 req / 15 min em `POST /User/login`
- **Status:** 🟡 Segurança

---

## 🟢 Baixo / Dívida

| Issue | Arquivo | Tipo |
|-------|---------|------|
| Agente cria reserva sem confirmação do usuário | `agents/orchestration/flows.py` | UX / Segurança |
| `apiService.ts` wrapper incompleto (sem PUT/DELETE) | `frontend/src/services/apiService.ts` | Tech debt |
| Pages `/testes/` acessíveis em runtime | `frontend/src/app/testes/` | Dev contamination |
| `console.error` como único reporte de erros | Múltiplos componentes frontend | Observability |
| Seed loga credenciais no stdout | `backend/src/db/seed.ts` linhas 395-397 | Info leak |
| JWT sem verificação de assinatura no middleware Next.js | `frontend/middleware.ts` | False security |

---

## Legenda

| Cor | Severidade |
|-----|-----------|
| 🔴 | Crítico — risco de perda de dados ou overbooking |
| 🟠 | Alto — segurança ou feature quebrada |
| 🟡 | Médio — performance ou qualidade degradada |
| 🟢 | Baixo — cosmético ou dívida técnica menor |
