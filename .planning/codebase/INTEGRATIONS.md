# External Integrations

**Analysis Date:** 2026-05-11

## APIs & External Services

**AI / LLM:**
- OpenAI — Used by the agents service to rewrite chatbot responses via the Agno framework. The `AgnoResponseAgent` (`agents/agents/agno_agent.py`) dynamically loads `agno.models.openai.OpenAIChat` or `agno.models.openai.OpenAIResponses` and calls `agent.run(prompt)` to produce natural-language Portuguese replies.
  - SDK/Client: `agno` (Python package, imported at runtime)
  - Model: configured via `OPENAI_MODEL` env var (default `gpt-4o-mini`)
  - Auth: `OPENAI_API_KEY`

**Internal HTTP — Agents → Backend:**
- The Python agents service calls the Node.js Express backend over HTTP using `httpx` (`agents/tools/backend_api.py`). The `BackendApiClient` class wraps all backend REST calls used by agents (availability, reservations, policies). Auth is a static Bearer token passed in the `Authorization` header.
  - Client: `httpx.AsyncClient`
  - Base URL: `BACKEND_BASE_URL` env var (default `http://localhost:5000/api`)
  - Auth: `BACKEND_BEARER_TOKEN` env var (optional; header omitted when absent)
  - Timeout: `BACKEND_TIMEOUT_SECONDS` env var (default `10`)
  - Endpoints called:
    - `GET /rooms`
    - `GET /rooms/availability?checkIn=&checkOut=&guests=`
    - `GET /Reservations`
    - `POST /Reservations`
    - `PUT /Reservations/{id}`
    - `DELETE /Reservations/{id}`
    - `GET /policies` (graceful fallback to empty list on error)

**Internal HTTP — Frontend → Backend:**
- Next.js frontend communicates with the Express backend over HTTP using `axios` (`frontend/src/services/api.ts`). A shared `apiClient` singleton is configured with `withCredentials: true` so the JWT cookie is forwarded automatically. A response interceptor redirects to `/login` on 401.
  - SDK/Client: `axios` ^1.10.0
  - Base URL: `NEXT_PUBLIC_API_URL` env var (default `http://localhost:5000`)
  - Auth: HTTP-only cookie (`auth_token`) sent automatically by the browser

**Internal HTTP — Frontend → Agents:**
- The `docker-compose.yaml` exposes the agents service via `AGENTS_API_URL=http://agents-marazul:5050` injected into the frontend container. No dedicated frontend client file for this endpoint was found in `frontend/src/` — the integration is wired at the container level for future/in-progress use.

## Data Storage

**Databases:**
- PostgreSQL 16 — sole persistent data store for the backend.
  - Connection: five env vars — `DB_HOST`, `DB_PORT` (5432), `DB_NAME` (`portal_hotel`), `DB_USER`, `DB_PASSWORD`
  - Client: `pg` ^8.13.3 — raw `Pool` with parameterized queries; no ORM. Pool created in `backend/src/db/client.ts`, all queries go through the exported `query<T>()` helper.
  - Tables (defined in `backend/src/db/init.ts`): `users`, `categories`, `rooms`, `clients`, `pricing_rules`, `reservations`, `reservation_guests`
  - Indexes: `idx_reservations_room_dates` on `(room_id, check_in_date, check_out_date)`, `idx_reservation_guests_reservation_id`

**File Storage:**
- RAG knowledge base — flat `.md` / `.txt` files read from the local filesystem at startup. Directory: `agents/rag/knowledge/` by default (override via `RAG_KNOWLEDGE_DIR` env var). Loaded once by `RetrievalPipeline.bootstrap()` in `agents/tools/retrieval.py`.

**Caching:**
- In-memory client-side cache in the frontend: `requestCache` utility used by `useCachedFetch` hook (`frontend/src/hooks/useCachedFetch.ts`). TTL-based, keyed per endpoint. Not shared across browser tabs or server restarts.
- In-memory RAG store: `InMemoryRagStore` (`agents/tools/rag_store.py`) — loaded once at agents process startup, not persisted.

## Authentication & Identity

**Auth Provider:**
- Custom — no third-party identity provider.
  - Implementation: email/password credentials checked against the `users` table; passwords stored as bcrypt hashes (`bcryptjs` ^2.4.3). On successful login, a signed JWT is issued and set as an HTTP-only cookie (`auth_token` by default).
  - JWT library: `jsonwebtoken` ^9.0.2
  - Token signing: `backend/src/utils/jwt.ts` — `signAccessToken` / `verifyAccessToken`
  - Token lifetime: `JWT_EXPIRES_IN` env var (default `8h`)
  - Secret: `JWT_SECRET` env var (min 16 chars, validated by Zod schema in `backend/src/config/env.ts`)
  - Middleware: `backend/src/middlewares/auth.middleware.ts` — accepts token from `Authorization: Bearer` header **or** the cookie; on invalid token, clears the cookie and returns 401
  - Roles: `admin` | `manager` — stored in JWT payload and on the `users` table

