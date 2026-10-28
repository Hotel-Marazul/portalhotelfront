## 1. Dependências

- [x] 1.1 Frontend: `npm audit fix` (sem `--force`), build, lint e testes.
- [x] 1.2 Backend: `npm audit fix` (sem `--force`), conferindo `qs`, `body-parser` e `proxy-addr`; adiamento do zod registrado no design.

## 2. Remover o chat do agente

- [x] 2.1 Backend: sai `/api/agent/*`, o token de serviço no `authMiddleware`, a allowlist do agente e `AGENTS_SERVICE_TOKEN`.
- [x] 2.2 Agents: saem `/chat`, `/tools`, `orchestration/`, `agents/`, `tools/backend_api.py`, os testes deles e `BACKEND_BEARER_TOKEN`; compose, `.env.example` e CLAUDE.md atualizados.

## 3. RBAC

- [ ] 3.1 Estorno de pagamento e exclusão de cliente só para `admin`; frontend esconde as duas ações da recepção.

## 4. Middlewares

- [ ] 4.1 `TRUST_PROXY_HOPS`, CORS recusado vira 403, mutação de outra origem vira 403, erro 500 vai para o log.
- [ ] 4.2 JWT só `HS256`; `JWT_SECRET` com 32 ou mais caracteres em produção; login com tempo constante e `skipSuccessfulRequests`.

## 5. Testes

- [ ] 5.1 `tests/integration/security-matrix.test.ts`: 401 sem token, 403 da recepção em toda rota admin, 401 com JWT falso ou `alg: none`, 403 com origem estranha, 401 com o token de serviço antigo.

## 6. Frontend e infra

- [ ] 6.1 Cabeçalhos de segurança no `next.config.ts` (CSP em report-only).
- [ ] 6.2 `docker-compose.prod.yaml`, `Caddyfile` e `.env.production.example`; só o Caddy publica portas.
- [ ] 6.3 Atualizar `.mente/bugs/bugs-conhecidos.md`.
