# PortalHotel — Projeto

**Tipo:** Brownfield — sistema existente em produção (uso interno)  
**Domínio:** Gestão de reservas para pequenos hotéis e pousadas  
**Stack:** Next.js 15 + Express/TypeScript + FastAPI Python + PostgreSQL 16  
**Último review:** 2026-05-11

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

### Active (a corrigir/adicionar)

- [ ] Transações DB em create/update de reserva (sem risco de dados órfãos)
- [ ] Prevenção de overbooking com lock ou constraint de exclusão no DB
- [ ] Dados reais de ocupação mensal no dashboard (não fake)
- [ ] Auth no agente FastAPI (API key obrigatória)
- [ ] Rate limit dedicado no endpoint de login
- [ ] Remoção de credenciais padrão do docker-compose
- [ ] Validação de CPF no backend (dígito verificador)
- [ ] Confirmação antes de criar reserva via agente IA
- [ ] Paginação server-side em /Reservations e /client
- [ ] Remover backend/dist/ do git e padronizar rotas para kebab-case
- [ ] Testes automatizados — backend (Vitest) e frontend (Vitest + Testing Library)

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
| Testes com Vitest (backend) + Vitest/RTL (frontend) | Ecossistema ES modules alinhado com o backend, zero config extra | Pendente aprovação |
| DB transactions com pool.connect() + BEGIN/COMMIT | Seed já usa esse padrão corretamente | Definido |
| Constraint de exclusão tsrange para overbooking | Garantia no DB level, independente de código | Pendente validação |

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
