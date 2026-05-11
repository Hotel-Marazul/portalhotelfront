# Requirements — PortalHotel v1 (Stabilization Milestone)

**Gerado em:** 2026-05-11  
**Contexto:** Milestone de estabilização — corrigir bugs críticos e dívida técnica acumulada antes de novas features.

---

## v1 Requirements

### Integridade de Dados

- [ ] **DATA-01**: Criação de reserva usa transação DB atômica — crash não deixa reserva sem hóspedes
- [ ] **DATA-02**: Atualização de reserva usa transação DB atômica — delete de hóspedes antigos + insert de novos em uma transação
- [ ] **DATA-03**: Overbooking prevenido por constraint no banco — duas reservas sobrepostas para o mesmo quarto são impossíveis
- [ ] **DATA-04**: Dashboard exibe taxa de ocupação mensal real (dados históricos agregados por mês, não dados fake)

### Segurança

- [ ] **SEC-01**: Endpoint `POST /User/login` tem rate limit dedicado (máximo 10 req/15min por IP)
- [ ] **SEC-02**: Agente FastAPI exige API key em todas as requisições `/chat`
- [ ] **SEC-03**: Credenciais padrão (admin/admin) removidas de `docker-compose.yaml` e `env.ts`
- [ ] **SEC-04**: `BACKEND_BEARER_TOKEN` obrigatório nas configurações do agente (não opcional)

### Qualidade de Dados

- [ ] **QUA-01**: CPF validado com dígito verificador no backend (Zod schema)
- [ ] **QUA-02**: Usuário confirma detalhes antes do agente IA criar reserva no banco
- [ ] **QUA-03**: `backend/dist/` removido do git e adicionado ao `.gitignore`

### Performance

- [ ] **PERF-01**: `GET /Reservations` suporta paginação server-side (limit/offset)
- [ ] **PERF-02**: `GET /client` suporta paginação server-side (limit/offset)

### UI / UX

- [ ] **UI-01**: Botão "Ver Detalhes" em `/reservas` abre detalhes da reserva (não é mais no-op)

### Testes

- [ ] **TEST-01**: `calculateReservationTotal()` coberta por testes unitários Vitest (casos: sem hóspedes adicionais, com adulto, criança, bebê gratuito, múltiplos hóspedes)
- [ ] **TEST-02**: Lógica de disponibilidade coberta por testes de integração (overlap de datas, cancelada não bloqueia)
- [ ] **TEST-03**: Utilitários frontend cobertos por testes unitários (formatCurrency, calculateNights, validateCPF, maskCPF)

### Padronização de Código

- [ ] **CODE-01**: Rotas padronizadas para kebab-case lowercase — PascalCase routes deprecadas
- [ ] **CODE-02**: `frontend/src/app/testes/` removido do git (se rastreado) — confirmado não acessível em builds

---

## v2 Requirements (Deferred)

- Paginação cursor-based (após limit/offset funcionar)
- Testes E2E com Playwright
- Relatórios de receita por período
- Exportação de relatórios (PDF/Excel)
- Notificação de check-in/check-out por e-mail
- Integração com meios de pagamento
- App mobile

---

## Out of Scope

- Multi-tenant / SaaS — sistema para uso interno de um único hotel
- Channel manager (Booking.com, Airbnb) — fora deste milestone
- Revenue management automático — fora deste milestone
- Refatoração completa de ORM — mantendo `pg` pool com raw SQL

---

## Traceability

| REQ-ID | Fase | Status |
|--------|------|--------|
| DATA-01 | — | Pending |
| DATA-02 | — | Pending |
| DATA-03 | — | Pending |
| DATA-04 | — | Pending |
| SEC-01 | — | Pending |
| SEC-02 | — | Pending |
| SEC-03 | — | Pending |
| SEC-04 | — | Pending |
| QUA-01 | — | Pending |
| QUA-02 | — | Pending |
| QUA-03 | — | Pending |
| PERF-01 | — | Pending |
| PERF-02 | — | Pending |
| UI-01 | — | Pending |
| TEST-01 | — | Pending |
| TEST-02 | — | Pending |
| TEST-03 | — | Pending |
| CODE-01 | — | Pending |
| CODE-02 | — | Pending |

---
*Requirements definidos a partir da varredura do codebase em 2026-05-11*
