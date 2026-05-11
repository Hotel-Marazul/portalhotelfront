# Concerns & Risks

**Analysis Date:** 2026-05-11

---

## Summary

The codebase is reasonably well-structured but carries several important risks:
- **Critical**: Reservation creation/update runs multiple sequential queries with no database transaction — a partial failure leaves data inconsistent.
- **Critical**: Database credentials (`admin`/`admin`) are hardcoded in `docker-compose.yaml` and committed to git in `.env.example` defaults.
- **High**: The entire `/testes/` route tree (with hardcoded mock data) is committed source code reachable in development builds, and the `.gitignore` only ignores it at specific path prefixes.
- **High**: The dashboard `taxaOcupacaoMes` field is fake — the API always returns the same three-month snapshot with a single repeated rate value, not real historical data.
- **Medium**: `backend/dist/` compiled output is committed to git, causing source-of-truth drift.
- **Medium**: No rate-limiting on the auth `/User/login` endpoint specifically; the global 200 req/15 min limiter is shared across all routes.
- **Medium**: The agents service accepts chat requests with no authentication — any caller on port 5051 can trigger LLM calls and backend mutations.

---

## Critical Issues

### No Database Transaction on Reservation Create/Update

**What happens:** `POST /Reservations` and `PUT /Reservations/:id` issue the availability check, the reservation `INSERT`/`UPDATE`, and each `reservation_guests` `INSERT` as separate uncoordinated `pool.query()` calls.

**Files:** `backend/src/modules/reservations/reservations.routes.ts` lines 303–327 (create) and 408–434 (update)

**Impact:** If the server crashes or the DB connection drops after the reservation row is written but before all guest rows are inserted, the reservation exists with an incomplete guest list. For the update path, guests are deleted first (line 425) then re-inserted one-by-one — a crash here produces a reservation with zero guests. There is no `BEGIN`/`COMMIT`/`ROLLBACK` envelope.

**Fix approach:** Acquire a `pool.connect()` client, wrap all mutations in `BEGIN` … `COMMIT` with a `ROLLBACK` in the catch block. The seed file (`backend/src/db/seed.ts`) already demonstrates this pattern correctly.

---

### Race Condition on Availability Check → Reservation Insert

**What happens:** `ensureRoomIsAvailable()` queries for conflicts, returns "no conflict", then a separate `INSERT` follows. Between those two operations a concurrent request can pass the same availability check and both create overlapping reservations for the same room.

**Files:** `backend/src/modules/reservations/reservations.routes.ts` lines 93–116 and 276–316

**Impact:** Overbooking — two guests are assigned to the same room for the same dates. The DB has no unique constraint on `(room_id, check_in_date, check_out_date)` to catch this at write time.

**Fix approach:** Use a `SELECT … FOR UPDATE` lock on the room row inside a transaction, or add a partial unique index / exclusion constraint using `tsrange` on `reservations(room_id, check_in_date, check_out_date)` to enforce mutual exclusion at the DB level.

---

### Fake / Placeholder Data Returned in Production API

**What happens:** `GET /reservations/counter-summary` computes the *current* occupancy rate and returns it three times as a fake three-month chart:

```typescript
// backend/src/modules/reservations/reservations.routes.ts lines 511-515
taxaOcupacaoMes: [
  { mes: "Jan", taxa: occupancyRate },
  { mes: "Fev", taxa: occupancyRate },
  { mes: "Mar", taxa: occupancyRate }
],
```

**Impact:** The dashboard occupancy chart always shows three identical bars. The data is misleading and cannot serve as a real business metric.

**Fix approach:** Aggregate `check_in_date` by month with a `date_trunc('month', …)` group and compute monthly occupancy from historical reservations.

---

## Security Concerns

### Hardcoded Default Credentials in docker-compose.yaml

**What:** `docker-compose.yaml` lines 44–46 and 87–89 set `DB_USER=admin`, `DB_PASSWORD=admin`, `PGADMIN_DEFAULT_PASSWORD=admin` as plaintext. These same defaults appear in `backend/.env.example` and `backend/src/config/env.ts` (`DB_PASSWORD: z.string().default("admin")`).

