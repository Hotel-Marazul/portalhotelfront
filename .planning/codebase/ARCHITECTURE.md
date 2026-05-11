<!-- refreshed: 2026-05-11 -->
# Architecture

**Analysis Date:** 2026-05-11

## Summary

PortalHotel is a three-tier hotel management system composed of a Next.js frontend, an Express/Node.js REST API backend, and a Python FastAPI AI-agent service. The three services run as separate Docker containers sharing a bridge network, with a PostgreSQL database as the sole persistent store. The agent layer adds a conversational AI layer that proxies through the Next.js server to the FastAPI service and then calls the backend REST API programmatically.

## Details

### System Overview

```text
┌────────────────────────────────────────────────────────────────────┐
│                    Browser / User                                   │
│                    port 3000                                        │
└───────────────────────────┬────────────────────────────────────────┘
                            │  HTTP + cookie auth
                            ▼
┌────────────────────────────────────────────────────────────────────┐
│               Frontend  (Next.js 15 App Router)                     │
│               container: frontend-marazul  port 3000                │
│   src/app/*  pages    src/components/*  UI                          │
│   src/app/api/agents/chat/route.ts  → proxy to agents service       │
│   src/services/api.ts  → axios client → backend :5000               │
└──────────────┬────────────────────────────┬────────────────────────┘
               │ REST /api/*                │ HTTP /chat (proxy)
               ▼                            ▼
┌──────────────────────────┐  ┌────────────────────────────────────┐
│  Backend  (Express/TS)   │  │  Agents  (FastAPI/Python)          │
│  container: backend-marazul  │  container: agents-marazul         │
│  port 5000               │  │  port 5050 (external: 5051)        │
│  src/app.ts              │  │  app/server.py                     │
│  src/routes/index.ts     │  │  orchestration/supervisor.py       │
│  src/modules/*           │  │  agents/*  tools/*                 │
└──────────────┬───────────┘  └────────────┬───────────────────────┘
               │ pg pool                    │ httpx → /api/*
               ▼                            │
┌──────────────────────────┐               │
│  PostgreSQL 16           │◄──────────────┘
│  container: db-marazul   │
│  port 5432               │
│  DB: portal_hotel        │
└──────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Key File |
|-----------|---------------|----------|
| Next.js Frontend | UI rendering, routing, auth redirect, agent proxy | `frontend/src/app/layout.tsx` |
| Express Backend | REST API, JWT/cookie auth, DB access, business rules | `backend/src/app.ts` |
| FastAPI Agents | Conversational AI, intent routing, booking automation | `agents/app/server.py` |
| PostgreSQL | Sole persistent store for all domain data | `backend/src/db/init.ts` |
| pgAdmin | Database admin UI (dev only) | `docker-compose.yaml` |

### Layers

**Frontend (Next.js App Router):**
- Purpose: Render hotel management UI and proxy agent chat
- Location: `frontend/src/`
- Pages: `frontend/src/app/` — one `page.tsx` per route segment (`dashboard`, `quarto`, `reservas`, `cliente`, `categoria`, `agente`, `login`)
- Components: `frontend/src/components/` — feature-grouped React components
- Services: `frontend/src/services/api.ts` — axios client with `withCredentials: true`; `frontend/src/services/apiService.ts` — thin wrappers `apiGet` / `apiPost`
- Agent proxy: `frontend/src/app/api/agents/chat/route.ts` — Next.js Route Handler that forwards `POST /api/agents/chat` to the FastAPI service at `AGENTS_API_URL`
- Auth: relies on cookie set by backend; 401 response triggers redirect to `/login`

**Backend (Express + TypeScript):**
- Purpose: Domain REST API, auth, overbooking guard, price calculation
- Location: `backend/src/`
- Entry: `backend/src/server.ts` → `backend/src/app.ts`
- Routing: all endpoints under `/api`, registered in `backend/src/routes/index.ts`; auth endpoints bypass `authMiddleware`; all others require valid JWT cookie or Bearer token
- Modules: `backend/src/modules/{auth,categories,clients,pricing-rules,rooms,reservations}/` — each contains a `*.routes.ts` (router + handlers inline) and a `*.schema.ts` (Zod validation)
- DB access: `backend/src/db/client.ts` — `pg` pool with a `query<T>()` helper; raw SQL throughout, no ORM
- Domain models: `backend/src/domain/models.ts` — shared TypeScript interfaces
- Utils: `backend/src/utils/` — `jwt.ts`, `http-error.ts`, `async-handler.ts`, `reservation.ts`

**Agents (FastAPI + Python):**
- Purpose: Conversational AI receptionist for booking, availability, pricing, policy
- Location: `agents/`
- Entry: `agents/app/server.py` — FastAPI app, instantiates `Supervisor`, mounts router
- Supervisor: `agents/orchestration/supervisor.py` — intent classifier → flow router → response rewriter pipeline
- Intent classification: `agents/agents/receptionist_agent.py` — classifies user messages into `booking | availability | pricing | policy | cancel | update | general`
- Flow coordinator: `agents/orchestration/flows.py` — per-intent async methods; validates data, calls specialized agents, calls `DecisionAgent` to compose final `ChatResponse`
- Specialized agents: `agents/agents/` — `AvailabilityAgent`, `BookingAgent`, `PricingAgent`, `PolicyAgent`, `DecisionAgent`, `AgnoResponseAgent`
- Backend bridge: `agents/tools/backend_api.py` — `BackendApiClient` (httpx async) calls the Express REST API with Bearer token
- State: `agents/orchestration/state.py` — `ConversationStore` (in-memory dict), holds `ConversationState` per `conversation_id`
- RAG: `agents/tools/rag_store.py`, `agents/tools/retrieval.py`, `agents/rag/` — policy knowledge base for `PolicyAgent`
- Schemas: `agents/schemas/messages.py` — `ChatRequest`, `ChatResponse`, `EvidenceItem`; `agents/schemas/booking.py` — booking-specific types

### Data Flow

#### Standard UI Request (e.g., list reservations)

1. Browser calls page component (`frontend/src/app/reservas/page.tsx`)
2. Page component calls `apiGet("/Reservations")` via `frontend/src/services/apiService.ts`
3. `frontend/src/services/api.ts` axios client issues `GET http://localhost:5000/api/Reservations` with cookie
4. `backend/src/middlewares/auth.middleware.ts` validates JWT from cookie or Bearer header
5. `backend/src/modules/reservations/reservations.routes.ts` runs SQL via `backend/src/db/client.ts`
6. JSON response returned to browser

