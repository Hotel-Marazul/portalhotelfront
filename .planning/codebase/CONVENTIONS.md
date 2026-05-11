# Coding Conventions

**Analysis Date:** 2026-05-11

## Project Layout

The repository is a monorepo with two independently-managed workspaces:

- `frontend/` — Next.js 15 app (TypeScript, React 19)
- `backend/` — Express 4 API (TypeScript, Node 22, ESM)

Each workspace has its own `package.json`, `tsconfig.json`, and `node_modules`. Conventions below cover both unless noted.

---

## Naming Patterns

**Files (frontend):**
- React page files follow Next.js App Router convention: `page.tsx` inside named directories, e.g. `src/app/reservas/page.tsx`, `src/app/quarto/page.tsx`
- Component files use PascalCase matching the exported component name: `ReservationsTable.tsx`, `StatusBadge.tsx`, `CriarQuartos.tsx`
- Utility files use camelCase: `format.ts`, `cache.ts`, `cpf.ts`, `roomStatus.ts`
- Hook files use camelCase prefixed with `use`: `useCachedFetch.ts`
- Service files use camelCase: `api.ts`, `apiService.ts`
- Type/model files use camelCase: `models.ts`, `reservations.ts`

**Files (backend):**
- Module route files follow `<module-name>.routes.ts` convention: `reservations.routes.ts`, `rooms.routes.ts`
- Schema/validation files follow `<module-name>.schema.ts`: `reservations.schema.ts`, `rooms.schema.ts`
- Middleware files use kebab-case: `error-handler.ts`, `not-found.ts`, `auth.middleware.ts`
- Utility files use kebab-case: `http-error.ts`, `async-handler.ts`
- Config files use kebab-case: `cors.ts`, `env.ts`

**Directories (frontend):**
- Feature groupings under `src/components/<feature>/`: `quartos/`, `reservations/`, `categorias/`, `clientes/`, `dashboard/`
- Pages under `src/app/<route>/page.tsx` (Next.js App Router)
- Shared utilities under `src/utils/`, hooks under `src/hooks/`, services under `src/services/`, types under `src/types/`

**Directories (backend):**
- Domain logic grouped under `src/modules/<module>/`: `auth/`, `rooms/`, `reservations/`, `clients/`, `categories/`, `pricing-rules/`
- Cross-cutting concerns at `src/middlewares/`, `src/utils/`, `src/config/`, `src/db/`

**Functions:**
- camelCase for all functions: `formatCurrency`, `calculateNights`, `maskCPF`, `validateCPF`, `asyncHandler`, `authMiddleware`
- Event handlers prefixed with `handle`: `handleSave`, `handleCreate`, `handleRemove`, `handleLogout`, `handleMenuOpen`, `handleStatusChange`
- Data fetchers prefixed with `fetch` or `load`: `fetchCategories`, `loadReservations`, `fetchData`
- Boolean-returning helpers prefixed with `is` or descriptive verbs: `isActiveReservationStatus`, `isMaintenanceRoomStatus`
- Normalizers prefixed with `normalize`: `normalizeStatus`, `normalizeOperationalRoomStatus`, `normalizeText`

**Variables:**
- camelCase throughout: `allReservations`, `checkInDate`, `rowsPerPage`, `pricingRules`
- Loop/iteration variables named after the entity: `reservation` not `r`, `guest` not `g`
- Previous state in `setState` callbacks named `previous`: `setForm((previous) => ({ ...previous, [field]: value }))`

**Types/Interfaces:**
- PascalCase: `ReservationDto`, `ReservationsFilters`, `RoomFormState`, `GuestForm`, `CacheEntry`
- DTOs suffixed with `Dto`: `ReservationDto`, `ReservationGuestDto`, `CreateReservationDto`, `UpdateReservationDto`
- Response shapes suffixed with `Response`: `ReservationsResponse`, `AgentChatResponse`
- Filter shapes suffixed with `Filters`: `ReservationsFilters`
- Form state shapes suffixed with `FormState` or `Form`: `RoomFormState`, `GuestForm`
- `type` used for union types and aliases: `ReservationStatus`, `Role`, `OperationalRoomStatus`
- `interface` used for object shapes: `Reservation`, `Room`, `Client`, `UseCachedFetchOptions`

