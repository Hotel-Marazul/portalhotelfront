# Phase 2: Security Hardening - Research

**Researched:** 2026-05-13
**Domain:** Express rate limiting, FastAPI API key auth, Docker Compose mandatory variable interpolation, Python startup validation
**Confidence:** HIGH

---

## Summary

Phase 2 has four security requirements (SEC-01 through SEC-04). Research reveals that **one of the four is already fully implemented** (SEC-01), one requires a two-file change to the Docker Compose setup (SEC-03), and two require adding authentication/validation logic to the FastAPI agents service (SEC-02, SEC-04).

**SEC-01 is done.** `backend/src/modules/auth/auth.routes.ts` already applies `express-rate-limit` with `limit: 10` and `windowMs: 15 * 60 * 1000` directly on `POST /User/login`. The 11th request in 15 minutes returns 429. No code change required — only verification.

**SEC-03 is a config-only fix.** The root `.env` (not tracked by git) contains `DB_USER=admin` and `DB_PASSWORD=admin`. Docker Compose v5 reads `$PWD/.env` automatically, so any developer with that local file runs the DB with default credentials. The fix is: (a) replace the literal values in `.env` with empty or remove the file, and (b) switch `docker-compose.yaml` from `${DB_USER}` (silent empty string on missing) to `${DB_USER:?DB_USER is required}` (fail-fast with error message). No application code changes.

**SEC-02 requires adding FastAPI API key auth.** The `/chat` endpoint in `agents/app/router.py` has no authentication. The standard FastAPI pattern uses `APIKeyHeader` from `fastapi.security` as a `Depends` dependency on the route. The key to validate against is `settings.backend_bearer_token` — the same token agents use to call the backend.

**SEC-04 requires startup validation in Python.** `agents/app/settings.py` currently stores `backend_bearer_token: str | None` with no failure when absent. The fix is to add a validation check in `load_settings()` that raises `RuntimeError` (or `SystemExit`) when the env var is missing or empty, so the container exits with a descriptive error before accepting traffic.

**Primary recommendation:** Implement as 3 plans — (1) verify SEC-01 + implement SEC-03 (config changes, zero risk), (2) SEC-04 startup validation, (3) SEC-02 API key middleware. Order matters: SEC-04 must land before SEC-02 so the validation token is guaranteed to exist when the auth check reads it.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SEC-01 | `POST /User/login` has dedicated rate limit (max 10 req/15min per IP) | Already implemented in `auth.routes.ts` — verified by code read. Planner task: confirm + write test. |
| SEC-02 | Agents FastAPI requires API key on all `/chat` requests | Not implemented. `APIKeyHeader` + `Depends` on the route. Key = `BACKEND_BEARER_TOKEN`. |
| SEC-03 | Default credentials (admin/admin) removed from `docker-compose.yaml` and `env.ts` | Root `.env` has admin/admin; Compose reads it automatically. Fix: remove values + add `:?` interpolation. `env.ts` already uses `z.string().min(1)` with no default — clean. |
| SEC-04 | `BACKEND_BEARER_TOKEN` mandatory in agents config (not optional) | Currently `str \| None` with no failure. Fix: raise `RuntimeError` at module load time in `load_settings()`. |
</phase_requirements>

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Login rate limiting | API / Backend (Express middleware) | — | Rate limit enforced server-side before handler runs |
| DB credential validation | Infrastructure (Docker Compose) | API / Backend (Zod env schema) | Compose fails at startup; backend Zod fails at process start |
| Agents API key auth | Agents service (FastAPI middleware) | — | Auth must happen in the FastAPI layer before any agent logic runs |
| `BACKEND_BEARER_TOKEN` mandatory check | Agents service (Python startup) | — | Fail at `load_settings()` call time, before uvicorn binds a port |

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| express-rate-limit | ^7.4.1 (installed); 8.5.1 latest | Per-route HTTP rate limiting | Already present, idiomatic Express pattern |
| fastapi | 0.116.1 (pinned in requirements.txt) | FastAPI framework including `fastapi.security` | Native — `APIKeyHeader` ships with FastAPI |
| pydantic | 2.11.7 (pinned) | Request/response validation | Already used in agents schemas |

