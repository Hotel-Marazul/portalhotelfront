# Roadmap: PortalHotel — Stabilization Milestone

## Overview

This milestone stabilizes a functional but fragile hotel reservation system. The work proceeds in severity order: critical data-integrity bugs first, security hardening second, data-quality and agent-safety fixes third, performance and UX improvements fourth, automated test coverage fifth, and code-hygiene cleanup last. No new features are added until every phase here is complete.

## Phases

- [ ] **Phase 1: Data Integrity** - Fix atomic DB transactions and prevent overbooking at the database level
- [ ] **Phase 2: Security Hardening** - Lock down credentials, add auth to the agents service, and enforce login rate-limiting
- [ ] **Phase 3: Data Quality & Agent Safety** - Validate CPF check-digits, add booking confirmation step, and remove committed build artifacts
- [ ] **Phase 4: Performance & UX** - Add server-side pagination to reservations and clients, fix the "Ver Detalhes" no-op button
- [ ] **Phase 5: Test Coverage** - Add Vitest unit and integration tests for backend pricing/availability logic and frontend utilities
- [ ] **Phase 6: Code Cleanup** - Standardize routes to kebab-case and remove the committed `/testes/` scaffold

## Phase Details

### Phase 1: Data Integrity
**Goal**: Reservation writes are fully atomic and overbooking is structurally impossible
**Depends on**: Nothing (first phase)
**Requirements**: DATA-01, DATA-02, DATA-03, DATA-04
**Success Criteria** (what must be TRUE):
  1. A server crash mid-reservation-create leaves no orphan row — the partial write is fully rolled back
  2. A server crash mid-reservation-update leaves guest list intact — either all new guests replace old, or none do
  3. Two simultaneous requests for the same room and overlapping dates result in exactly one accepted reservation and one conflict error
  4. The dashboard occupancy chart shows three distinct historical monthly rates drawn from real `check_in_date` data, not a repeated single value
**Plans**: 3 plans

Plans:
- [ ] 01-01-PLAN.md — Atomic POST /Reservations with FOR UPDATE overbooking guard (DATA-01, DATA-03)
- [ ] 01-02-PLAN.md — Atomic PUT /Reservations/:id guest list replace-or-rollback (DATA-02)
- [ ] 01-03-PLAN.md — Real monthly occupancy aggregation for dashboard counter-summary (DATA-04)

### Phase 2: Security Hardening
**Goal**: Default credentials are gone, the agents service is authenticated, and brute-force login attempts are rate-limited
**Depends on**: Phase 1
**Requirements**: SEC-01, SEC-02, SEC-03, SEC-04
**Success Criteria** (what must be TRUE):
  1. Running `docker compose up` without a custom `.env` fails to start rather than defaulting to `admin`/`admin` credentials
  2. A `POST /chat` request to the agents service without a valid API key receives a 401 or 403 response
  3. Sending 11 login attempts in 15 minutes from the same IP returns a 429 on the 11th request
  4. `BACKEND_BEARER_TOKEN` missing from agents config causes service startup to fail with a descriptive error
**Plans**: TBD

### Phase 3: Data Quality & Agent Safety
**Goal**: Invalid CPFs cannot be stored, the AI agent asks for confirmation before committing bookings, and build artifacts are out of git
**Depends on**: Phase 2
**Requirements**: QUA-01, QUA-02, QUA-03
**Success Criteria** (what must be TRUE):
  1. Submitting a client with a CPF that fails the check-digit algorithm returns a 422 validation error from the backend
  2. When a user describes a booking via the AI chat, the agent replies with a summary and asks "Confirmar reserva?" before writing anything to the DB
  3. `git ls-files backend/dist/` returns empty output and `backend/dist/` is listed in `.gitignore`
**Plans**: TBD

### Phase 4: Performance & UX
**Goal**: Large datasets do not cause unbounded queries, and the "Ver Detalhes" button in reservations opens reservation details
**Depends on**: Phase 3
**Requirements**: PERF-01, PERF-02, UI-01
**Success Criteria** (what must be TRUE):
  1. `GET /Reservations?page=2&limit=20` returns exactly 20 records with a total-count field, and only page 2 rows
  2. `GET /client?page=1&limit=10` returns exactly 10 client records without embedding all reservations for each client
  3. Clicking "Ver Detalhes" on any reservation row in `/reservas` opens a view or drawer showing that reservation's details
**UI hint**: yes
**Plans**: 3 plans

Plans:
- [ ] 04-01-PLAN.md — PERF-01: paginacao server-side GET /Reservations + migracao frontend /reservas + fix useCachedFetch em /cliente
- [ ] 04-02-PLAN.md — PERF-02: paginacao server-side GET /client + migracao frontend createUserTable (reservations embedded como [])
- [ ] 04-03-PLAN.md — UI-01: wiring do botao Ver Detalhes para ReservationDrawer em mode=view

### Phase 5: Test Coverage
**Goal**: Core backend business logic and key frontend utilities are protected by automated Vitest tests
**Depends on**: Phase 1
**Requirements**: TEST-01, TEST-02, TEST-03
**Success Criteria** (what must be TRUE):
  1. Running `vitest` in `backend/` executes tests for `calculateReservationTotal()` covering: no additional guests, one adult, one child, one free infant, and multiple mixed guests — all pass
  2. Running `vitest` in `backend/` executes integration tests confirming overlapping active reservations fail availability check and a cancelled reservation does not block the same dates
  3. Running `vitest` in `frontend/` executes tests for `formatCurrency`, `calculateNights`, `validateCPF`, and `maskCPF` — all pass
**Plans**: TBD

### Phase 6: Code Cleanup
**Goal**: All backend routes use lowercase kebab-case and the committed test scaffold is removed from git
**Depends on**: Phase 4
**Requirements**: CODE-01, CODE-02
**Success Criteria** (what must be TRUE):
  1. All API calls from the frontend use kebab-case paths (e.g., `/reservations`, `/user/login`) and PascalCase variants return 404 or are removed from the router
  2. `git ls-files frontend/src/app/testes/` returns empty output and the `/testes/*` routes are unreachable in development builds
**Plans**: TBD

## Progress

**Execution Order:** 1 → 2 → 3 → 4 → 5 → 6
*(Phase 5 may run in parallel with Phases 3-4 once Phase 1 is complete)*

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Data Integrity | 0/3 | Not started | - |
| 2. Security Hardening | 0/TBD | Not started | - |
| 3. Data Quality & Agent Safety | 0/TBD | Not started | - |
| 4. Performance & UX | 0/3 | Not started | - |
| 5. Test Coverage | 0/TBD | Not started | - |
| 6. Code Cleanup | 0/TBD | Not started | - |
