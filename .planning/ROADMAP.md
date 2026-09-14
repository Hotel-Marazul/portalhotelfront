# Roadmap: PortalHotel — Hardening de Operações

## Overview

Milestone brownfield para tornar reservas, pagamentos, relatórios, agentes e
interface determinísticos sem trocar a arquitetura. O backend/PostgreSQL é a
fonte de verdade; dados legados são diagnosticados, não reparados
automaticamente.

## Entregue em 2026-09-13

- **Integridade:** transações, locks de quarto, versão otimista, constraint
  `tstzrange` `[)` e diagnóstico dry-run.
- **Ciclo de vida:** máquina de estados, horários do hotel, cancelamento lógico,
  eventos append-only e aliases legados compatíveis.
- **Financeiro:** cálculo em centavos, idempotência, saldo, reversões negativas
  compensatórias e exceções financeiras legadas.
- **Consultas:** schemas com allowlist/teto, paginação, busca estável, filtros
  civis inclusivos, ocupação por quarto-noite, receita reservada e recebimentos.
- **Agentes:** API key obrigatória, token interno, contexto HMAC do iniciador,
  allowlist, propostas com hash/TTL e confirmação humana antes de mutação.
- **UI:** disponibilidade fail-closed com `guestCount`, estados de rede,
  CPF mascarado, datas no fuso do hotel, agenda sem zoom/overflow global e
  dashboard com indicadores financeiros separados.
- **Dependências/documentação:** lockfiles auditados, Next atualizado e
  contratos/ADRs/inventário sincronizados.

## Verificação final

1. `cd backend && npm run build && npm test`
2. `cd backend && DB_HOST=127.0.0.1 DB_PORT=5433 npm run test:integration:db`
3. `cd frontend && npm run build && npm run lint && npm run test:reservation`
4. Compilar/testar agents dentro do Compose com `BACKEND_BEARER_TOKEN` e
   `AGENTS_API_KEY` configurados.
5. Executar `cd backend && npm run diagnose:reservations` antes/depois e
   confirmar que o diagnóstico não altera linhas.

## Próximos incrementos

- Limiter dedicado para login quando houver exposição pública.
- Remoção dos aliases PascalCase após inventário de consumidores.
- Persistência compartilhada de conversa/proposta antes de escalar agents.
- Playwright/E2E de componentes quando entrar no CI.

## Limites

Este projeto continua single-hotel. Cursor pagination, pagamentos online,
channel manager, multi-tenancy e app mobile permanecem fora deste milestone.