**No new packages required for any of the four requirements.**

### Version verification
`express-rate-limit`: `npm view express-rate-limit version` returns `8.5.1` — installed version `^7.4.1` is pinned, which is stable and compatible. [VERIFIED: npm registry]

`fastapi` 0.116.1 is pinned in `agents/requirements.txt`. `fastapi.security.APIKeyHeader` has been stable since FastAPI 0.60+. [VERIFIED: codebase read + requirements.txt]

---

## Architecture Patterns

### System Architecture Diagram

```
[Browser / Frontend]
    |
    | POST /api/User/login
    v
[Express Backend :5000]
    loginRateLimit (10 req / 15min / IP) ← already applied
    validate(loginBodySchema)
    login() handler
    |
    | SET cookie auth_token
    v
[Browser session established]

[Browser / Frontend]
    |
    | POST /api/agents/chat (Next.js API route proxy)
    v
[FastAPI Agents :5051]
    X-API-Key header check ← to be added (SEC-02)
    supervisor.handle_chat()
    |
    | HTTP + Bearer token
    v
[Express Backend :5000]
    authMiddleware (JWT cookie) — separate concern

[Docker Compose startup]
    ${DB_USER:?error} ← fail-fast interpolation to be added (SEC-03)
    [PostgreSQL :5432] starts
    [Agents service startup] → load_settings() raises RuntimeError if no BACKEND_BEARER_TOKEN (SEC-04)
```

### Recommended Project Structure
No structural changes required. All changes are within existing files:
```
backend/src/modules/auth/auth.routes.ts   # SEC-01: verify only
docker-compose.yaml                        # SEC-03: :? interpolation
.env                                       # SEC-03: remove admin values
agents/app/settings.py                    # SEC-04: startup validation
agents/app/router.py                      # SEC-02: APIKeyHeader Depends
```

### Pattern 1: Docker Compose Mandatory Variable Interpolation
**What:** Docker Compose `${VAR:?message}` causes `docker compose up` to exit immediately with the error message when `VAR` is unset or empty.
**When to use:** Any env var that must be explicitly set — never silently defaulted.
**Example:**
```yaml
# docker-compose.yaml
environment:
  - DB_USER=${DB_USER:?DB_USER is required — copy .env.compose.example to .env.compose and set a value}
  - DB_PASSWORD=${DB_PASSWORD:?DB_PASSWORD is required — copy .env.compose.example to .env.compose and set a value}
  - BACKEND_BEARER_TOKEN=${BACKEND_BEARER_TOKEN:?BACKEND_BEARER_TOKEN is required — generate a random token}
```
[CITED: docs.docker.com/reference/compose-file/interpolation/]

### Pattern 2: FastAPI APIKeyHeader Dependency
**What:** `APIKeyHeader` creates a named header slot; `Depends(verify_api_key)` enforces it per-route.
**When to use:** Simple static-token authentication on internal service endpoints.
**Example:**
```python
# agents/app/auth.py (new file)
from fastapi import Depends, HTTPException, Security
from fastapi.security import APIKeyHeader
from starlette.status import HTTP_403_FORBIDDEN
from app.settings import settings

_api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)

async def verify_api_key(api_key: str | None = Security(_api_key_header)) -> str:
    if not api_key or api_key != settings.backend_bearer_token:
        raise HTTPException(
            status_code=HTTP_403_FORBIDDEN,
            detail="Invalid or missing API key",
        )
    return api_key
```
Then in router:
```python
# agents/app/router.py
from app.auth import verify_api_key

@router.post("/chat", response_model=ChatResponse, dependencies=[Depends(verify_api_key)])
async def chat(payload: ChatRequest) -> ChatResponse:
    return await supervisor.handle_chat(payload)
```
[CITED: itsjoshcampos.codes/fast-api-api-key-authorization — verified pattern matches FastAPI docs security module]

