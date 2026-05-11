# Testing Patterns

**Analysis Date:** 2026-05-11

## Test Framework

**Runner:** None configured in application code.

No test runner (Jest, Vitest, Playwright, Cypress) is installed in either `frontend/package.json` or `backend/package.json`. No test configuration files (`jest.config.*`, `vitest.config.*`, `playwright.config.*`) are present in either workspace.

The only `*.test.*` and `*.spec.*` files found in the repository are inside `backend/node_modules/zod/` (Zod's own library tests, not application tests).

**Assertion Library:** None.

**Run Commands:** No test scripts defined. Neither workspace has a `"test"` script in `package.json`.

---

## Test Coverage

**Current State:** 0% — no application tests of any kind exist.

---

## Manual / Exploratory Testing Infrastructure

While no automated tests exist, the codebase contains infrastructure that was likely used for manual and exploratory testing:

**Testes pages (frontend):**
- `frontend/src/app/testes/` directory contains isolated component exploration pages:
  - `testes/categorias/criar-categorias/page.tsx`
  - `testes/categorias/filtro-categorias/page.tsx`
  - `testes/categorias/resumo-categorias/page.tsx`
  - `testes/categorias/tabela-categorias/page.tsx`
  - `testes/dashboard/grafico-ocupacao-dashboard/page.tsx`
  - `testes/dashboard/resumo-dashboard/page.tsx`
  - `testes/dashboard/resumo-dia-dashboard/page.tsx`
  - `testes/dashboard/status-quartos-dashboard/page.tsx`
  - `testes/quartos/criar-quartos/page.tsx`
  - `testes/quartos/filtro-quartos/page.tsx`
  - `testes/quartos/resumo-quartos/page.tsx`
  - `testes/quartos/tabela-quartos/page.tsx`
- Excluded from TypeScript compilation via `frontend/tsconfig.json`: `"exclude": ["node_modules", "src/app/testes/**/*"]`

**Database seed:**
- `backend/src/db/seed.ts` populates the database with realistic test data
- Run via `npm run seed` in the backend workspace
- Creates admin (`admin@hotel.com`) and manager (`manager@hotel.com`) accounts with password `admin`

**Health endpoint:**
- `GET /health` on the backend returns `{ status: "ok", uptime: N }` for liveness checks

---

## What Should Be Tested (Priority)

**High — backend business logic:**
- `backend/src/utils/reservation.ts` — `calculateReservationTotal` (pricing calculation, guest rules)
- `backend/src/modules/reservations/reservations.routes.ts` — date validation, conflict detection, status transitions
- `backend/src/middlewares/validate.ts` — Zod schema integration
- `backend/src/middlewares/auth.middleware.ts` — token extraction (Bearer header + cookie)

**High — frontend utility functions (pure, easily testable):**
- `frontend/src/utils/format.ts` — `formatCurrency`, `formatDate`, `formatDateTime`, `calculateNights`, `formatReservationId`
- `frontend/src/utils/cpf.ts` — `validateCPF`, `maskCPF`, `formatCPF`
- `frontend/src/utils/roomStatus.ts` — `normalizeOperationalRoomStatus`, `toApiRoomStatus`
- `frontend/src/utils/cache.ts` — `RequestCache` class (set/get/expiry/cleanup)

**Medium — frontend hooks:**
- `frontend/src/hooks/useCachedFetch.ts` — cache hit/miss, error handling, refetch, `enabled: false`

**Medium — frontend filtering logic:**
- `frontend/src/app/reservas/page.tsx` — `filteredSorted` useMemo (status filter, search, CPF, date range)

---

## Recommended Test Setup (Not Yet Implemented)

**Backend:**
- Recommended runner: Vitest or Jest with `tsx`
- Integration tests: spin up a test PostgreSQL database, run migrations, call route handlers directly
- Unit tests for pure utilities: no database required

**Frontend:**
- Recommended runner: Vitest + `@testing-library/react`
- Unit tests for `src/utils/` files: no DOM or network required
- Component tests with `@testing-library/react` for form behavior and rendering
- E2E: Playwright against the full stack

**Suggested `package.json` additions:**
```json
// backend/package.json (devDependencies)
"vitest": "^1.x",
"@vitest/coverage-v8": "^1.x"

// frontend/package.json (devDependencies)
"vitest": "^1.x",
"@testing-library/react": "^15.x",
"@testing-library/user-event": "^14.x",
"jsdom": "^24.x"
```

---

## Common Patterns to Follow When Tests Are Added

**Async testing pattern:**
```typescript
it("returns cached data on second call", async () => {
  const { result } = renderHook(() =>
    useCachedFetch<Room[]>("/api/Rooms", { cacheKey: "rooms" })
  );
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.data).toBeDefined();
});
```

**Error testing pattern:**
```typescript
it("returns 404 when room not found", async () => {
  const res = await request(app).get("/api/Rooms/nonexistent-uuid");
  expect(res.status).toBe(404);
  expect(res.body.message).toMatch(/nao encontrado/i);
});
```

**Pure utility testing pattern:**
```typescript
it("formatCurrency returns R$ 0,00 for null", () => {
  expect(formatCurrency(null)).toBe("R$ 0,00");
});

it("calculateNights returns 0 for same-day checkout", () => {
  expect(calculateNights("2026-01-01", "2026-01-01")).toBe(0);
});
```

**Status normalization testing:**
```typescript
it("normalizes Concluida to Concluída", () => {
  expect(normalizeStatus("Concluida")).toBe("Concluída");
});
```
