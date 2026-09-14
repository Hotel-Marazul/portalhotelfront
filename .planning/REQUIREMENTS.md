# Requirements — PortalHotel v1 (Stabilization Milestone)

**Atualizado:** hardening de operações de reserva e acesso financeiro por papel.

Os requisitos abaixo refletem o código atual e a matriz de verificação executada.
`Parcial` identifica uma proteção ou validação ainda dependente de staging ou de
uma decisão futura; não significa que a implementação atual esteja quebrada.

## v1 Requirements

### Integridade de Dados

- [x] **DATA-01**: Criação de reserva usa transação DB atômica — crash não deixa reserva sem hóspedes.
- [x] **DATA-02**: Atualização de reserva usa transação DB atômica — delete de hóspedes antigos + insert de novos em uma transação.
- [x] **DATA-03**: Overbooking prevenido por constraint no banco — duas reservas sobrepostas para o mesmo quarto são impossíveis.
- [x] **DATA-04**: Dashboard exibe taxa de ocupação mensal real, com dados históricos agregados por mês e quarto-noites civis.

### Segurança

- [x] **SEC-01**: `POST /User/login` usa rate limit dedicado de no máximo 10 requisições por 15 minutos por IP, além do limite global.
- [x] **SEC-02**: Agente FastAPI exige API key em todas as requisições operacionais.
- [x] **SEC-03**: Credenciais padrão foram removidas de `docker-compose.yaml` e dos exemplos/configuração do backend.
- [x] **SEC-04**: `BACKEND_BEARER_TOKEN` é obrigatório nas configurações do agente.

### Qualidade de Dados

- [x] **QUA-01**: CPF é validado com dígito verificador no backend.
- [x] **QUA-02**: O usuário confirma detalhes antes de o agente IA criar reserva no banco.
- [x] **QUA-03**: `backend/dist/` não é fonte versionada e está coberto pelo `.gitignore`.

### Performance

- [x] **PERF-01**: `GET /Reservations` suporta paginação server-side com teto, total e ordenação estável.
- [x] **PERF-02**: `GET /client` suporta paginação server-side com teto, total e ordenação estável.

### UI / UX

- [x] **UI-01**: Botão "Ver Detalhes" em `/reservas` abre o drawer de detalhes da reserva.

### Testes

- [x] **TEST-01**: Cálculo de preço/noites é coberto por testes unitários `node:test` no backend.
- [x] **TEST-02**: Disponibilidade e constraint são cobertas por testes de integração com PostgreSQL real.
- [x] **TEST-03**: Utilitários frontend são cobertos por testes `node:test` para moeda, noites, CPF e máscara.

### Padronização de Código

- [ ] **CODE-01 — Compatibilidade**: Rotas novas usam kebab-case lowercase; aliases PascalCase permanecem temporariamente para consumidores legados.
- [x] **CODE-02**: `frontend/src/app/testes/` não está presente nem é gerado no build atual.

## Itens dependentes de validação externa

- [ ] **STAGE-01**: Validar em staging filtros, fuso, seis noites, ocupação, receita, recebimentos, pendências e contas `admin`/`manager`.
- [ ] **STAGE-02**: Validar visualmente desktop/mobile, busca acima de cem clientes e todos os estados de erro com dados não pessoais.
- [ ] **STAGE-03**: Ensaiar rollback por imagem e desabilitação de mutações do agente sem restauração destrutiva de dados.

## Fora de escopo ou adiados

- Paginação cursor-based (OFFSET com teto é suficiente neste milestone).
- Limiter dedicado de login, até exposição além da rede operacional justificar a mudança.
- Testes E2E de componentes React, até haver infraestrutura de navegador no CI.
- Exportação de relatórios, notificações por e-mail, integração de pagamentos online e app mobile.
- Multi-tenant, channel manager e revenue management automático.

## Traceability

| REQ-ID | Status | Evidência |
|--------|--------|-----------|
| DATA-01–04 | Done | Rotas transacionais, constraint `[)`, SQL de ocupação e testes backend |
| SEC-01 | Done | `loginRateLimit` dedicado em `auth.routes.ts` |
| SEC-02–04 | Done | Router FastAPI, settings obrigatórias, gateway/HMAC e scripts Docker |
| QUA-01–03 | Done | Schema CPF, confirmação do agente, `.gitignore` e auditoria |
| PERF-01–02 | Done | Schemas de query, `page/pageSize/total` e testes de contrato |
| UI-01 | Done | `ReservationsTable` → `ReservationDrawer`, build frontend |
| TEST-01–03 | Done | `node:test`, PostgreSQL real e 16 testes frontend |
| CODE-01 | Partial | Rotas novas padronizadas; aliases históricos preservados |
| CODE-02 | Done | Diretório ausente e build sem a rota |
| STAGE-01–03 | Pending | Requer ambiente staging e procedimento operacional |

---
*Requisitos derivados da auditoria do codebase e atualizados após a matriz final.*