**Files:** `docker-compose.yaml`, `backend/src/config/env.ts` line 15, `backend/.env.example`

**Risk:** Default credentials are committed to source control. Any developer who runs `docker compose up` without overriding env vars will expose the DB with a trivially guessable password. If the `.env` files were ever accidentally committed (the `.gitignore` rule exists but is path-specific), credentials would be in git history.

**Recommendation:** Remove all credential defaults from `env.ts`. Require `DB_PASSWORD` to be explicitly set (use `z.string().min(1)` with no `.default()`). Move Compose credentials to a `.env.compose` file listed in `.gitignore`.

---

### No Auth on Agents Service — LLM & Backend API Exposed

**What:** The FastAPI agents service (`agents/app/router.py`) exposes `/chat` and `/health` with no authentication. `POST /chat` proxies through to the backend API and can create, update, and delete reservations.

**Files:** `agents/app/router.py`, `frontend/src/app/api/agents/chat/route.ts`

**Risk:** Anyone who can reach port 5051 (exposed as `5051:5050` in `docker-compose.yaml`) can send arbitrary chat messages that trigger backend mutations. `BACKEND_BEARER_TOKEN` is optional (`${BACKEND_BEARER_TOKEN:-}`) so in the default Docker setup the agents service calls the backend with no token — relying solely on the backend's own `authMiddleware` while the agents endpoint itself is open.

**Recommendation:** Add an API key check to the agents FastAPI router. Require `BACKEND_BEARER_TOKEN` to be set (make it non-optional in settings validation).

---

### JWT Cookie Not `Secure` in Development; Middleware Parses JWT Client-Side

**What:** The auth cookie is set with `secure: env.NODE_ENV === "production"` — correct. However, the Next.js middleware (`frontend/middleware.ts`) decodes the JWT payload client-side (Base64 split) to check expiry without verifying the signature. An attacker who can manipulate localStorage or the cookie value could craft a non-expired token payload that passes the middleware redirect check (though the backend will still reject it).

**Files:** `frontend/middleware.ts` lines 6–17

**Risk:** Low (backend validates correctly), but the frontend middleware gives a false sense of security. Expired/tampered tokens that still have a future `exp` will not trigger a redirect until the backend returns 401.

**Recommendation:** Treat the middleware as UX-only (redirect to login for missing token) and remove the expiry parsing. Let the backend 401 response drive the client-side redirect via the axios interceptor in `frontend/src/services/api.ts`.

---

### Global Rate Limit Shared Across All Endpoints

**What:** `backend/src/middlewares/security.ts` applies a single 200 req / 15 min rate limit across all routes including `POST /User/login`.

**Files:** `backend/src/middlewares/security.ts`

**Risk:** An attacker can attempt ~200 password guesses per 15 minutes from a single IP before hitting the limit. This is insufficient for a credential endpoint.

**Recommendation:** Apply a stricter dedicated limiter (e.g., 10 req / 15 min) specifically on `POST /User/login`.

---

### PGAdmin Exposed with Default Credentials

**What:** `docker-compose.yaml` lines 100–104 expose PGAdmin on port 5050 with `PGADMIN_DEFAULT_EMAIL=admin@admin.com` and `PGADMIN_DEFAULT_PASSWORD=admin`.

**Files:** `docker-compose.yaml`

**Risk:** Full database GUI access with trivially guessable credentials, reachable on the host machine.

**Recommendation:** Remove PGAdmin from docker-compose or restrict to a separate dev-only profile. Never use default credentials.

---

## Tech Debt

### Committed Build Artifacts (`backend/dist/`)

**What:** The entire TypeScript compilation output lives at `backend/dist/` and is present in the working tree (and likely in git history — the root `.gitignore` does not exclude `backend/dist/`).

**Files:** `backend/dist/` (30 JS files mirroring `backend/src/`)

**Impact:** Source of truth confusion — edits to `src/` may not match `dist/` if a build step is skipped. CI/CD may accidentally run stale compiled code.

**Fix approach:** Add `backend/dist/` to `.gitignore`. Regenerate on build step only.

---

### Duplicate Route Casing (Mixed PascalCase and lowercase URL paths)

