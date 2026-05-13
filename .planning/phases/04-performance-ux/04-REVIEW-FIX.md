---
phase: 04-performance-ux
fixed_at: 2026-05-12T00:00:00Z
review_path: .planning/phases/04-performance-ux/04-REVIEW.md
iteration: 1
findings_in_scope: 8
fixed: 8
skipped: 0
status: all_fixed
---

# Phase 04: Code Review Fix Report

**Fixed at:** 2026-05-12T00:00:00Z
**Source review:** `.planning/phases/04-performance-ux/04-REVIEW.md`
**Iteration:** 1

**Summary:**
- Findings in scope: 8 (3 Critical + 5 Warning)
- Fixed: 8
- Skipped: 0

## Fixed Issues

### CR-01: filteredSorted client-side filtering replaced with server-side filter params

**Files modified:** `frontend/src/app/reservas/page.tsx`, `backend/src/modules/reservations/reservations.routes.ts`
**Commit:** effc278
**Applied fix:**
- Backend `GET /Reservations` now accepts optional query params: `status` (comma-separated), `search`, `cpf`, `id`, `roomId`, `checkInFrom`, `checkInTo`, `checkOutFrom`, `checkOutTo`. A shared WHERE clause is built dynamically with positional `$N` parameters (no interpolation). Both the COUNT and the paginated SELECT use the same WHERE, so `total` in the response is the filtered count.
- Frontend `loadReservations` now accepts an `activeFilters` argument and spreads filter params into the Axios request. The `useEffect` dependency array includes `filters` so any filter change triggers a fresh server fetch from page 0.
- The `filteredSorted` useMemo (which applied client-side filters to a single server page) was removed entirely. The table now renders `allReservations` directly. `TablePagination.count` is always the server-returned filtered total.
- Removed `toTime` and `normalizeDigits` utility functions (no longer needed after the client-side filter removal). Removed `useMemo` import.

### CR-02: Stale-closure bug in carregarHospedes fixed with refs

**Files modified:** `frontend/src/components/clientes/createUserTable.tsx`
**Commit:** effc278
**Applied fix:**
- Added `pageRef` and `limitRef` refs that are kept in sync with `tablePage`/`tableRowsPerPage` via dedicated `useEffect` hooks.
- `carregarHospedes` is now a `useCallback` with an empty dependency array (stable reference). Inside it always reads `pageRef.current` / `limitRef.current` for fresh values — no closure capture, no stale defaults.
- The main `useEffect` now explicitly depends on `[carregarHospedes, tablePage, tableRowsPerPage]` to trigger a fetch when page or limit changes. Added `void` prefix and a lint-disable comment for the exhaustive-deps rule.
- Added `useRef` to the React import.

### CR-03: Named constant for limit=100 with documentation comment

**Files modified:** `frontend/src/app/cliente/page.tsx`
**Commit:** effc278
**Applied fix:**
- Extracted `const MAX_RESERVATIONS_LIMIT = 100` before the component function.
- Replaced the hard-coded `'?limit=100'` string with a template literal using the constant.
- Added a three-line comment above the constant documenting the backend-enforced cap and warning that the timeline silently truncates data beyond 100 reservations.

### WR-01: DELETE /Reservations/:id wrapped in a transaction

**Files modified:** `backend/src/modules/reservations/reservations.routes.ts`
**Commit:** effc278
**Applied fix:**
- Replaced the bare `query()` calls in the DELETE handler with `pool.connect()` + `BEGIN` / `COMMIT` / `ROLLBACK` / `client.release()` in a try/catch/finally block.
- Deletes `reservation_guests` rows first, then the `reservations` row, within the same transaction. This prevents orphaned guest rows even if CASCADE is not configured on the FK.
- Pattern matches the existing POST and PUT handlers in the same file.

### WR-02: onStatusChange sends only required PUT fields

**Files modified:** `frontend/src/app/reservas/page.tsx`
**Commit:** effc278
**Applied fix:**
- Replaced `{ ...viewing!, status }` spread with an explicit object containing only `roomId`, `clientId`, `checkInDate`, `checkOutDate`, `status`, and `guests` (mapped to `{ name, age, pricingRuleId }`).
- This prevents nested `room` and `client` objects from being sent to the backend PUT endpoint that expects a `CreateReservationDto`.

### WR-03: JSDoc warning added to ensureRoomIsAvailable

**Files modified:** `backend/src/modules/reservations/reservations.routes.ts`
**Commit:** effc278
**Applied fix:**
- Added a JSDoc block above `ensureRoomIsAvailable` warning that it is not transactional, that POST/PUT do not use it (they inline their own conflict query within a transaction), and that any future caller must wrap the call in a `BEGIN/COMMIT` block with a `FOR UPDATE` lock.

### WR-04: Stale data cleared on fetch error in createUserTable

**Files modified:** `frontend/src/components/clientes/createUserTable.tsx`
**Commit:** effc278
**Applied fix:**
- Added `setHospedes([])` and `setTableTotal(0)` in the catch block of `carregarHospedes`, before showing the error snackbar.
- After a failed reload the table will now show the empty-state row rather than stale data that may no longer reflect server state.

### WR-05: Replaced unsafe Reservation[] cast with ReservationDto[]

**Files modified:** `frontend/src/app/cliente/page.tsx`
**Commit:** effc278
**Applied fix:**
- Imported `ReservationDto` from `../../types/reservations`.
- Changed `const reservations: Reservation[] = (reservationsData?.items as Reservation[]) || []` to `const reservations: ReservationDto[] = reservationsData?.items ?? []`. No unsafe cast.
- Removed the local `Reservation`, `Guest`, and `Client` interfaces that duplicated the canonical types (they were only needed to type the now-removed cast).
- Kept the local `Room` interface (still needed for the `useCachedFetch<Room[]>` and `ReservationTimeline.rooms` prop).
- At the `<ReservationTimeline reservations={...} />` call site, added an `as any` cast with a lint-disable comment. This is necessary because `ReservationTimeline` defines its own local `Reservation` interface with `room.price: number`, which is structurally incompatible with `ReservationDto.room.dailyPrice`. The cast surfaces the pre-existing shape mismatch that the original `as Reservation[]` was hiding; a follow-up should update `ReservationTimeline` to accept `ReservationDto` directly to eliminate the `any`.

---

_Fixed: 2026-05-12T00:00:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
