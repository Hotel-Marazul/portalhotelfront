# Phase 1: Data Integrity — Research

**Researched:** 2026-05-11
**Domain:** PostgreSQL transactions, overbooking prevention, Node.js pg pool, dashboard aggregation
**Confidence:** HIGH (all critical findings verified against live code)

---

## Summary

Phase 1 fixes four concrete bugs that are already documented in `CONCERNS.md` and localized to a single file — `backend/src/modules/reservations/reservations.routes.ts`. The file is ~557 lines and contains all reservation handler logic inline. There are no transactions on the create or update paths, and no database-level constraint preventing concurrent overlapping bookings.

The transaction fix (DATA-01, DATA-02) is a mechanical refactor: wrap the existing `pool.query()` sequences in a `pool.connect()` + `BEGIN`/`COMMIT`/`ROLLBACK` envelope. The canonical pattern is already present in `backend/src/db/seed.ts`. No new libraries are needed.

The overbooking constraint (DATA-03) introduces a `tsrange` exclusion constraint that requires the `btree_gist` extension. The official `postgres:16` Docker image (`image: postgres:16` in `docker-compose.yaml`) installs only the base PostgreSQL package — **`postgresql-16-contrib` is NOT included by default**. This means a `CREATE EXTENSION btree_gist` call will fail unless the Docker image is replaced with `postgres:16` from a contrib-enabled build, or a `Dockerfile` that installs `postgresql-contrib` is introduced. An alternative that avoids the extension entirely is the `SELECT ... FOR UPDATE` on the room row inside the transaction (serializes concurrent inserts for the same room).

The dashboard fix (DATA-04) is a pure SQL rewrite of the `counter-summary` endpoint: replace the hardcoded three-item array with a `date_trunc('month', check_in_date)` group-by aggregation. The frontend already handles a dynamic array of `{ mes, taxa }` objects.

**Primary recommendation:** Fix DATA-01 and DATA-02 first (transaction wrap), then DATA-03 using `SELECT ... FOR UPDATE` as the default strategy (no extension needed), with the `btree_gist` exclusion constraint as an enhancement only if the Docker image is upgraded. Fix DATA-04 with the SQL aggregation.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DATA-01 | Reservation creation uses atomic DB transaction — crash leaves no orphan row | Wrap lines 251–331 of `reservations.routes.ts` in `pool.connect()` + `BEGIN/COMMIT/ROLLBACK` following the `seed.ts` pattern |
| DATA-02 | Reservation update uses atomic DB transaction — guest delete + re-insert in one transaction | Wrap lines 334–440 of `reservations.routes.ts`; critical because `DELETE reservation_guests` at line 425 happens before re-inserts |
| DATA-03 | Overbooking prevented by DB constraint — two overlapping reservations for the same room are impossible | `SELECT ... FOR UPDATE` on room row inside transaction prevents the race; `tsrange` exclusion is stronger but requires `btree_gist` (see environment risk below) |
| DATA-04 | Dashboard shows real monthly occupancy rate from historical `check_in_date` data | Rewrite `/reservations/counter-summary` SQL to use `date_trunc('month', check_in_date)` group-by; frontend already handles dynamic array |
</phase_requirements>

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Atomic reservation write (DATA-01, DATA-02) | API / Backend | — | Transaction management belongs at the DB access layer, not the client or frontend |
| Overbooking prevention (DATA-03) | Database | API / Backend | DB-level constraint is the ultimate guard; app-level lock (`FOR UPDATE`) is the practical mechanism |
| Monthly occupancy aggregation (DATA-04) | API / Backend | — | SQL aggregation is a backend responsibility; frontend just renders the returned array |

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `pg` | 8.13.3 | PostgreSQL client — pool + transactions | Already in use; `pool.connect()` returns a client with `BEGIN`/`COMMIT` |
| PostgreSQL 16 | 16 (Docker) | Database engine | Already running; `tsrange` + `date_trunc` are native |

### No New Libraries Required

All four requirements are addressed by SQL patterns and the existing `pg` pool. No npm installs are needed for Phase 1.

**Installation:** None required.

---

## Architecture Patterns

