# Project State

## Project Reference

See: `.planning/PROJECT.md`.

**Core value:** Operacionalizar o dia-a-dia do hotel — reservas confiáveis, dados corretos, sem fricção.
**Current focus:** Hardening de operações de reserva e validação integrada.

## Current Position

Phase: harden-reservation-operations — implementação e verificação final
Status: implementação principal e verificação local concluídas; staging externo permanece gate explícito de promoção.
Last activity: 2026-09-14 — paginação, relatórios civis, UI fail-closed, idempotência, sanitização e rollback local verificados.

## Delivered

- PostgreSQL mantém a exclusão `[)` contra sobreposição, versão otimista,
  eventos append-only e diagnóstico somente leitura.
- Criação/edição/cancelamento e pagamentos usam transações; pagamentos têm
  idempotência e reversões compensatórias.
- Datas civis usam `America/Sao_Paulo`; preço, capacidade, disponibilidade e
  agregados são calculados no backend.
- Listagens têm filtros validados, paginação, busca estável e CPF mascarado.
- Gateway do agente exige sessão do usuário, segredo interno e contexto HMAC;
  propostas de mutação exigem confirmação explícita.
- Frontend diferencia receita reservada de recebimentos, preserva estados de
  loading, erro, vazio e conflito, revalida disponibilidade no envio e bloqueia
  submissões simultâneas com chaves idempotentes.
- O agente tem `AGENTS_MUTATIONS_ENABLED` fail-closed para rollback sem
  interromper consultas; prompts, respostas e logs sanitizam sentinelas sensíveis.

## Verification Matrix

| Área | Comando/evidência | Estado |
|---|---|---|
| Backend TypeScript | `cd backend && npm run build` | verde |
| Backend unitário | `cd backend && npm test` | verde — 14 testes |
| PostgreSQL | `DB_HOST=127.0.0.1 DB_PORT=5433 npm run test:integration:db` | verde — 9 suítes de integração com banco real |
| Frontend | `npm run build`, `npm run lint`, `npm run test:reservation` | verde — build, lint e 19 testes |
| Agents | `compileall` e 5 scripts em Docker | verde — booking, HTTP/auth, overbooking, RAG e rollback flag |
| Logs de agents | inspeção de `agents/logs/agents.log` após os testes | verde — 134 linhas JSON, 0 linhas com CPF/credencial/token/cookie detectáveis |
| Dependências | `npm audit --omit=dev --audit-level=high` em backend/frontend | verde — zero vulnerabilidades altas/críticas no runtime |
| Dados legados | `npm run diagnose:reservations` | verde — dry-run; sobrepagamento legado de 10,00 preservado para revisão |
| Compose/gateway | login, `/api/User/me`, saúde e chat de política autenticado | verde — 200; FastAPI direto sem chave retornou 401 e com chave 200; agente retornou `answer_policy` |
| UI por papel | Chrome local admin/manager em desktop e headless responsivo | verde — admin requisitou/renderizou finanças; manager não requisitou/não exibiu finanças; sem overflow horizontal |
| OpenSpec | `openspec validate ... --strict` nos dois changes | verde — ambos válidos |

## Blockers/Concerns

- Host usa `db-marazul` somente dentro do Compose; integração local precisa de
  `DB_HOST=127.0.0.1 DB_PORT=5433`.
- Python local não tem `pytest`, `httpx` nem comando `python`; usar o container
  dos agents para a suíte.
- O estado de conversa/proposta do FastAPI é em memória; escalar horizontalmente
  exige armazenamento compartilhado com TTL.
- aliases PascalCase permanecem por compatibilidade; novas rotas devem ser
  kebab-case.
- Não houve staging externo nesta sessão; os testes de relatório e rollback
  foram executados no Compose local como staging-equivalente. A promoção exige
  repetir a matriz com contas e dados controlados no staging real.

## Deferred Items

| Item | Motivo |
|---|---|
| Cursor pagination | OFFSET com teto é suficiente para o milestone; avaliar em v2. |
| Playwright/E2E de componentes | smoke e scripts de lógica cobrem o contrato atual; adicionar quando houver infraestrutura. |
| Limiter dedicado de login | rate limit global já existe; separar quando o endpoint for exposto publicamente. |

## Next Steps

1. Revisar/aprovar manualmente o sobrepagamento legado e timestamps sinalizados;
   nenhuma correção automática foi executada.
2. Repetir a matriz visual, o smoke do agente e o procedimento de rollback em
   staging externo antes da promoção.
3. Revisar/aprovar as anomalias legadas registradas no dry-run; nenhuma
   correção automática deve ser executada sem decisão explícita.