**Constants:**
- SCREAMING_SNAKE_CASE for module-level constants: `ACTIVE_RESERVATION_STATUSES`, `ROOM_STATUS_MAINTENANCE`, `STORAGE_CONVERSATION_KEY`, `INITIAL_FORM`, `STATUS_OPTIONS`

---

## Code Style

**Formatting:**
- No Prettier config file detected. Formatting is not enforced by a formatter tool.
- Indentation is 2 spaces (observed throughout all source files).
- Strings use double quotes in TSX/JSX attribute values and template literals; single quotes appear in some utility files — not strictly enforced.

**Linting (frontend):**
- ESLint with `next/core-web-vitals` and `next/typescript` presets
- Config: `frontend/eslint.config.mjs`
- Run: `npm run lint` inside `frontend/`

**Linting (backend):**
- No ESLint config detected. TypeScript strict mode (`"strict": true`) serves as primary safety net.

**TypeScript:**
- `strict: true` in both workspaces
- Frontend targets `ES2017`, module resolution `bundler`
- Backend targets `ES2022`, module resolution `NodeNext`, full ESM (`"type": "module"` in `package.json`)
- Backend imports always include `.js` extension for local files (ESM requirement): `import { errorHandler } from "./middlewares/error-handler.js"`

---

## Import Organization

**Frontend pattern (observed order):**
1. React and framework imports: `import React, { useCallback, useEffect, useMemo, useState } from "react"`
2. MUI component imports (grouped by package)
3. MUI icon imports
4. Third-party library imports (`axios`, `date-fns`, etc.)
5. Internal services: `import apiClient from "../../services/api"`
6. Internal types: `import { ReservationDto } from "../../types/reservations"`
7. Internal components: `import StatusBadge from "./StatusBadge"`
8. Internal utilities: `import { formatDate } from "../../utils/format"`

**Path Aliases (frontend):**
- `@/*` maps to `src/*` (defined in `frontend/tsconfig.json`)
- In practice, most imports use relative paths (`../../services/api`) rather than the `@/` alias

**Backend pattern:**
- Node built-ins first: `import { randomUUID } from "crypto"`
- Framework imports: `import { Router } from "express"`
- Internal imports in dependency order (db → utils → middlewares → schemas)
- All local imports use explicit `.js` extension

---

## Error Handling

**Frontend:**
- Async operations in event handlers use try/catch with local `error` state: `setError(e instanceof Error ? e.message : "Erro ao carregar")`
- Axios errors checked with `isAxiosError(e)` (imported from `axios`) or `instanceof AxiosError`
- Error state rendered as MUI `<Alert severity="error">` inline in the component
- User feedback via `CustomSnackbar` component (`frontend/src/components/snackbar.tsx`) for create/edit success and failure
- Fire-and-forget async calls in event handlers use `void`: `onClick={() => void loadReservations()}`

**Backend:**
- All route handlers wrapped with `asyncHandler` utility (`backend/src/utils/async-handler.ts`) to forward promise rejections to Express error middleware
- Domain errors thrown as `new HttpError(statusCode, message)` (`backend/src/utils/http-error.ts`)
- Global error handler in `backend/src/middlewares/error-handler.ts` returns `{ message, details }` for `HttpError` and generic 500 for unknowns
- Validation errors returned as `{ message: "Dados inválidos.", issues: error.flatten() }` with HTTP 400

---

## Logging

**Framework:** `console` (no structured logging library in application code)

**Backend:**
- Server startup: `console.log` / `console.error` in `backend/src/server.ts`
- Seed output: `console.log` / `console.error` in `backend/src/db/seed.ts`
- No per-request logging beyond what Morgan middleware provides

**Frontend:**
- `console.error` used for caught errors that are non-fatal (user already sees UI error state)
- Avoid `console.log` in production code; none found in application source

---

## Comments