### Pattern 3: Python Startup Validation (fail-fast on missing env)
**What:** Raise `RuntimeError` inside `load_settings()` before returning the frozen `Settings` object. Uvicorn propagates unhandled exceptions on import, crashing the process with exit code 1.
**When to use:** Required env vars that must not be silently absent — security tokens, secrets.
**Example:**
```python
# agents/app/settings.py
def load_settings() -> Settings:
    backend_bearer_token = os.getenv("BACKEND_BEARER_TOKEN", "").strip()
    if not backend_bearer_token:
        raise RuntimeError(
            "BACKEND_BEARER_TOKEN is required but not set. "
            "Add it to your .env file before starting the agents service."
        )
    # ... rest of settings
    return Settings(
        backend_bearer_token=backend_bearer_token,
        ...
    )
```
[ASSUMED] Uvicorn exits on `RuntimeError` raised at import time with a non-zero exit code — verified by reasoning: `settings = load_settings()` is module-level; unhandled exception at module import crashes the process before `uvicorn.run` is ever called. Risk if wrong: service might silently swallow the error in some uvicorn versions.

### Anti-Patterns to Avoid
- **`${VAR:-}` for security credentials:** The `:-` syntax silently falls back to empty string. Empty string does not fail Docker Compose — it starts with a blank password. The `.env` change from `:-` to `:?` is the critical difference.
- **`auto_error=True` on APIKeyHeader:** When `auto_error=True`, FastAPI returns a 403 automatically but the error message is a generic OpenAPI security error. Using `auto_error=False` and raising manually gives a cleaner, controlled error message.
- **Validating `BACKEND_BEARER_TOKEN` only in the request handler:** If the token check happens per-request rather than at startup, the service starts, accepts connections, and fails on first use — giving no early warning. Startup validation makes the failure immediate and visible in container logs.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Rate limiting | Custom counter + Redis | `express-rate-limit` (already installed) | Handles memory store, window reset, header standards (RFC 6585 draft-7) |
| API key header parsing | Manual `request.headers.get()` + if-else | `fastapi.security.APIKeyHeader` | OpenAPI docs integration; consistent with FastAPI dependency system |
| Settings validation | Multiple `if not os.getenv(...)` checks | Single guard in `load_settings()` | Keeps all validation in one place; `Settings` dataclass stays clean |

**Key insight:** All tooling needed is already present in the stack. This phase is configuration and wiring — not new dependencies.

---

## Common Pitfalls

### Pitfall 1: Docker Compose reads `.env` automatically
**What goes wrong:** Developer renames or removes a credentials line from `docker-compose.yaml` but the root `.env` file still provides the value — the fix appears to work in CI/CD (no `.env`) but not locally.
**Why it happens:** Docker Compose v1+ automatically loads `$PWD/.env` as the default env-file. The `${VAR}` interpolation in `docker-compose.yaml` silently substitutes values from `.env` before validation.
**How to avoid:** Use `:?` syntax so Docker Compose validates that the variable is non-empty, regardless of where it comes from. Test by temporarily unsetting the variable: `DB_USER= docker compose up` should fail.
**Warning signs:** `docker compose config | grep DB_USER` shows `admin` even after you think you removed the default.
[VERIFIED: confirmed via `docker compose config` run against this codebase — `DB_PASSWORD: admin` appears from `.env`]

### Pitfall 2: SEC-04 check must happen before SEC-02 auth check reads the token
**What goes wrong:** If `settings.backend_bearer_token` is `None` at startup (no RuntimeError) and the API key check does `api_key != settings.backend_bearer_token`, then `None != None` is `False` — i.e., a request with no key would be accepted because both sides are `None`.
**Why it happens:** Python `None != None` is `False`, so the guard `api_key != settings.backend_bearer_token` passes when both are `None`.
**How to avoid:** The startup `RuntimeError` in `load_settings()` guarantees `settings.backend_bearer_token` is a non-empty string before the process serves any requests. Alternatively, the auth function can also guard with `if not settings.backend_bearer_token: raise RuntimeError(...)`.
**Warning signs:** `POST /chat` with no `X-API-Key` header returns 200 instead of 403.

