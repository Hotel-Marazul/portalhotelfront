---
plan: 01-01
phase: 1
status: complete
date: 2026-05-11
requirements_covered:
  - DATA-01
  - DATA-03
key-files:
  created: []
  modified:
    - backend/src/modules/reservations/reservations.routes.ts
---

## What Was Built

Rewrote the POST /Reservations handler to use `pool.connect()` + `BEGIN`/`COMMIT`/`ROLLBACK`. The room row is now locked with `SELECT ... FOR UPDATE` before the availability conflict check runs, preventing the TOCTOU overbooking race. All DB mutations (`INSERT INTO reservations`, `INSERT INTO reservation_guests`) run inside a single transaction — a crash at any point causes ROLLBACK and leaves no orphan rows.

## Key Changes

- Added `pool` to the import from `../../db/client.js`
- Removed use of module-level `query()` helper inside handler (it uses a separate pool connection)
- `ensureRoomIsAvailable()` helper replaced by inline `client.query()` conflict SELECT inside the transaction
- `FOR UPDATE` lock on rooms row serializes concurrent reservation attempts for the same room
- `client.release()` in `finally` block — connection always returned to pool

## Verification

- `npx tsc --noEmit` → exit 0
- `grep "BEGIN"` → 1 match inside POST handler
- `grep "FOR UPDATE"` → 1 match, before the availability SELECT
- `grep "pool.query"` → 0 matches (no bare pool.query in handler)
- `grep "client.release()"` → 1 match in `finally` block

## Self-Check: PASSED
