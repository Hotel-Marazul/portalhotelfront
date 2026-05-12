---
phase: 04-performance-ux
reviewed: 2026-05-12T00:00:00Z
depth: standard
files_reviewed: 5
files_reviewed_list:
  - backend/src/modules/reservations/reservations.routes.ts
  - frontend/src/app/reservas/page.tsx
  - frontend/src/app/cliente/page.tsx
  - backend/src/modules/clients/clients.routes.ts
  - frontend/src/components/clientes/createUserTable.tsx
findings:
  critical: 3
  warning: 5
  info: 3
  total: 11
status: issues_found
---

# Phase 04: Code Review Report

**Reviewed:** 2026-05-12T00:00:00Z
**Depth:** standard
**Files Reviewed:** 5
**Status:** issues_found

## Summary

Five files covering server-side pagination, client/reservation CRUD, and their React consumers were reviewed. All SQL is parameterized — no injection surface was found. The MUI base-0 to backend base-1 conversion is correctly applied in both `reservas/page.tsx` and `createUserTable.tsx`. However, three correctness defects were found that will cause incorrect runtime behavior: a pagination count mismatch when filters are active, a stale-closure bug in `carregarHospedes`, and a silent full-table fetch on the cliente page that bypasses pagination entirely. Five additional warnings cover missing error handling, inconsistent state management, and type-safety gaps.

---

## Critical Issues

### CR-01: `filteredSorted` applies client-side filters to a single server page — `totalCount` is never adjusted, making `TablePagination` display wrong totals and allow navigation to nonexistent pages

**File:** `frontend/src/app/reservas/page.tsx:135-202`

**Issue:** The backend returns one page of 20 (or N) reservations and a truthful `total` over the whole table. The frontend then client-side-filters those 20 rows into `filteredSorted`. The `TablePagination` is wired to `count={totalCount}` (the unfiltered server total) and `page={page}`. When any filter is active:
- Page N may render 0 rows (all filtered out) but `TablePagination` still shows e.g. "21–40 of 183 items".
- The user can navigate to pages where all results are filtered, giving a blank table with no error.
- `totalCount` is never recalculated to reflect filtered rows, so the pagination controls are semantically wrong.

The root conflict is that the implementation mixes two pagination strategies: the backend owns pagination (LIMIT/OFFSET), but filters are evaluated only on the current page's data on the client. If filtering is meant to happen server-side, filter params must be sent to the API and `total` must be the filtered count. If filtering is meant to be client-side, all records must be fetched first (no server-side paging). The current hybrid is broken for every filter.

**Fix:** Send all active filter values as query params to the backend and let the backend apply WHERE clauses, returning a filtered `total`. Remove the `filteredSorted` client-side filtering entirely, or make it clear it operates only as a cosmetic highlight on an already-server-filtered page.

```typescript
// In loadReservations, pass filters:
const res = await apiClient.get<ReservationsResponse>("/api/Reservations", {
  params: {
    page: targetPage + 1,
    limit: targetLimit,
    status: filters.status?.join(","),
    search: filters.search,
    cpf: filters.cpf,
    // ... other filter fields
  }
});

// Then remove the filteredSorted memo and render allReservations directly.
```

---

### CR-02: `carregarHospedes` captures stale `tablePage` and `tableRowsPerPage` via closure — page changes do not reliably trigger a fresh fetch

**File:** `frontend/src/components/clientes/createUserTable.tsx:92-122`

**Issue:** `carregarHospedes` is defined with `useCallback` and its dependency array is `[tablePage, tableRowsPerPage]`. This means every time either value changes, a new function reference is created. `useEffect` on line 124–126 depends on `carregarHospedes` and therefore fires on every new function reference — which is the intended trigger. However, the `onPageChange` handler (line 287) only calls `setTablePage(newPage)` — it does NOT call `carregarHospedes` directly. The fetch is driven entirely through the `useEffect → carregarHospedes` chain, which works only if the closure captures fresh values.