**When to Comment:**
- JSDoc-style block comments on utility functions in `src/utils/`: `/** Formata número como moeda brasileira (BRL) */`
- Inline comments for non-obvious logic: `// Remove tudo que não é dígito`, `// Redirect anyway to avoid client-side stale auth state.`
- Section dividers inside large components using `{/* Section Name */}` JSX comments
- Comment-out of test/exploration pages: `frontend/tsconfig.json` excludes `src/app/testes/**/*`

**JSDoc:**
- Used on exported utility functions in `frontend/src/utils/format.ts` and `frontend/src/utils/cpf.ts`
- Not used on React components or backend route handlers

---

## Function Design

**Size:** Component files can be large (200-450 lines) when they own full page logic with inline dialogs. Extracted sub-components are preferred for reuse (e.g. `StatusBadge`, `ReservationsFilters`, `CustomSnackbar`) but not always applied consistently.

**Parameters:**
- Callbacks and handlers typed inline with interfaces: `interface ReservationsTableProps { ... }`
- Generic utility functions use typed generics: `export function useCachedFetch<T>(url: string, options: UseCachedFetchOptions)`
- Form field updaters use constrained generics: `handleChange = <K extends keyof RoomFormState>(field: K, value: RoomFormState[K])`

**Return Values:**
- Utility functions return explicit types annotated in signature: `formatDate(...): string`, `calculateNights(...): number`
- React components return JSX without explicit return type annotation (inferred)
- Backend route handlers: void (side-effect via `res.json()` / `res.status()`)
- `null` returned for guard-clause early exits in components: `if (!reservation) return null`

---

## Module Design

**Exports:**
- Frontend components: single default export per file matching the filename
- Frontend utilities: named exports only (no default), grouped by concern
- Backend: named exports for routers (`export const reservationsRouter = Router()`), middleware functions, and utility functions
- Domain models exported as named interfaces/types from `backend/src/domain/models.ts`

**Barrel Files:** Not used. Each file imported directly by path.

---

## React Patterns

**Client Components:**
- All interactive components and pages are marked `"use client"` at the top of the file
- Next.js App Router layout (`frontend/src/app/layout.tsx`) is also a client component (uses `usePathname`)

**State Management:**
- Local `useState` for all UI state — no global state manager (Redux, Zustand, etc.)
- `useCallback` used for stable function references passed to `useEffect` deps
- `useMemo` used for derived/filtered data
- Custom hook `useCachedFetch` encapsulates fetch + in-memory TTL cache for GET requests

**Props Pattern:**
- Props interfaces defined in the same file as the component, immediately above the function definition
- Prop names use camelCase matching handler conventions: `onPageChange`, `onStatusChange`, `onEdit`, `onCreate`

**Form Handling:**
- Controlled inputs via `useState` with `value` + `onChange`
- Form state collected as a typed object (`RoomFormState`) with a single generic updater
- No form library (React Hook Form, Formik) used

**Styling:**
- Tailwind CSS utility classes applied via `className` on JSX elements
- MUI component `sx` prop used for one-off style overrides (spacing, border-radius, colors)
- Mixed approach: layout/positioning in Tailwind, MUI token-based theming via `sx`

---

## Backend Patterns

**Route Structure:**
- Each module under `backend/src/modules/<name>/` contains `<name>.routes.ts` and `<name>.schema.ts`
- Router exported as `const <module>Router = Router()` and mounted in `backend/src/routes/index.ts` under `/api`
- Route handlers use `asyncHandler(async (req, res) => {...})` wrapper consistently

**Validation:**
- Request validation via `validate({ body, params, query })` middleware using Zod schemas
- Zod schemas colocated in `<module>.schema.ts` alongside their router
- Env vars validated at startup via Zod schema in `backend/src/config/env.ts`

**Database:**
- Raw SQL via `pg` client, no ORM
- Query helper `query<T>()` imported from `backend/src/db/client.ts`
- Parameterized queries exclusively (`$1`, `$2`, etc.) — no string interpolation in SQL

**Status Normalization:**
- `"Concluida"` (without accent) treated as equivalent to `"Concluída"` (with accent) throughout the stack
- Normalization applied at both Zod schema level (`.transform(...)`) and frontend utility functions