**Login / Logout endpoints:**
- `POST /api/User/login` — issues cookie + returns token in JSON body (`backend/src/modules/auth/auth.routes.ts`)
- `POST /api/User/logout` — clears cookie

## Monitoring & Observability

**Error Tracking:**
- None detected (no Sentry, Datadog, or equivalent SDK found).

**Logs:**
- Backend: `morgan` ^1.10.0 with `"combined"` format, registered in `backend/src/middlewares/security.ts`. Logs to stdout.
- Agents: structured JSON event log via `log_event()` helper (`agents/app/logger.py`). Writes to a file path set by `LOG_FILE_PATH` env var (default `agents/logs/agents.log`) and also to stdout.

## CI/CD & Deployment

**Hosting:**
- Docker Compose — `docker-compose.yaml` at repo root defines five services: `frontend-marazul` (Node 22, port 3000), `backend-marazul` (Node 22, port 5000), `agents-marazul` (Python/FastAPI, port 5051→5050), `db-marazul` (PostgreSQL 16, port 5432), `pgadmin-marazul` (pgAdmin 4, port 5050→80).
- Data persistence: named volume `pgdata-marazul-admin` for PostgreSQL.

**CI Pipeline:**
- Not detected (no `.github/workflows/`, `.gitlab-ci.yml`, or equivalent found).

## Environment Configuration

**Backend required env vars** (`backend/.env.example`):
- `NODE_ENV` — `development` | `test` | `production`
- `PORT` — HTTP port (default `5000`)
- `JWT_SECRET` — signing secret (min 16 chars, required)
- `JWT_EXPIRES_IN` — token lifetime (default `8h`)
- `AUTH_COOKIE_NAME` — cookie name (default `auth_token`)
- `CORS_ORIGINS` — comma-separated allowed origins (default `http://localhost:3000`)
- `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` — PostgreSQL connection

**Agents required env vars** (`agents/.env.example`):
- `AGENTS_PORT` — FastAPI listen port (default `5050`)
- `BACKEND_BASE_URL` — backend API root (default `http://localhost:5000/api`)
- `BACKEND_BEARER_TOKEN` — static token for agent→backend calls (optional)
- `BACKEND_TIMEOUT_SECONDS` — request timeout (default `10`)
- `RAG_TOP_K` — number of RAG results to surface (default `3`)
- `RAG_KNOWLEDGE_DIR` — path to knowledge `.md`/`.txt` files (default `agents/rag/knowledge/`)
- `LOG_FILE_PATH` — log output path (default `agents/logs/agents.log`)
- `AGNO_ENABLED` — enables Agno/OpenAI response rewriting (default `true`)
- `OPENAI_API_KEY` — required when `AGNO_ENABLED=true`
- `OPENAI_MODEL` — model ID (default `gpt-4o-mini`)

**Frontend required env vars** (`frontend/.env.local`):
- `NEXT_PUBLIC_API_URL` — backend base URL (default `http://localhost:5000`)
- `AGENTS_API_URL` — agents service base URL (set via Docker Compose as `http://agents-marazul:5050`)

**Secrets location:**
- `backend/.env` — local file, not committed (`.env.example` committed as template)
- `agents/.env` — local file, not committed (`.env.example` committed as template)
- `frontend/.env.local` — local file, not committed

## Webhooks & Callbacks

**Incoming:** None detected.

**Outgoing:** None detected.

## RAG Pipeline

**Implementation:** Custom in-memory, no vector database.
- Documents loaded from `.md` / `.txt` files in `agents/rag/knowledge/` (`agents/tools/rag_store.py` — `load_knowledge_documents`)
- Retrieval is BM25-style token-intersection scoring in `InMemoryRagStore.search()` — no embeddings or semantic search
- `RetrievalPipeline` (`agents/tools/retrieval.py`) wraps store with lazy `bootstrap()` on first `retrieve()` call
- Used exclusively by `PolicyAgent` (`agents/agents/policy_agent.py`) to answer hotel policy questions
- Top-K configurable via `RAG_TOP_K` env var (default `3`)
- Evidence items include source file path and 280-character excerpt

---

*Integration audit: 2026-05-11*
