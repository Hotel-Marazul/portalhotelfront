---
plan: 01-02
phase: 1
status: complete
date: 2026-05-11
requirements_covered:
  - DATA-02
key-files:
  created: []
  modified:
    - backend/src/modules/reservations/reservations.routes.ts
---

## What Was Built

Rewrote the PUT /Reservations/:id handler to wrap `UPDATE reservations` + `DELETE reservation_guests` + `INSERT reservation_guests` loop inside a single `BEGIN`/`COMMIT`/`ROLLBACK` transaction. Previously, a crash after the DELETE and before all guest re-inserts would permanently destroy the guest list with no recovery. The room row is also locked with `SELECT ... FOR UPDATE` before the availability check runs.

## Key Changes

- Removed `ensureRoomIsAvailable()` call (uses a separate pool connection — would bypass the transaction's lock)
- Inline `client.query()` availability check excludes the current reservation via `id <> $4::uuid` (self-overlap allowed)
- `DELETE FROM reservation_guests` inside transaction — ROLLBACK restores the deleted rows on failure
- `client.release()` in `finally` block

## Verification

- `npx tsc --noEmit` → exit 0
- `grep -c "client.query(\"BEGIN\")"` → 2 (POST + PUT handlers)
- `grep -c "FOR UPDATE"` → 2 (one per handler)
- `grep -c "DELETE FROM reservation_guests"` → 1, inside `client.query()` call
- `grep -c "client.release()"` → 2 (one per handler)
- `ensureRoomIsAvailable` not called in PUT handler body

## Self-Check: PASSED
