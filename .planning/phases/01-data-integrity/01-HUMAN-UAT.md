---
status: partial
phase: 1-data-integrity
source: [01-VERIFICATION.md]
started: 2026-05-11
updated: 2026-05-11
---

## Current Test

[awaiting human testing]

## Tests

### 1. DATA-01 crash simulation — POST atomicity
expected: Inject fault (throw) after `INSERT INTO reservations` but before `INSERT INTO reservation_guests`. Restart server. Call POST /Reservations. Verify: zero rows in `reservations` table for that attempt (ROLLBACK removed the reservation row). Remove the throw, restart.
result: [pending]

### 2. DATA-02 crash simulation — PUT atomicity
expected: Inject fault (throw) after `DELETE FROM reservation_guests` but before the `INSERT` loop. Restart server. Call PUT /Reservations/:id. Verify: GET /Reservations/:id still returns the ORIGINAL guest list (ROLLBACK restored the deleted guest rows).
result: [pending]

### 3. DATA-03 concurrency — simultaneous POST for same room/dates
expected: Fire two simultaneous POST /Reservations requests for the same roomId and overlapping date range. Verify exactly one response is 201 and one is 409. Also verify via DB: `SELECT COUNT(*) FROM reservations WHERE room_id='<id>' AND status='Confirmada'` = 1.
result: [pending]

### 4. DATA-04 live response — real monthly occupancy
expected: With seeded reservation data spanning at least 2 different calendar months, call GET /api/reservations/counter-summary. Verify response.taxaOcupacaoMes contains distinct entries with Portuguese month labels (e.g. "Jan", "Fev") and different taxa values. Verify it is NOT a 3-item array where all taxa are identical.
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps
