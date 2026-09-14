# PortalHotel — Projeto

**Tipo:** Brownfield — sistema existente em produção (uso interno)
**Domínio:** Gestão de reservas para pequenos hotéis e pousadas
**Stack:** Next.js 16 + Express/TypeScript + FastAPI Python + PostgreSQL 16
**Último review:** 2026-09-13

---

## O que este sistema é

Sistema de gestão hoteleira interno para um único hotel/pousada. Cobre o ciclo completo de reservas: cadastro de quartos e categorias, gestão de clientes, criação/edição/cancelamento de reservas com cálculo automático de preço por regras de hóspede, dashboard operacional e um agente de IA conversacional que pode criar e consultar reservas via chat.

**Valor central:** Operacionalizar o dia-a-dia do hotel — reservas confiáveis, dados corretos, sem fricção.

---

## Contexto

Projeto retomado após pausa. Codebase funcional mas com bugs críticos conhecidos e dívida técnica acumulada. Prioridade: estabilizar o que existe antes de adicionar features.

**O que já funciona (Validado):**
- Autenticação JWT com roles (admin / manager)
- CRUD completo de quartos, categorias, clientes
- Criação, edição e cancelamento de reservas com hóspedes
- Cálculo de preço por regras de guest pricing
- Dashboard com métricas operacionais
- Agente de IA conversacional (FastAPI + OpenAI/Agno)
- RAG local para políticas do hotel
- Deploy via Docker Compose

---

## Requirements

### Validated (existente e funcionando)

- ✓ Autenticação email/senha com JWT e cookie httpOnly — existente
- ✓ Roles admin e manager com acesso diferenciado — existente
- ✓ CRUD de quartos com status operacional — existente
- ✓ CRUD de categorias de quarto — existente
- ✓ CRUD de clientes com CPF — existente
- ✓ Criação de reserva com múltiplos hóspedes — existente
- ✓ Edição e cancelamento de reserva — existente
- ✓ Verificação de disponibilidade de quarto — existente
- ✓ Cálculo de preço total com regras de hóspede — existente
- ✓ Dashboard com ocupação, receita e status dos quartos — existente
- ✓ Agente IA conversacional para consulta e criação de reservas — existente
- ✓ RAG local para respostas sobre políticas do hotel — existente
- ✓ Deploy containerizado via Docker Compose — existente

### Active (próximos incrementos)

- [ ] Limiter dedicado no endpoint de login quando a API for exposta publicamente.
- [ ] Migrar aliases PascalCase após inventário de consumidores.
- [ ] Armazenamento compartilhado para conversas/propostas se agents escalar horizontalmente.
- [ ] Playwright/E2E de componentes quando a infraestrutura de browser entrar no CI.

As correções de transação, overbooking, ocupação, autenticação do agente,
CPF, confirmação, paginação e scripts de teste foram entregues no milestone
`harden-reservation-operations`.

### Out of Scope

- Multi-tenant / SaaS — sistema de uso interno de um único hotel
- Pagamentos online — não planejado neste milestone
- Channel manager (OTA integrations) — fora do escopo atual
- App mobile — não planejado

---

## Key Decisions

| Decisão | Racional | Status |
|---------|----------|--------|
| Corrigir bugs críticos antes de novas features | Dados inconsistentes corroem confiança no sistema | Definido |
| Manter stack atual (sem migração) | Stack adequada, problema é na lógica não na tecnologia | Definido |
| Knowledge base em Obsidian (.mente/) | Acumular contexto de domínio e técnico para development eficaz | Definido |
| Testes com `node:test` + scripts Python | Cobertura pequena sem dependência adicional; integração usa PostgreSQL real | Implementado |
| DB transactions com pool.connect() + BEGIN/COMMIT | Seed e rotas usam o mesmo padrão | Implementado |
| Constraint de exclusão `tstzrange` para overbooking | Garantia no DB, independente do código da API | Implementado |
| Gateway autenticado para agents | Navegador não recebe segredo nem chama FastAPI diretamente | Implementado |
| Eventos e lançamentos append-only | Histórico operacional e financeiro reconciliável | Implementado |

---

## Arquitetura atual

```
Browser → Next.js (3000) → Express Backend (5000) → PostgreSQL (5432)
                        → FastAPI Agents (5050) → Express Backend (5000)
```

Três containers independentes comunicando via HTTP sobre bridge network Docker.

---

## Evolution

Este documento evolui a cada transição de fase e milestone.

**Após cada fase** (via `/gsd-transition`):
1. Requirements resolvidos → mover para Validated com referência da fase
2. Novos requirements emergidos → adicionar em Active
3. Decisões tomadas → registrar em Key Decisions

**Após cada milestone** (via `/gsd-complete-milestone`):
1. Review completo de todas as seções
2. Verificar se "valor central" ainda é a prioridade certa

---
*Inicializado: 2026-05-11 após retomada do projeto + varredura completa do codebase*