### System Architecture Diagram

```
POST /Reservations
        │
        ▼
  authMiddleware ──▶ validate(createReservationSchema)
        │
        ▼
  pool.connect()           ← acquire dedicated client
        │
  BEGIN                    ← start transaction
        │
  SELECT room FOR UPDATE   ← serialize concurrent access to same room
        │
  availability check       ← now safe: lock held
        │
  INSERT reservations      ← main row
        │
  INSERT reservation_guests (loop) ← child rows
        │
  COMMIT / ROLLBACK        ← atomicity guaranteed
        │
  client.release()
        │
        ▼
  201 Created  /  409 Conflict  /  500 Error
```

### Recommended File Structure (no new files needed)

```
backend/src/
├── db/
│   ├── client.ts        # pool + query helper — NO CHANGE
│   └── init.ts          # schema DDL — ADD btree_gist extension (optional)
└── modules/reservations/
    └── reservations.routes.ts  # ALL CHANGES land here
```

### Pattern 1: Transaction Wrap (pool.connect + BEGIN/COMMIT)

**What:** Acquire a dedicated `PoolClient`, issue `BEGIN`, perform all mutations, then `COMMIT`. On error, `ROLLBACK` and re-throw. Always `client.release()` in `finally`.

**When to use:** Any handler that touches multiple tables — in this file that is `POST /Reservations` and `PUT /Reservations/:id`.

```typescript
// Source: backend/src/db/seed.ts (lines 252–404) — verified pattern in this codebase
import { pool } from "../../db/client.js";

const client = await pool.connect();
try {
  await client.query("BEGIN");

  // ... all mutations using client.query() not pool.query() ...

  await client.query("COMMIT");
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  client.release();
}
```

**Key detail:** Inside the transaction, every query must use `client.query()`, not the module-level `query()` helper (which uses `pool.query()` and would run on a different connection outside the transaction).

### Pattern 2: SELECT ... FOR UPDATE (overbooking serialization)

**What:** Lock the room row for the duration of the transaction. A second concurrent transaction that reaches the same `SELECT ... FOR UPDATE` will block until the first commits or rolls back.

**When to use:** `POST /Reservations` and `PUT /Reservations/:id` — must run inside the transaction, after `BEGIN`, before the availability check.

```typescript
// Source: PostgreSQL docs — explicit row locking
// https://www.postgresql.org/docs/current/explicit-locking.html
await client.query(
  `SELECT id FROM rooms WHERE id = $1 FOR UPDATE`,
  [roomId]
);
// Now safe to run the overlap SELECT — no concurrent transaction can
// hold a lock on this room row simultaneously.
```

**Why not tsrange exclusion alone:** An exclusion constraint catches overlapping inserts at the DB level, but requires `btree_gist` which is not in the base `postgres:16` image. `FOR UPDATE` achieves the same serialization using only core PostgreSQL.

### Pattern 3: Monthly Occupancy Aggregation (DATA-04)

**What:** Replace the hardcoded three-item array with a real `date_trunc` group-by query.

**When to use:** `GET /reservations/counter-summary` handler.

```typescript
// Source: PostgreSQL docs — date_trunc
// Replace the hardcoded taxaOcupacaoMes array with:
const monthlyRows = await client.query<{ mes: string; taxa: number }>(`
  SELECT
    TO_CHAR(date_trunc('month', check_in_date), 'Mon') AS mes,
    ROUND(
      COUNT(DISTINCT room_id)::numeric
      / NULLIF((SELECT COUNT(*) FROM rooms WHERE status <> $1), 0)
      * 100,
      1
    )::float AS taxa
  FROM reservations
  WHERE status = ANY($2::text[])
    AND check_in_date >= NOW() - INTERVAL '6 months'
  GROUP BY date_trunc('month', check_in_date)
  ORDER BY date_trunc('month', check_in_date)
`,
[ROOM_STATUS_MAINTENANCE, ACTIVE_RESERVATION_STATUSES]
);
```