### Pitfall 3: `BACKEND_BEARER_TOKEN` used for two purposes
**What goes wrong:** The same env var (`BACKEND_BEARER_TOKEN`) now serves two purposes: (1) agents→backend HTTP auth header, and (2) client→agents API key. This is intentional by the requirement but must be documented clearly so operators know the same token value must be in both the calling client and the agents service.
**Why it happens:** The requirement deliberately reuses the existing token as the agents service API key.
**How to avoid:** Document in `.env.compose.example` that `BACKEND_BEARER_TOKEN` protects both the agents `/chat` endpoint and the agents→backend calls. The token value must be the same on both sides.
**Warning signs:** Frontend `/api/agents/chat` proxy route returns 403 because the Next.js API route is not forwarding the `X-API-Key` header.

### Pitfall 4: Next.js proxy route must forward the API key
**What goes wrong:** The Next.js API route at `frontend/src/app/api/agents/chat/route.ts` proxies requests to the agents service. After SEC-02 is added, that proxy must include the `X-API-Key` header or all chat requests from the frontend will fail with 403.
**Why it happens:** The Next.js route calls the agents service server-to-server, so the browser's user session does not carry the agents API key.
**How to avoid:** In the Next.js proxy route, read `AGENTS_API_KEY` (or `BACKEND_BEARER_TOKEN`) from the backend environment and add it as a header to the outbound fetch.
**Warning signs:** Chat works in direct curl to agents but fails through the frontend.

---

## Code Examples

### SEC-01: Verify existing rate limit (no change needed)
```typescript
// backend/src/modules/auth/auth.routes.ts — current state (VERIFIED: codebase read)
const loginRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,   // 15 minutes
  limit: 10,                   // 10 allowed, 11th gets 429
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { flag: false, message: "Muitas tentativas de login. Tente novamente em 15 minutos." }
});
// Applied only to /User/login — global limiter in security.ts is 200/15min
```

### SEC-03: Docker Compose mandatory variable interpolation
```yaml
# docker-compose.yaml — environment section for backend-marazul and db-marazul
environment:
  - DB_USER=${DB_USER:?DB_USER is required. See .env.compose.example}
  - DB_PASSWORD=${DB_PASSWORD:?DB_PASSWORD is required. See .env.compose.example}
```
```yaml
# docker-compose.yaml — agents-marazul environment
environment:
  - BACKEND_BEARER_TOKEN=${BACKEND_BEARER_TOKEN:?BACKEND_BEARER_TOKEN is required}
```
[CITED: docs.docker.com/reference/compose-file/interpolation/]

### SEC-04: Startup validation in settings.py
```python
# agents/app/settings.py — load_settings() guard
def load_settings() -> Settings:
    backend_bearer_token = (os.getenv("BACKEND_BEARER_TOKEN") or "").strip()
    if not backend_bearer_token:
        raise RuntimeError(
            "BACKEND_BEARER_TOKEN is required but not set. "
            "Set it in your .env file (agents service). "
            "Refusing to start without authentication configured."
        )
    # Change type annotation: backend_bearer_token: str (not str | None)
    return Settings(
        backend_bearer_token=backend_bearer_token,
        ...
    )
```

### SEC-02: FastAPI API key auth dependency
```python
# agents/app/auth.py (new file)
from fastapi import Depends, HTTPException, Security
from fastapi.security import APIKeyHeader
from starlette.status import HTTP_403_FORBIDDEN
from app.settings import settings

_api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)

async def verify_api_key(api_key: str | None = Security(_api_key_header)) -> str:
    if not api_key or api_key != settings.backend_bearer_token:
        raise HTTPException(
            status_code=HTTP_403_FORBIDDEN,
            detail="Invalid or missing API key",
        )
    return api_key
```
```python
# agents/app/router.py — protect /chat
from fastapi import APIRouter, Depends
from app.auth import verify_api_key

@router.post("/chat", response_model=ChatResponse, dependencies=[Depends(verify_api_key)])
async def chat(payload: ChatRequest) -> ChatResponse:
    return await supervisor.handle_chat(payload)
```