The bug: because `carregarHospedes` closes over `tablePage` and `tableRowsPerPage` at creation time AND the function is also called directly from `ModalHospede`'s `onSuccess` prop (line 187), that direct call always uses the `currentPage` and `currentLimit` parameters defaulted to the stale closure values (`tablePage, tableRowsPerPage`). If the modal is open on page 3 and the user saves, `onSuccess` fires `carregarHospedes()` which defaults to the closure-captured `tablePage` (3) — that appears correct. But if the component re-renders between those two events with different state, the closure values and the defaults diverge unpredictably.

A cleaner and more serious manifestation: `carregarHospedes` uses its parameters (`currentPage`, `currentLimit`) with defaults taken from the closure (`tablePage`, `tableRowsPerPage`). This dual-source pattern is unnecessary complexity and will produce wrong fetches if the caller passes no arguments while state has changed but the closure has not yet been re-created.

**Fix:** Remove the default-parameter trick. The function should take explicit arguments always, or read from refs, or be replaced by a plain effect that directly reads state:

```typescript
// Option A: use a ref to always get fresh values
const pageRef = useRef(tablePage);
const limitRef = useRef(tableRowsPerPage);
useEffect(() => { pageRef.current = tablePage; }, [tablePage]);
useEffect(() => { limitRef.current = tableRowsPerPage; }, [tableRowsPerPage]);

const carregarHospedes = useCallback(async () => {
  const page = pageRef.current;
  const limit = limitRef.current;
  // ...fetch with page+1, limit
}, []); // stable reference

// Option B (simpler): drop useCallback entirely for this function,
// use a plain useEffect that depends on tablePage and tableRowsPerPage.
```

---

### CR-03: `cliente/page.tsx` fetches `/api/Reservations?limit=100` unconditionally — bypasses server-side pagination and silently truncates data beyond 100 reservations

**File:** `frontend/src/app/cliente/page.tsx:66-69`

**Issue:** The `useCachedFetch` call on line 66 hard-codes `limit=100` with no `page` parameter. The backend enforces `Math.min(100, ...)` so this is the absolute maximum page size. Any hotel with more than 100 active reservations will silently show an incomplete timeline — the 101st and beyond are dropped without any indication to the user. Additionally, this bypasses the entire server-side pagination mechanism that the rest of the implementation went to pains to implement correctly. This is also a performance regression for the initial page load: even if only 5 reservations are relevant to the timeline view, all 100 are fetched and cached.

**Fix:** Either implement proper pagination for the timeline component (passing `page` and `limit` and handling multi-page load), or acknowledge the limitation with a visible warning in the UI, or fetch only the reservations needed for the visible date range:

```typescript
// Fetch only reservations within the visible timeline window:
const today = new Date().toISOString().slice(0, 10);
const windowEnd = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
useCachedFetch(`/api/Reservations?limit=100&checkInFrom=${today}&checkOutTo=${windowEnd}`, ...)
```

Note: this is only viable once the backend supports date-range filter params (see CR-01).

---

## Warnings

### WR-01: `DELETE /Reservations/:id` does not run inside a transaction — `reservation_guests` rows may be orphaned if the DELETE is interrupted

**File:** `backend/src/modules/reservations/reservations.routes.ts:508-529`

**Issue:** The delete handler uses the module-level `query()` helper (a single connection from the pool) to delete from `reservations`. If the database has a CASCADE configured on `reservation_guests.reservation_id` this is safe, but if it does not, an interruption between the check (line 512) and the delete (line 526) leaves `reservation_guests` rows orphaned. More importantly, using a bare `query()` rather than a transaction violates the project rule in CLAUDE.md: "SEMPRE usar `pool.connect()` + `BEGIN/COMMIT/ROLLBACK` em operações que tocam múltiplas tabelas." Even if CASCADE is set, the pattern is inconsistent with the rest of the file (POST and PUT both use explicit transactions) and should be wrapped for consistency and resilience.

**Fix:**
```typescript
reservationsRouter.delete("/Reservations/:id", validate({ params: reservationIdSchema }),
  asyncHandler(async (req, res) => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const existing = await client.query<ReservationReferenceRow>(
        `SELECT id FROM reservations WHERE id = $1 LIMIT 1`, [req.params.id]
      );
      if (!existing.rows[0]) throw new HttpError(404, "Reserva nao encontrada.");
      await client.query(`DELETE FROM reservation_guests WHERE reservation_id = $1`, [req.params.id]);
      await client.query(`DELETE FROM reservations WHERE id = $1`, [req.params.id]);
      await client.query("COMMIT");
      res.status(204).send();
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  })
);
```

---

### WR-02: `onStatusChange` in `ReservationDrawer` sends an incomplete payload — it sends only `status` merged with the viewing object, which may include stale or client-only fields

**File:** `frontend/src/app/reservas/page.tsx:469-472`

**Issue:**
```typescript
onStatusChange={async (id, status) => {
  await apiClient.put(`/api/Reservations/${id}`, { ...viewing!, status });
  void loadReservations(page, rowsPerPage);
}}
```
The spread `{ ...viewing!, status }` sends the entire `ReservationDto` including nested `room` and `client` objects back to a PUT endpoint that expects a `CreateReservationDto`. The backend schema validator (`updateReservationSchema`) may reject or silently ignore extra fields, but if it does not strip them the backend will attempt to use them. More importantly, `viewing` may be stale (set at the time the drawer was opened, before edits happened). If `viewing` was set before the last `loadReservations` call, `roomId`, `clientId`, `checkInDate`, `checkOutDate`, and `guests` may be outdated, causing an unintended data overwrite when the user only intended to change status.

**Fix:** Send only the required fields to the PUT endpoint:
```typescript
onStatusChange={async (id, status) => {
  const r = viewing!;
  await apiClient.put(`/api/Reservations/${id}`, {
    roomId: r.roomId,
    clientId: r.clientId,
    checkInDate: r.checkInDate,
    checkOutDate: r.checkOutDate,
    status,
    guests: (r.guests ?? []).map(g => ({
      name: g.name, age: g.age, pricingRuleId: g.pricingRuleId ?? null
    }))
  });
  void loadReservations(page, rowsPerPage);
}}
```

---

### WR-03: `ensureRoomIsAvailable` is called outside a transaction in the `getReservationsByIds` utility path — it offers no overbooking protection when used standalone

**File:** `backend/src/modules/reservations/reservations.routes.ts:98-121`

**Issue:** `ensureRoomIsAvailable` uses the pool-level `query()` helper, not a transactional client. It exists as a standalone helper but is never actually called from the POST/PUT handlers (those handlers inline their own conflict query within a transaction). The function is exported only implicitly (no `export` keyword) but could be called by other code in the future, where the caller would incorrectly assume it provides transactional safety. More immediately, if any future route calls it outside a transaction, two concurrent requests could both pass the overlap check and both insert a reservation — a classic TOCTOU race on availability.

**Fix:** Either remove the function (it is dead code — POST and PUT both inline their own conflict check) or add a JSDoc warning:
```typescript
/**
 * WARNING: This check is NOT transactional. Only use inside a BEGIN/COMMIT
 * block with a FOR UPDATE lock on the room row to prevent race conditions.
 */
async function ensureRoomIsAvailable(...) { ... }
```

---

### WR-04: `createUserTable.tsx` swallows fetch errors with only `console.error` — the user sees a perpetual spinner if the load fails silently

**File:** `frontend/src/components/clientes/createUserTable.tsx:112-117`

**Issue:** The catch block in `carregarHospedes` calls `console.error(error)` and then shows a snackbar. It also calls `setLoading(false)` in the `finally` block, which is correct. However, there is no `setHospedes([])` in the catch path. If a previous successful load populated `hospedes` with stale data, a failed reload (e.g., network error) will leave the table showing stale rows with no visible error state in the table itself — only a transient snackbar. The snackbar auto-hides, so after a few seconds the user sees outdated data with no indication it may be stale.