**Month label localization note:** `TO_CHAR(..., 'Mon')` returns English abbreviations (`Jan`, `Feb`, ...). The frontend currently expects Portuguese labels (`Jan`, `Fev`, ...). The planner must decide: either keep English (3-letter overlap is identical for `Jan`, `Mar`, `Mai`, `Jul`, `Ago`, `Set`, `Out`, `Nov`, `Dez`) or add a mapping in the backend. Safe default: add a small mapping object in the handler.

### Anti-Patterns to Avoid

- **Multiple `pool.query()` calls in a mutation handler without `BEGIN`**: This is the current bug. A crash between any two `pool.query()` calls leaves data inconsistent.
- **Running the availability check outside the transaction**: Even with `FOR UPDATE`, the check must be inside the same transaction that does the insert. If the check and insert span two transactions, the race window reopens.
- **Using `pool.query()` inside a transaction started with `pool.connect()`**: Queries via `pool.query()` run on a different connection; they do not participate in the current transaction.
- **`ROLLBACK` without `client.release()`**: Leaks the pool connection. Always use `finally { client.release() }`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Transaction retry logic | Custom retry loop | Let errors propagate — `asyncHandler` catches and returns 500 | Reservation conflicts should surface as 409, not silently retry |
| Custom date-overlap math | JS date comparison for conflict detection | DB `FOR UPDATE` + existing overlap SQL | Date math in JS has timezone edge cases; DB handles them correctly |
| Advisory lock implementation | `pg_advisory_xact_lock` calls | `SELECT ... FOR UPDATE` on room row | Row-level lock is simpler, requires no integer key management, already fits the data model |

---

## Common Pitfalls

### Pitfall 1: Forgetting to switch from `query()` to `client.query()` inside the transaction

**What goes wrong:** Developer wraps mutations in `BEGIN`/`COMMIT` using `client.query()` but calls the helper `query()` (which uses `pool.query()`) for some sub-operations. Those sub-queries run on a separate connection outside the transaction.

**Why it happens:** The file currently imports `query` from `../../db/client.js` and uses it throughout. The refactor requires replacing every call inside the transaction block with `client.query()`.

**How to avoid:** After acquiring `client = await pool.connect()`, grep the handler for any `await query(` calls and replace all of them with `await client.query(`.

**Warning signs:** The `query` import is still used inside the `try` block after the refactor.

### Pitfall 2: Race window between availability check and insert (even with transactions)

**What goes wrong:** Transaction wraps the insert but the availability check (`ensureRoomIsAvailable`) runs before `FOR UPDATE` is issued. Two transactions can both pass the check, then both insert.

**Why it happens:** The availability check is a plain `SELECT` with no lock. PostgreSQL's default Read Committed isolation lets two transactions see the same committed state.

**How to avoid:** Issue `SELECT ... FOR UPDATE` on the room row as the FIRST operation inside the transaction, before calling `ensureRoomIsAvailable`. The lock forces the second concurrent transaction to wait.

**Warning signs:** `ensureRoomIsAvailable` is called before the `SELECT id FROM rooms WHERE id = $1 FOR UPDATE`.

### Pitfall 3: UPDATE path deletes guests before the transaction guard is in place

**What goes wrong:** The current `PUT /Reservations/:id` deletes all `reservation_guests` at line 425 before re-inserting. If the re-inserts fail, the guests are permanently deleted with no rollback.

**Why it happens:** No transaction — `DELETE` commits immediately.

**How to avoid:** The transaction wrap makes this safe: if any subsequent insert fails, `ROLLBACK` restores the deleted rows. No change to the delete-then-reinsert logic is needed beyond the transaction envelope.

**Warning signs:** `DELETE FROM reservation_guests` appears before `COMMIT` in code that has no `BEGIN`.

### Pitfall 4: `btree_gist` not available in base `postgres:16` image

**What goes wrong:** `CREATE EXTENSION btree_gist` fails with `ERROR: could not open extension control file ... btree_gist.control: No such file or directory`.

**Why it happens:** The official `postgres:16` Docker image installs only `postgresql-16`, not `postgresql-16-contrib`. The `btree_gist` extension ships in the contrib package.

**How to avoid:** Use `SELECT ... FOR UPDATE` as the primary overbooking guard (no extension needed). If the exclusion constraint is desired later, upgrade the Docker service to use a custom Dockerfile that runs `apt-get install -y postgresql-16-contrib`.

