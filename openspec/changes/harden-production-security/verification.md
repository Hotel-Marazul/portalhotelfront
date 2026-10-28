# Verificação: harden-production-security

Data: 2026-10-28 · Commit: 269c286

## Resultado
APROVADA COM RESSALVAS. Todos os requisitos estão implementados e a matriz de segurança passa. As falhas que apareceram nas outras suítes já existiam no commit anterior à change (`7ec41d6`), com o mesmo resultado.

## Requisitos
| Requisito / cenário | Onde | Teste | Status |
|---|---|---|---|
| Operações irreversíveis só para admin | `requireRole("admin")` antes de `validate` e do handler | `security-matrix.test.ts:129` (todas as rotas admin → 403) | ✅ |
| ↳ Recepção tenta estornar → 403, sem lançamento | `backend/src/modules/reservations/reservations.routes.ts:690`; UI esconde a ação em `frontend/src/components/reservations/ReservationDrawer.tsx:552` | `security-matrix.test.ts:129` confere o 403. O "nenhum lançamento" vem da ordem dos middlewares: o 403 sai antes de abrir transação. Não há asserção sobre a tabela. | ✅ |
| ↳ Recepção tenta excluir cliente → 403, cliente fica | `backend/src/modules/clients/clients-delete.routes.ts:14`; UI em `frontend/src/components/hospedes/GuestProfile.tsx:60` | `security-matrix.test.ts:129` (mesma observação: o teste não lê o banco depois) | ✅ |
| Sem caminho de IA que altere reservas | `/api/agent/*` não é montado em `backend/src/routes/index.ts`; `authMiddleware` só aceita JWT (`backend/src/middlewares/auth.middleware.ts:38`); agents sem `/chat` | `security-matrix.test.ts:134` (`/agent/chat` e `/agent/health` → 404); `agents/tests/test_http_auth.py:17` (`/chat` → 404) | ✅ |
| ↳ Token de serviço antigo → 401 | `auth.middleware.ts:37-48` (qualquer token que não seja JWT válido → 401) | `security-matrix.test.ts:117` | ✅ |
| Sessão confiável | `backend/src/utils/jwt.ts:23` (assina HS256) e `:29` (`algorithms: ["HS256"]`); `JWT_SECRET` ≥ 32 em produção em `backend/src/config/env.ts:113` | `security-matrix.test.ts:112-126` | ✅ |
| ↳ JWT `alg: none` ou segredo errado → 401 | `jwt.ts:29` | `security-matrix.test.ts:114-115` (também expirado) | ✅ |
| ↳ Mutação de outra origem → 403 | `backend/src/config/cors.ts:8-14` (vale para qualquer método) | `security-matrix.test.ts:141` | ✅ |

Itens do design também conferidos no código: `TRUST_PROXY_HOPS` (`backend/src/app.ts:10`), erro 500 logado (`backend/src/middlewares/error-handler.ts:64`), login em tempo constante com hash fictício (`backend/src/modules/auth/auth.service.ts:8,29`, teste em `security-matrix.test.ts:159`), `skipSuccessfulRequests` (`backend/src/modules/auth/auth.routes.ts:15`), cookie HttpOnly e SameSite=Lax (`security-matrix.test.ts:167`), cabeçalhos e CSP report-only (`frontend/next.config.ts:24-29`), só o Caddy publica portas (`docker-compose.prod.yaml:13`, `docker/caddy/Caddyfile`).

## Testes executados
- `cd backend && npm run build` → passou. Antes precisou de `chown` do `dist/` via container, porque dois arquivos eram de root.
- `cd backend && npm test` → passou (90 testes).
- `cd backend && npm run test:integration:db` com `DB_PORT=5434 DB_NAME=portal_hotel_test`, arquivo por arquivo:
  - 36 de 39 arquivos passam, incluindo `security-matrix`, `user-roles`, `admin-financial-access`, `reservation-payments` e `whatsapp-roles`.
  - Falham `seasonal-tariffs`, `whatsapp-ai` (caso 2: preço da cotação `undefined` ≠ `'246.00'`) e `whatsapp-episodes` (id de atendimento diferente). As três falham igual em `7ec41d6`, com banco zerado.
  - `reservation-contracts` falha com banco sujo e passa com banco zerado.
- `cd frontend && npm run lint` → passou.
- `cd frontend && npm run test:reservation` → 154 de 155 passam. Falha o teste 120 (`reservation-ui-contract.test.mjs:39`, espera `guestCount: String(totalGuestCount)`). O commit `a139bb0` tirou essa string, antes desta change, e o teste falha igual em `7ec41d6`.
- `agents`: `pytest` em `python:3.12-slim` com `AGENTS_API_KEY` de teste → passou (13 testes).
- `openspec validate harden-production-security --strict` → válida.

## Ressalvas
- 4 falhas anteriores à change, fora do escopo de segurança: `seasonal-tariffs`, `whatsapp-ai` caso 2, `whatsapp-episodes` e o teste 120 do frontend. Precisam de change própria.
- Nos cenários de RBAC, o teste confere o 403 mas não lê o banco depois. Que nada é gravado decorre da ordem dos middlewares e não é provado por asserção.
- O `.env` do backend aponta para `DB_PORT=5433` e o banco local escuta em 5434. Não existia banco `*_test`: criei um para rodar e apaguei no fim. O script `test:integration:db` não funciona sem esses ajustes.
- Vários testes de integração não limpam o que gravam (`reservation-contracts` só passa com banco zerado).
- Aviso do audit: "completa sem verification.md". Este arquivo resolve o aviso.
- Não verificado: Caddy e compose de produção rodando de fato (TLS, portas). Não há domínio ainda.
