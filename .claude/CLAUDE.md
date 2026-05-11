# PortalHotel — Instruções para Claude Code

## O que é este projeto

Sistema de gestão hoteleira interno (Next.js 15 + Express/TypeScript + FastAPI Python + PostgreSQL 16). Cobre reservas, clientes, quartos, categorias, dashboard e agente IA conversacional. Deploy via Docker Compose.

## Estrutura

```
frontend/          Next.js 15 App Router (porta 3000)
backend/           Express 4 + TypeScript, ESM (porta 5000)
agents/            FastAPI + Python 3.12 (porta 5050)
.planning/         Documentos GSD (PROJECT.md, ROADMAP.md, etc.)
.mente/            Knowledge base Obsidian — domínio + técnico
```

## Regras críticas

### DB e transações
- SEMPRE usar `pool.connect()` + `BEGIN/COMMIT/ROLLBACK` em operações que tocam múltiplas tabelas
- Nunca executar sequência de `pool.query()` sem transação em mutations
- Ver `backend/src/db/seed.ts` como exemplo correto do padrão de transação

### Reservas — lógica de negócio
- `calculateReservationTotal` em `backend/src/utils/reservation.ts` — lógica central de preço
- Primeiro hóspede é sempre incluído (sem cobrança adicional) — `INCLUDED_ADDITIONAL_GUESTS = 1`
- Hóspedes adicionais cobrados conforme `pricing_rules` por tipo de hóspede
- Verificação de disponibilidade deve ser dentro de transação com lock para evitar overbooking

### Rotas e convenções
- Padrão correto: kebab-case lowercase (ex: `/api/pricing-rules`)
- Rotas PascalCase existentes (`/Rooms`, `/Reservations`, `/User`) são legado — não criar novas nesse padrão
- Backend usa ESM — imports locais DEVEM ter extensão `.js`

### Segurança
- Nunca commitar credenciais em `.env.example` ou `docker-compose.yaml`
- `BACKEND_BEARER_TOKEN` deve ser obrigatório no agents service
- Rate limit dedicado em `/User/login` — não confiar apenas no global

### Testes
- Zero testes automatizados existem — ao adicionar lógica crítica, adicionar teste Vitest
- Backend: Vitest + supertest para integração
- Frontend: Vitest + @testing-library/react

## Knowledge base

Toda documentação de domínio, decisões técnicas e referências de bibliotecas ficam em `.mente/`.
Consulte antes de implementar qualquer feature nova ou mudança de regra de negócio.

Estrutura do vault:
- `.mente/dominio/` — hotelaria, reservas, regras de negócio
- `.mente/tecnico/` — decisões de arquitetura, ADRs
- `.mente/bibliotecas/` — docs das libs usadas
- `.mente/bugs/` — bugs conhecidos, workarounds

## Comandos úteis

```bash
# Backend
cd backend && npm run dev          # dev server
cd backend && npm run build        # compile TypeScript
cd backend && npm run seed         # popular DB

# Frontend
cd frontend && npm run dev         # dev server
cd frontend && npm run lint        # ESLint

# Docker
docker compose up                  # subir todos os serviços
docker compose up db-marazul       # só o banco

# Agents
cd agents && python -m uvicorn app.server:app --reload --port 5050
```

## Contexto de desenvolvimento

- `backend/.env` — variáveis locais do backend (não commitado)
- `agents/.env` — variáveis locais dos agents (não commitado)
- `frontend/.env.local` — variáveis locais do frontend (não commitado)
- `backend/dist/` — NÃO editar diretamente, gerado pelo build