**What:** Several resources expose duplicate routes under different casing:
- Rooms: `/rooms` (lowercase) AND `/Rooms` (PascalCase) — `backend/src/modules/rooms/rooms.routes.ts` lines 128–153
- Reservations: `/Reservations` (PascalCase) — `backend/src/modules/reservations/reservations.routes.ts` line 239
- Auth: `/User/login` (PascalCase) — `backend/src/modules/auth/auth.routes.ts` line 11
- Pricing rules: `/GuestPricingRule` and `/pricing-rules` — `backend/src/modules/pricing-rules/pricing-rules.routes.ts`

**Impact:** Two live endpoints for the same data; any middleware, caching, or logging that is path-sensitive will behave inconsistently. Callers must know which casing to use.

**Fix approach:** Standardize on lowercase kebab-case REST paths. Deprecate and remove the PascalCase variants.

---

### Two Separate `apiService.ts` / `api.ts` Files

**What:** `frontend/src/services/api.ts` provides the configured Axios client. `frontend/src/services/apiService.ts` wraps it with generic `apiGet` / `apiPost` helpers. Pages use both directly.

**Files:** `frontend/src/services/api.ts`, `frontend/src/services/apiService.ts`

**Impact:** `apiService.ts` only covers GET and POST — PUT and DELETE are not wrapped — so components import `apiClient` directly anyway. The wrapper adds indirection with no benefit.

**Fix approach:** Delete `apiService.ts` and use `apiClient` directly everywhere, or expand the service to cover all methods.

---

### `/testes/` Route Tree Committed as Source Code

**What:** `frontend/src/app/testes/` contains 10 test/scaffold pages using hardcoded mock data. The `.gitignore` lists `frontend/src/app/testes/` but the files exist in the working tree (the gitignore rule would prevent adding new files but the existing files may already be tracked).

**Files:** All files under `frontend/src/app/testes/` (10 pages)

**Impact:** In a Next.js App Router build these routes are compiled and reachable at runtime (e.g., `/testes/quartos/tabela-quartos`). They render with fake data and no authentication wrapper.

**Fix approach:** Confirm the files are not git-tracked (`git ls-files frontend/src/app/testes/`). If tracked, remove them with `git rm -r`. Do not rely on `.gitignore` to hide already-tracked files.

---

### `Visibility` Button in `/reservas` Page Is a No-Op

**What:** `frontend/src/app/reservas/page.tsx` line 337 renders a "ver" `IconButton` with no `onClick` handler. The view action is silently ignored.

**Files:** `frontend/src/app/reservas/page.tsx` line 337

**Impact:** Users click "Ver Detalhes" and nothing happens. The feature is incomplete.

---

### Pricing Calculation Skips First Guest

**What:** `backend/src/utils/reservation.ts` lines 22–31: the loop starts charging from guest index `>= INCLUDED_ADDITIONAL_GUESTS` (value: 1), meaning the **first guest is always free** regardless of their age or pricing rule. This is business logic embedded as a magic constant with no documentation.

**Files:** `backend/src/utils/reservation.ts`

**Impact:** If the business rule changes, this magic number has no tests covering the edge. The `reservations.routes.ts` consumes it without any comment explaining the "first guest included" rule.

---

## Performance Risks

### `GET /Reservations` Fetches All Rows Without Pagination

**What:** `backend/src/modules/reservations/reservations.routes.ts` line 186–209: `getReservationsByIds()` with no filter runs `SELECT … FROM reservations` with no `LIMIT`. The frontend then loads the entire dataset into state and filters/pages it client-side.

**Files:** `backend/src/modules/reservations/reservations.routes.ts`, `frontend/src/app/reservas/page.tsx`

**Impact:** As reservation count grows, the payload becomes arbitrarily large. The N+1 guest fetch is avoided (batch by reservation IDs), but the initial query has no bound.

**Fix approach:** Add `LIMIT`/`OFFSET` or cursor-based pagination to the backend endpoint. Pass filter parameters (status, date range, clientId) as server-side query params.

---

### `GET /client` Fetches All Clients With All Their Reservations

**What:** `backend/src/modules/clients/clients.routes.ts` `GET /client` loads every client, then batch-fetches all reservations and all guests for all of them in one response.

**Files:** `backend/src/modules/clients/clients.routes.ts` lines 175–188