**Fix:** Optionally add an error state to the component and render it above the table, or at minimum reset `hospedes` to `[]` in the catch so the empty-state row appears:
```typescript
} catch (error) {
  console.error(error);
  setHospedes([]);  // prevent stale data display
  setTableTotal(0);
  setSnackbar({ open: true, message: "Erro ao carregar hóspedes.", severity: "error" });
}
```

---

### WR-05: `cliente/page.tsx` passes `reservationsData?.items` cast as `Reservation[]` — the local `Reservation` type is incompatible with `ReservationDto` and silently drops fields

**File:** `frontend/src/app/cliente/page.tsx:86`

**Issue:**
```typescript
const reservations: Reservation[] = (reservationsData?.items as Reservation[]) || [];
```
The local `Reservation` interface (lines 38–47) defines `room.price: number` (from the `Room` interface at line 25) and `guest.pricingRuleId: string` (non-nullable). However `ReservationDto` from `types/reservations.ts` uses `room.dailyPrice?: number` and `guest.pricingRuleId?: string | null`. The cast with `as Reservation[]` bypasses TypeScript's type checking. At runtime, `room.price` will be `undefined` for every reservation (since the API returns `dailyPrice`), and `guest.pricingRuleId` may be `null`. Any component consuming these typed values expecting `number` or non-null `string` will receive `undefined`/`null` silently.

**Fix:** Either use the shared `ReservationDto` type and update the local `Room`/`Guest` interfaces to match, or map the API response to the local shape explicitly:
```typescript
// Replace the cast with an import of the canonical type:
import type { ReservationDto } from '../../types/reservations';
const reservations: ReservationDto[] = reservationsData?.items ?? [];
```

---

## Info

### IN-01: Commented-out developer notes with checkmark annotations left in production component

**File:** `frontend/src/components/clientes/createUserTable.tsx:34-46`

**Issue:** Lines 34–46 contain inline comments (`// ✅ Adicionar`, `// ✅ Mudar de category.name para categoryName`, `// ✅ Adicionar`) that are development notes confirming fields were added. These are not documentation — they are one-time implementation notes that should be removed.

**Fix:** Remove the `// ✅ ...` comments from the interface field declarations.

---

### IN-02: Magic number `100` used in `cliente/page.tsx` with no named constant

**File:** `frontend/src/app/cliente/page.tsx:66`

**Issue:** `'/api/Reservations?limit=100'` hard-codes the maximum page size as an inline URL string. The number 100 is also the backend's enforced cap (`Math.min(100, ...)`). If the backend cap changes, the frontend value will silently become wrong.

**Fix:** Extract to a named constant:
```typescript
const MAX_RESERVATIONS_LIMIT = 100;
useCachedFetch<ReservationsResponse>(
  `/api/Reservations?limit=${MAX_RESERVATIONS_LIMIT}`,
  ...
)
```

---

### IN-03: `reservations/counter-summary` occupancy rate formula counts distinct rooms per month, not per day — the metric may be misleading for partial-month data

**File:** `backend/src/modules/reservations/reservations.routes.ts:573-588`

**Issue:** The monthly occupancy rate query counts `COUNT(DISTINCT room_id)` for the month and divides by total non-maintenance rooms. A room booked for one day in June counts identically to a room booked for all 30 days. This produces an overstatement of occupancy for months with many short-stay reservations. This is a business-logic concern rather than a code defect, but the field is named `taxa` (rate) which implies a time-normalized calculation.

**Fix:** If a true occupancy rate (room-nights occupied / total room-nights) is required, the query should sum `(check_out_date - check_in_date)` in days and divide by `(days_in_month * total_rooms)`. If the current "rooms ever booked this month" metric is intentional, rename the field and add a comment documenting the definition.

---

_Reviewed: 2026-05-12T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