#### Agent Chat Request

1. Browser `POST /api/agents/chat` → Next.js Route Handler (`frontend/src/app/api/agents/chat/route.ts`)
2. Route Handler proxies to `http://agents-marazul:5050/chat`
3. `agents/orchestration/supervisor.py` `handle_chat()`:
   a. Appends user turn to `ConversationStore`
   b. `ReceptionistAgent.classify()` extracts intent + fields
   c. `FlowCoordinator` runs the appropriate async flow
   d. Flow calls `BackendApiClient` (httpx) → Express `/api/*`
   e. `DecisionAgent.compose()` builds `ChatResponse`
   f. `AgnoResponseAgent.rewrite()` optionally rewrites reply text via OpenAI
4. `ChatResponse` returned through proxy to browser

#### Authentication Flow

1. `POST /api/auth/login` with email+password
2. `backend/src/modules/auth/auth.service.ts` verifies bcrypt hash, signs JWT
3. JWT set as `HttpOnly` cookie (`auth_token`)
4. All subsequent API requests carry cookie automatically
5. `authMiddleware` verifies token on every protected route; clears cookie and returns 401 on failure

### Database Schema

Tables (defined in `backend/src/db/init.ts`):
- `users` — hotel staff accounts (`admin` | `manager` roles)
- `categories` — room categories with base price
- `rooms` — physical rooms linked to category
- `clients` — guest registry
- `pricing_rules` — age-based pricing modifiers
- `reservations` — core booking record with overbooking guard via SQL conflict check
- `reservation_guests` — guests per reservation, linked to pricing rules

Indexes: `idx_reservations_room_dates` on `(room_id, check_in_date, check_out_date)` for overbooking queries.

### Overbooking Guard

Enforced in `backend/src/modules/reservations/reservations.routes.ts` via `ensureRoomIsAvailable()`: a SQL `SELECT` with date overlap and active status filter runs before every `INSERT` or `UPDATE` on reservations. The agents layer adds a second guard in `agents/orchestration/flows.py` `run_booking()` by calling `AvailabilityAgent.check()` and validating the requested `room_id` is in the available set before calling `BookingAgent.create()`.

### Authentication & Authorization

- JWT signed with secret from env; stored as `HttpOnly` cookie (`auth_token`)
- Auth middleware accepts both cookie and `Authorization: Bearer` header (Bearer used by the agent `BackendApiClient`)
- Only `POST /api/auth/login` and `POST /api/auth/logout` are public; all other `/api/*` routes require a valid token
- Frontend redirects to `/login` on any 401 (`frontend/src/services/api.ts` interceptor)

### Error Handling Strategy

**Backend:** `asyncHandler` wrapper (`backend/src/utils/async-handler.ts`) catches thrown errors and passes to `errorHandler` middleware (`backend/src/middlewares/error-handler.ts`). Domain errors use `HttpError` (`backend/src/utils/http-error.ts`). Zod schema validation via `validate` middleware (`backend/src/middlewares/validate.ts`).

**Agents:** Each flow method in `agents/orchestration/flows.py` wraps `BackendApiError` exceptions and composes a `blocked` `ChatResponse`. The supervisor adds a top-level `except Exception` fallback that triggers a human-handoff response.

### Anti-Patterns

**Inline handler logic in route files:**
Reservation business logic (overbooking check, pricing calculation, DTO mapping) lives directly inside `backend/src/modules/reservations/reservations.routes.ts` rather than a service class. This makes the route file very large (~560 lines) and couples transport to domain logic. New reservation logic should be extracted to a `reservations.service.ts`.

**In-memory conversation state:**
`agents/orchestration/state.py` `ConversationStore` is a plain Python dict. State is lost on process restart and does not scale horizontally. A Redis or database-backed store should be introduced for production use.

**Static occupancy chart data:**
`/reservations/counter-summary` in `backend/src/modules/reservations/reservations.routes.ts` (lines 511-519) returns hardcoded month labels (`Jan`, `Fev`, `Mar`) with the same computed rate repeated three times, rather than real historical data per month.

---

*Architecture analysis: 2026-05-11*