**Impact:** With many clients, this produces a massive deeply-nested JSON payload. No pagination exists.

**Fix approach:** Paginate the client list. Lazy-load reservations per-client on demand (already available via `GET /client/:id`).

---

### All Pricing Rules Fetched on Every Reservation Create/Update

**What:** Both `POST /Reservations` and `PUT /Reservations/:id` run `SELECT * FROM pricing_rules` on every request to calculate the total price.

**Files:** `backend/src/modules/reservations/reservations.routes.ts` lines 278–284 and 384–390

**Impact:** Unnecessary DB query on every reservation write. Pricing rules change rarely.

**Fix approach:** Cache pricing rules in memory with a short TTL, or denormalize the price calculation at the application layer.

---

### No Input Debounce on Search Filters

**What:** Filter components in the reservations page trigger re-render and client-side re-filtering on every keystroke via `onFiltersChange`. There is no debounce.

**Files:** `frontend/src/app/reservas/page.tsx` lines 272–281

**Impact:** Minor in current scale, but will degrade as dataset grows. When server-side filtering is added, this will cause a network request per keystroke.

---

## Missing Coverage

### No Backend Tests

**What:** `backend/` has no test files. There is no Jest/Vitest config. The only tests in the project are in `agents/tests/` (3 Python test files).

**Files:** `backend/` (entire directory has no `*.test.ts` or `*.spec.ts`)

**Impact:** Core business logic — availability checking, pricing calculation, overbooking prevention — has no automated regression protection. The race condition and transaction bugs above would be caught by integration tests.

---

### Frontend Has No Tests

**What:** `frontend/` has no test files and no test runner configuration.

**Files:** `frontend/` (no `*.test.tsx`, `*.spec.tsx`, Jest or Vitest config)

**Impact:** Component rendering, form validation, and state management changes can silently regress.

---

### Agent Booking Flow Has No Confirmation Step

**What:** `agents/orchestration/flows.py` `run_booking()` creates a reservation immediately upon recognizing the intent. There is no "confirm this reservation?" round-trip before committing.

**Files:** `agents/orchestration/flows.py` lines 122–191

**Impact:** A misunderstood message (wrong room ID or date) results in an actual reservation being created in the DB. The user must manually cancel it.

---

### CPF Not Validated for Format on Backend

**What:** `backend/src/modules/clients/clients.schema.ts` (Zod schema) normalizes CPF to digits but does not validate the CPF check-digit algorithm. Any 11-digit string is accepted.

**Files:** `backend/src/modules/clients/clients.schema.ts`

**Impact:** Invalid CPFs can be stored, causing data quality issues and potential problems with downstream integrations.

---

## TODOs & FIXMEs

### Placeholder API Call Comments in Test Pages

**Files:**
- `frontend/src/app/testes/categorias/criar-categorias/page.tsx` line 9: `// exemplo de chamada real: // await apiClient.post("/quartos", novaCategoria);`
- `frontend/src/app/testes/quartos/criar-quartos/page.tsx` line 9: same pattern

**Impact:** These pages do nothing on form submit — `handleCreate` only calls `console.log`. They are nonfunctional scaffolds left in committed source.

---

### `console.error` Used as Error Reporting Throughout Frontend

**What:** Error handling in components like `ReservationsTable.tsx` (line 87), `ReservationDrawer.tsx` (line 193), `ModalHospede.tsx` (line 113), `EditarCategorias.tsx` (line 76) logs errors to `console.error` only. There is no structured error reporting or user-visible feedback in many of these branches.

**Files:** Multiple files under `frontend/src/components/`

**Impact:** Errors in production are silent from the user perspective and lost without browser dev tools open.

---

### Seed File Logs Credentials to stdout

**What:** `backend/src/db/seed.ts` lines 395–397 print `console.log("Usuario admin: admin@hotel.com / admin")` and `console.log("Usuario manager: manager@hotel.com / admin")` as part of normal output.

**Files:** `backend/src/db/seed.ts`

**Impact:** If CI/CD logs are stored or publicly visible, seed credentials appear in log output. Even though these are dev credentials, the pattern establishes a bad habit.

---

*Concerns audit: 2026-05-11*
