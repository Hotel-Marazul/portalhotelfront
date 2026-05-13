---
phase: 02-security-hardening
plan: 02
subsystem: infra
tags: [python, fastapi, settings, environment, security, startup-validation]

# Dependency graph
requires: []
provides:
  - "RuntimeError startup guard — agents service refuses to start when BACKEND_BEARER_TOKEN is absent or empty"
  - "settings.backend_bearer_token typed as str (non-optional) — guaranteed non-empty at runtime"
affects: [02-03, agents-service-auth]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Fail-fast startup validation via RuntimeError at module load time (os.getenv guard before Settings construction)"]

key-files:
  created: []
  modified:
    - agents/app/settings.py

key-decisions:
  - "RuntimeError raised inside load_settings() at module scope — uvicorn never binds a port without valid credentials"
  - "backend_bearer_token narrowed from str | None to str — callers never need None-check"
  - "Local variable computed and validated before passing to frozen dataclass — single source of truth"

patterns-established:
  - "Startup guard pattern: read env var into local, strip, guard with RuntimeError, pass local to dataclass"

requirements-completed: [SEC-04]

# Metrics
duration: 8min
completed: 2026-05-13
---

# Phase 02 Plan 02: BACKEND_BEARER_TOKEN Startup Validation Summary

**RuntimeError startup guard added to agents/app/settings.py — service refuses to start without BACKEND_BEARER_TOKEN, narrowing type from str | None to str**

## Performance

- **Duration:** 8 min
- **Started:** 2026-05-13T14:20:00Z
- **Completed:** 2026-05-13T14:28:00Z
- **Tasks:** 2 (1 code change + 1 smoke test)
- **Files modified:** 1

## Accomplishments
- Added RuntimeError guard at the top of `load_settings()` — agents service crashes at import time if BACKEND_BEARER_TOKEN is absent or empty
- Changed `Settings.backend_bearer_token` type annotation from `str | None` to `str` — eliminates None-checks at call sites
- Replaced `os.getenv("BACKEND_BEARER_TOKEN") or None` in `return Settings(...)` with the local validated variable
- Smoke test confirmed: empty token raises RuntimeError with descriptive message; valid token loads successfully

## Task Commits

Each task was committed atomically:

1. **Task 1: Add BACKEND_BEARER_TOKEN startup validation** - `3d8e7c8` (feat)
2. **Task 2: Smoke test** - verified inline, no code changes (no commit needed)

**Plan metadata:** see final docs commit

## Files Created/Modified
- `agents/app/settings.py` - Added RuntimeError guard in load_settings(), type narrowed to str

## Decisions Made
- Using RuntimeError (not SystemExit or ValueError) — consistent with Python stdlib patterns for startup failures; propagates clearly through uvicorn import chain
- Guard placed before any other load_settings() logic — fail as early as possible
- Local variable `backend_bearer_token` is stripped of whitespace to catch whitespace-only values

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None — edits were straightforward, smoke tests passed on first attempt.

## User Setup Required
None - no external service configuration required beyond the existing `BACKEND_BEARER_TOKEN` env var that operators must already provide.

## Next Phase Readiness
- SEC-04 requirement fulfilled: agents service now fails fast without a bearer token
- Plan 02-03 (APIKeyHeader enforcement on /chat) can proceed — `settings.backend_bearer_token` is now a guaranteed non-empty `str`
- No blockers

---
*Phase: 02-security-hardening*
*Completed: 2026-05-13*