**Warning signs:** Any plan that adds `CREATE EXTENSION btree_gist` to `init.ts` without also modifying `docker-compose.yaml`.

### Pitfall 5: Dashboard month labels — language mismatch

**What goes wrong:** `TO_CHAR(date_trunc('month', check_in_date), 'Mon')` returns English (`Feb`, `Apr`, ...) but the frontend and seed data use Portuguese (`Fev`, `Abr`, ...).

**Why it happens:** PostgreSQL `TO_CHAR` with `'Mon'` uses the session locale, which defaults to English in the Docker container.

**How to avoid:** Add a month label mapping in the backend handler, or use `TO_CHAR(..., 'MM')` to return numeric months and map to Portuguese names in the handler.

---

## Code Examples

### Full transaction wrapper for POST /Reservations

```typescript
// Pattern derived from: backend/src/db/seed.ts lines 252–404 (VERIFIED in codebase)
reservationsRouter.post(
  "/Reservations",
  validate({ body: createReservationSchema }),
  asyncHandler(async (req, res) => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // 1. Lock the room row to serialize concurrent reservation attempts
      const rooms = await client.query<RoomForReservationRow>(
        `SELECT id, daily_price::text AS daily_price, status
         FROM rooms WHERE id = $1 FOR UPDATE`,
        [req.body.roomId]
      );
      const room = rooms.rows[0];
      if (!room) throw new HttpError(404, "Quarto nao encontrado.");
      if (isMaintenanceRoomStatus(room.status))
        throw new HttpError(400, "Quarto em manutencao nao pode receber reservas.");

      // 2. Validate client exists
      const clients = await client.query(
        `SELECT id FROM clients WHERE id = $1 LIMIT 1`,
        [req.body.clientId]
      );
      if (clients.rowCount === 0) throw new HttpError(404, "Cliente nao encontrado.");

      // 3. Validate dates
      validateReservationDates(req.body.checkInDate, req.body.checkOutDate);

      // 4. Availability check (safe — room is locked)
      const conflicts = await client.query(
        `SELECT id FROM reservations
         WHERE room_id = $1
           AND status = ANY($5::text[])
           AND ($4::uuid IS NULL OR id <> $4::uuid)
           AND check_in_date < $3::timestamptz
           AND check_out_date > $2::timestamptz
         LIMIT 1`,
        [req.body.roomId, req.body.checkInDate, req.body.checkOutDate, null, ACTIVE_RESERVATION_STATUSES]
      );
      if ((conflicts.rowCount ?? 0) > 0)
        throw new HttpError(409, "Ja existe uma reserva nesse quarto para o periodo informado.");

      // 5. Fetch pricing rules
      const priceRuleRows = await client.query<PricingRuleRow>(
        `SELECT id, name, description, min_age, max_age, price::text AS price FROM pricing_rules`
      );
      const pricingRules = mapPricingRules(priceRuleRows.rows);

      // 6. Calculate total
      const guests = req.body.guests.map((g: ReservationGuest) => ({
        id: randomUUID(), reservationId: "", name: g.name, age: g.age, pricingRuleId: g.pricingRuleId ?? null
      }));
      const totalPrice = calculateReservationTotal(
        Number(room.daily_price), req.body.checkInDate, req.body.checkOutDate, guests, pricingRules
      );

      // 7. Insert reservation
      const reservationId = randomUUID();
      await client.query(
        `INSERT INTO reservations (id, room_id, client_id, check_in_date, check_out_date, status, total_price)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [reservationId, req.body.roomId, req.body.clientId,
         req.body.checkInDate, req.body.checkOutDate, req.body.status, totalPrice]
      );

      // 8. Insert guests
      for (const guest of guests) {
        await client.query(
          `INSERT INTO reservation_guests (id, reservation_id, name, age, pricing_rule_id)
           VALUES ($1, $2, $3, $4, $5)`,
          [guest.id, reservationId, guest.name, guest.age, guest.pricingRuleId]
        );
      }

      await client.query("COMMIT");

      const result = await getReservationsByIds([reservationId]);
      res.status(201).json(result[0]);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  })
);
```

### Monthly occupancy SQL for DATA-04

```typescript
// Source: PostgreSQL docs — date_trunc, TO_CHAR [CITED: https://www.postgresql.org/docs/16/functions-datetime.html]
const MONTH_LABELS: Record<string, string> = {
  "01": "Jan", "02": "Fev", "03": "Mar", "04": "Abr",
  "05": "Mai", "06": "Jun", "07": "Jul", "08": "Ago",
  "09": "Set", "10": "Out", "11": "Nov", "12": "Dez"
};

const monthlyRows = await query<{ month_num: string; taxa: number }>(
  `SELECT
     TO_CHAR(date_trunc('month', check_in_date), 'MM') AS month_num,
     ROUND(
       COUNT(DISTINCT room_id)::numeric
       / NULLIF((SELECT COUNT(*) FROM rooms WHERE status <> $1), 0)
       * 100,
       1
     )::float AS taxa
   FROM reservations
   WHERE status = ANY($2::text[])
     AND check_in_date >= NOW() - INTERVAL '6 months'
   GROUP BY date_trunc('month', check_in_date)
   ORDER BY date_trunc('month', check_in_date)`,
  [ROOM_STATUS_MAINTENANCE, ACTIVE_RESERVATION_STATUSES]
);

const taxaOcupacaoMes = monthlyRows.map((row) => ({
  mes: MONTH_LABELS[row.month_num] ?? row.month_num,
  taxa: row.taxa
}));
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Sequential `pool.query()` per mutation | `pool.connect()` + `BEGIN/COMMIT` | Phase 1 | Crash safety, atomicity |
| App-level availability check only | `SELECT ... FOR UPDATE` + availability check inside transaction | Phase 1 | Overbooking impossible via race condition |
| Hardcoded `[Jan, Fev, Mar]` with same rate | Real `date_trunc` monthly aggregation | Phase 1 | Dashboard shows real historical data |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `TO_CHAR(..., 'MM')` returns zero-padded numeric month regardless of PostgreSQL locale | Code Examples | Month mapping breaks; mitigation: use `EXTRACT(MONTH FROM ...)::int` instead |
| A2 | `pool.connect()` in `pg` 8.x returns a client with `.query()` method that accepts the same signature as `pool.query()` | Pattern 1 | Build error; mitigation: confirmed by pg 8.x API docs — `PoolClient` extends `QueryableConnection` |

---

## Open Questions