### SEC-02: Next.js proxy must forward the API key
```typescript
// frontend/src/app/api/agents/chat/route.ts — add header to outbound fetch
const agentsApiKey = process.env.AGENTS_API_KEY ?? process.env.BACKEND_BEARER_TOKEN ?? "";
const response = await fetch(`${agentsUrl}/chat`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-API-Key": agentsApiKey,   // forward the token
  },
  body: JSON.stringify(payload),
});
```

---

## Runtime State Inventory

> Rename/refactor phase: Not applicable. This is a security hardening phase — no string renames.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Docker Compose | SEC-03 validation testing | Yes | v5.1.3 | — |
| `express-rate-limit` npm | SEC-01 | Yes (installed) | ^7.4.1 | — |
| `fastapi.security` module | SEC-02 | Yes (ships with fastapi 0.116.1) | 0.116.1 | — |
| Python 3.12 (agents container) | SEC-04 | Yes (Docker image) | 3.12 | — |

[VERIFIED: `docker compose version` → v5.1.3; `backend/package.json` → express-rate-limit ^7.4.1; `agents/requirements.txt` → fastapi==0.116.1]

**No missing dependencies.** All tooling for this phase is already installed.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None installed yet (Wave 0 gap for any backend tests) |
| Config file | none — Wave 0 creates vitest.config.ts if tests are added |
| Quick run command | `curl` smoke tests (no test runner for this phase) |
| Full suite command | Manual verification per success criteria |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SEC-01 | 11th login attempt in 15min returns 429 | smoke (curl) | `curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:5000/api/User/login -H "Content-Type: application/json" -d '{"email":"x@x.com","password":"wrong"}'` (run 11 times) | ❌ no test file — manual curl loop |
| SEC-02 | POST /chat without X-API-Key returns 403 | smoke (curl) | `curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:5051/chat -H "Content-Type: application/json" -d '{}'` | ❌ no test file — manual curl |
| SEC-03 | `docker compose up` without env fails | manual | Rename `.env`, run `docker compose up`, observe exit | ❌ manual only |
| SEC-04 | Missing BACKEND_BEARER_TOKEN crashes agents | smoke | `BACKEND_BEARER_TOKEN= python -c "from agents.app.settings import settings"` | ❌ no test file |

> Note: This phase is infrastructure/config-heavy. Automated tests for the rate limiter and API key guard would require a test harness not yet installed. Planner should include manual smoke-test steps in each plan's verification section.

### Wave 0 Gaps
- No Vitest installed for backend — if automated SEC-01 tests are added, install vitest first
- No pytest runner confirmed locally for agents — manual Python invocation sufficient for SEC-04 check

*(The planner may choose to keep this phase verification as manual curl smoke tests, consistent with zero-test-infrastructure baseline.)*

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Rate limit on login (SEC-01); API key on agents (SEC-02) |
| V3 Session Management | no | JWT cookies already handled by existing middleware |
| V4 Access Control | yes | BACKEND_BEARER_TOKEN mandatory (SEC-04) |
| V5 Input Validation | no | Not in scope for this phase |
| V6 Cryptography | no | Using existing JWT/bcrypt setup |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Brute-force login | Spoofing | Per-IP rate limit on `/User/login` (SEC-01) — already implemented |
| Unauthenticated agent API calls | Elevation of Privilege | `APIKeyHeader` dependency on `/chat` (SEC-02) |
| Default DB credentials in git/compose | Information Disclosure | Remove from `.env`, use `:?` interpolation (SEC-03) |
| Agent startup with no token | Elevation of Privilege | RuntimeError at `load_settings()` time (SEC-04) |

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `legacyHeaders: true` (X-RateLimit-*) | `standardHeaders: "draft-7"` (RateLimit-*) | express-rate-limit v7 | Already using current standard |
| `${VAR:-}` (silent empty) | `${VAR:?error}` (fail-fast) | Docker Compose compose-spec | SEC-03 requires switching to `:?` |