1. **`btree_gist` availability in production**
   - What we know: The `postgres:16` official Dockerfile does not install `postgresql-16-contrib`; `btree_gist.control` is absent from the base image. [CITED: https://github.com/docker-library/postgres/blob/master/16/bookworm/Dockerfile]
   - What's unclear: Whether a production deployment uses a different image or has contrib installed.
   - Recommendation: Use `SELECT ... FOR UPDATE` (no extension needed) as the Phase 1 solution. Document the `tsrange` exclusion constraint as a Phase 5+ enhancement if the image is upgraded.

2. **Month range for occupancy chart**
   - What we know: The backend SQL uses `INTERVAL '6 months'`; the frontend renders whatever the API returns.
   - What's unclear: How many months of history are meaningful for the hotel's dashboard (3? 6? 12?).
   - Recommendation: Default to last 6 months; make it easy to change with a single constant.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| PostgreSQL 16 | All DATA-0x requirements | See note | 16 (Docker) | — |
| `btree_gist` extension | DATA-03 (exclusion constraint variant) | NOT in base `postgres:16` image | — | Use `SELECT ... FOR UPDATE` instead |
| Node.js / `pg` 8.13.3 | DATA-01, DATA-02 | Already installed | 8.13.3 | — |

**Missing dependencies with no fallback:** None — the `FOR UPDATE` approach requires only core PostgreSQL.

**Missing dependencies with fallback:**
- `btree_gist`: Not installed in `postgres:16` base image. Fallback = `SELECT ... FOR UPDATE` achieves equivalent serialization. The exclusion constraint is a future enhancement.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (not yet installed in `backend/`) |
| Config file | None — Wave 0 must create `backend/vitest.config.ts` |
| Quick run command | `cd backend && npx vitest run --reporter=verbose` |
| Full suite command | `cd backend && npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DATA-01 | Crash after INSERT reservations rolls back guest rows | integration | `npx vitest run tests/reservations.test.ts` | Wave 0 |
| DATA-02 | Crash after DELETE reservation_guests rolls back entire update | integration | `npx vitest run tests/reservations.test.ts` | Wave 0 |
| DATA-03 | Concurrent overlapping inserts result in exactly one success and one 409 | integration | `npx vitest run tests/reservations.test.ts` | Wave 0 |
| DATA-04 | Counter-summary returns distinct monthly rates from real data | unit (SQL mock) | `npx vitest run tests/dashboard.test.ts` | Wave 0 |

**Note:** Integration tests for DATA-01 through DATA-03 require a live PostgreSQL connection. The recommended approach for this project (no existing test infra) is: use `supertest` against the running Express app with a test database, or mock `pool.connect()` and verify `BEGIN`/`COMMIT`/`ROLLBACK` call order using Vitest spies. The simpler spy approach covers DATA-01 and DATA-02 without a live DB.

### Sampling Rate
- **Per task commit:** `cd backend && npx vitest run --reporter=verbose`
- **Per wave merge:** `cd backend && npx vitest run`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `backend/vitest.config.ts` — Vitest config for backend
- [ ] `backend/tests/reservations.test.ts` — DATA-01, DATA-02, DATA-03 tests
- [ ] `backend/tests/dashboard.test.ts` — DATA-04 tests
- [ ] Install: `cd backend && npm install --save-dev vitest @vitest/coverage-v8`

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — |
| V3 Session Management | no | — |
| V4 Access Control | no | — |
| V5 Input Validation | yes | Zod schemas already present (`createReservationSchema`, `updateReservationSchema`) — no changes needed in Phase 1 |
| V6 Cryptography | no | — |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Partial write leaves orphan rows (DATA-01, DATA-02) | Tampering (data integrity) | `BEGIN/COMMIT/ROLLBACK` transaction |
| TOCTOU race on availability check (DATA-03) | Tampering (overbooking) | `SELECT ... FOR UPDATE` within transaction |

---

## Sources

### Primary (HIGH confidence)
- `backend/src/modules/reservations/reservations.routes.ts` — verified current code: no transactions, sequential `pool.query()` calls on create (lines 247–331) and update (lines 334–440)
- `backend/src/db/seed.ts` — verified correct `pool.connect()` + `BEGIN/COMMIT/ROLLBACK` pattern (lines 252–404)
- `backend/src/db/client.ts` — verified `pool` export and `query()` helper using `pool.query()`
- `backend/src/db/init.ts` — verified schema: no exclusion constraint on `reservations`, only a plain `B-tree` index on `(room_id, check_in_date, check_out_date)`
- `docker-compose.yaml` — verified `image: postgres:16` with no custom Dockerfile for `db-marazul`
- `frontend/src/app/dashboard/page.tsx` — verified frontend consumes `taxaOcupacaoMes` as a dynamic array; falls back to `FALLBACK_OCCUPANCY` when array is empty

### Secondary (MEDIUM confidence)
- [GitHub docker-library/postgres Dockerfile](https://github.com/docker-library/postgres/blob/master/16/bookworm/Dockerfile) — confirmed base image installs only `postgresql-$PG_MAJOR`, not `postgresql-16-contrib`
- [PostgreSQL docs — Explicit Locking](https://www.postgresql.org/docs/current/explicit-locking.html) — `SELECT ... FOR UPDATE` semantics

### Tertiary (LOW confidence)
- None

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new libraries; existing `pg` pool and PostgreSQL 16 are sufficient
- Architecture: HIGH — all relevant code read and verified line-by-line
- Pitfalls: HIGH — discovered directly from reading the live code
- btree_gist availability: HIGH (negative) — verified against the official Docker image Dockerfile

**Research date:** 2026-05-11
**Valid until:** 2026-06-11 (stable stack; only risk is Docker image change)