**No deprecated patterns to remediate beyond what's captured above.**

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Uvicorn exits with non-zero code on `RuntimeError` raised at module import time (before `uvicorn.run`) | Pattern 3, SEC-04 example | Service might start anyway if uvicorn catches the exception; test manually by running `python -m app.server` without BACKEND_BEARER_TOKEN set |
| A2 | `X-API-Key` is the header name the Next.js proxy forwards to agents | Pitfall 4, SEC-02 example | If the frontend proxy uses a different env var name, the forward will send an empty key; planner must check `frontend/src/app/api/agents/chat/route.ts` |
| A3 | `BACKEND_BEARER_TOKEN` is the correct token to use as agents API key (same token for both agent→backend auth and client→agents auth) | SEC-02 pattern | The double-use is by design per CLAUDE.md, but if the backend `authMiddleware` and agents key need to be separate, a new env var `AGENTS_API_KEY` should be introduced |

---

## Open Questions

1. **Does the Next.js proxy route (`frontend/src/app/api/agents/chat/route.ts`) exist and what headers does it send?**
   - What we know: The `AGENTS_API_URL` env var is set in docker-compose for the frontend service
   - What's unclear: Whether the existing proxy code reads and forwards an API key header
   - Recommendation: Read the file before planning SEC-02 tasks; it may need a new env var injection

2. **Should `/health` and `/tools` endpoints in agents be protected or left open?**
   - What we know: The requirement says "all `/chat` requests" — not all routes
   - What's unclear: Whether liveness/readiness probes need unauthenticated access to `/health`
   - Recommendation: Leave `/health` open (standard practice for container healthchecks); protect `/chat` and `/tools`

---

## Sources

### Primary (HIGH confidence)
- Codebase read — `backend/src/modules/auth/auth.routes.ts` — SEC-01 implementation verified
- Codebase read — `agents/app/settings.py` — SEC-04 current state (`str | None`, no validation)
- Codebase read — `agents/app/router.py` — SEC-02 current state (no auth dependency)
- Codebase read — `docker-compose.yaml` — SEC-03 current state (`${BACKEND_BEARER_TOKEN:-}`)
- Codebase read — `.env` — confirmed `DB_USER=admin`, `DB_PASSWORD=admin` present locally
- `docker compose config` output — confirmed `DB_PASSWORD: admin` resolved at runtime
- `npm view express-rate-limit version` → 8.5.1 [VERIFIED: npm registry]
- `agents/requirements.txt` → `fastapi==0.116.1` [VERIFIED: codebase read]

### Secondary (MEDIUM confidence)
- [Docker Compose interpolation docs](https://docs.docker.com/reference/compose-file/interpolation/) — `:?` mandatory variable syntax confirmed
- [FastAPI API key pattern](https://itsjoshcampos.codes/fast-api-api-key-authorization) — `APIKeyHeader` + `Security` + `HTTPException(403)` pattern

### Tertiary (LOW confidence)
- None

---

## Metadata

**Confidence breakdown:**
- SEC-01 status (already done): HIGH — read code, confirmed `limit: 10`
- SEC-02 pattern (FastAPI APIKeyHeader): HIGH — verified against official FastAPI security module and documented pattern
- SEC-03 pattern (Docker Compose `:?`): HIGH — confirmed via Docker official interpolation docs
- SEC-04 pattern (Python startup RuntimeError): MEDIUM — reasoning-based; actual uvicorn crash behavior tagged A1

**Research date:** 2026-05-13
**Valid until:** 2026-06-13 (stable libraries; Docker Compose interpolation spec is frozen)
