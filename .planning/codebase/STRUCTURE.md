# Codebase Structure

**Analysis Date:** 2026-05-11

## Summary

The repository is a monorepo with three independent application packages (`frontend/`, `backend/`, `agents/`) plus a root `docker-compose.yaml` that wires them together. Each package has its own `package.json` (or Python project files) and runs as a separate Docker container. There is no shared package or workspace linking between the three — communication is purely over HTTP.

## Details

### Directory Layout

```
portalhotelfront/                   # repo root
├── docker-compose.yaml             # orchestrates all services
├── .github/workflows/              # CI pipeline definitions
├── .planning/codebase/             # GSD analysis documents (this file)
│
├── frontend/                       # Next.js 15 app (port 3000)
│   ├── src/
│   │   ├── app/                    # Next.js App Router pages
│   │   │   ├── layout.tsx          # Root layout — Header + DrawerMenu
│   │   │   ├── page.tsx            # Root redirect
│   │   │   ├── loading.tsx         # Global loading UI
│   │   │   ├── login/page.tsx      # Login page (public route)
│   │   │   ├── dashboard/page.tsx  # Dashboard overview
│   │   │   ├── quarto/page.tsx     # Room management
│   │   │   ├── reservas/page.tsx   # Reservations management
│   │   │   ├── cliente/page.tsx    # Client/guest management
│   │   │   ├── categoria/page.tsx  # Room categories management
│   │   │   ├── agente/page.tsx     # AI agent chat interface
│   │   │   ├── api/agents/chat/
│   │   │   │   └── route.ts        # Next.js Route Handler — agent proxy
│   │   │   └── testes/             # Isolated component test routes (dev)
│   │   ├── components/             # Reusable React components
│   │   │   ├── header.tsx          # Top navigation bar
│   │   │   ├── sidenav.tsx         # Sidebar drawer menu
│   │   │   ├── snackbar.tsx        # Toast notification component
│   │   │   ├── categorias/         # Category CRUD components
│   │   │   ├── clientes/           # Client/guest components + modals
│   │   │   ├── dashboard/          # Dashboard widgets
│   │   │   ├── quartos/            # Room CRUD components
│   │   │   └── reservations/       # Reservation table, drawer, filters
│   │   ├── hooks/
│   │   │   └── useCachedFetch.ts   # SWR-style hook with local cache
│   │   ├── routes/
│   │   │   └── AppRoutes.ts        # Route path constants
│   │   ├── services/
│   │   │   ├── api.ts              # Axios instance (baseURL, interceptors)
│   │   │   └── apiService.ts       # Thin wrappers: apiGet / apiPost
│   │   ├── styles/
│   │   │   └── globals.css         # Tailwind base styles
│   │   ├── types/
│   │   │   └── reservations.ts     # Frontend TypeScript types
│   │   └── utils/
│   │       ├── cache.ts            # Local in-memory cache utility
│   │       ├── cpf.ts              # CPF formatting/validation
│   │       └── format.ts           # Date/currency formatters
│   └── public/                     # Static assets
│
├── backend/                        # Express/TypeScript REST API (port 5000)
│   ├── src/
│   │   ├── server.ts               # Process entry — calls initializeDatabase + createApp + listen
│   │   ├── app.ts                  # Express app factory — registers middleware + routes
│   │   ├── config/
│   │   │   ├── env.ts              # Typed env var access
│   │   │   └── cors.ts             # CORS configuration
│   │   ├── db/
│   │   │   ├── client.ts           # pg Pool + query<T>() helper
│   │   │   ├── init.ts             # CREATE TABLE IF NOT EXISTS + seed defaults
│   │   │   └── seed.ts             # Additional seed data
│   │   ├── domain/
│   │   │   └── models.ts           # Shared TypeScript interfaces (Room, Client, Reservation, …)
│   │   ├── middlewares/
│   │   │   ├── auth.middleware.ts  # JWT cookie/Bearer verification
│   │   │   ├── error-handler.ts    # Global Express error handler
│   │   │   ├── not-found.ts        # 404 handler
│   │   │   ├── security.ts         # helmet, cors, body-parser registration
│   │   │   └── validate.ts         # Zod validation middleware factory
│   │   ├── modules/                # Feature modules (routes + schema per module)
│   │   │   ├── auth/
│   │   │   │   ├── auth.routes.ts  # POST /auth/login, POST /auth/logout
│   │   │   │   ├── auth.schema.ts  # Zod schemas for auth payloads
│   │   │   │   └── auth.service.ts # bcrypt verify + JWT sign
│   │   │   ├── categories/
│   │   │   │   ├── categories.routes.ts
│   │   │   │   └── categories.schema.ts
│   │   │   ├── clients/
│   │   │   │   ├── clients.routes.ts
│   │   │   │   └── clients.schema.ts
│   │   │   ├── pricing-rules/
│   │   │   │   └── pricing-rules.routes.ts
│   │   │   ├── rooms/
│   │   │   │   ├── rooms.routes.ts
│   │   │   │   └── rooms.schema.ts
│   │   │   └── reservations/
│   │   │       ├── reservations.routes.ts  # Largest file — all reservation logic
│   │   │       └── reservations.schema.ts
│   │   ├── routes/
│   │   │   └── index.ts            # Assembles all module routers under /api
│   │   ├── types/
│   │   │   ├── auth.ts             # JWT payload type
│   │   │   └── express.d.ts        # Express Request augmentation (req.user)
│   │   ├── data/                   # Static seed/fixture data files
│   │   └── utils/
│   │       ├── async-handler.ts    # Wraps async route handlers for error propagation
│   │       ├── http-error.ts       # HttpError class with status code
│   │       ├── jwt.ts              # signAccessToken / verifyAccessToken
│   │       └── reservation.ts      # calculateReservationTotal() pricing utility
│   └── dist/                       # Compiled JS output (gitignored in practice)
│
└── agents/                         # FastAPI AI agent service (port 5050)
    ├── app/
    │   ├── server.py               # FastAPI app factory + uvicorn entry point
    │   ├── router.py               # Mounts /health and /chat endpoints
    │   ├── settings.py             # Pydantic Settings — env vars
    │   └── logger.py               # Structured JSON logger
    ├── orchestration/
    │   ├── supervisor.py           # Supervisor — wires all agents, drives handle_chat()
    │   ├── flows.py                # FlowCoordinator — per-intent async flow methods
    │   └── state.py                # ConversationStore — in-memory turn history + context
    ├── agents/
    │   ├── receptionist_agent.py   # Intent classifier + field extractor
    │   ├── availability_agent.py   # Checks room availability via BackendApiClient
    │   ├── booking_agent.py        # Creates / updates / cancels reservations
    │   ├── pricing_agent.py        # Estimates stay cost from available rooms
    │   ├── policy_agent.py         # Answers policy questions via RAG + backend
    │   ├── decision_agent.py       # Composes final ChatResponse from agent outputs
    │   └── agno_agent.py           # Rewrites replies via OpenAI (Agno integration)
    ├── tools/
    │   ├── backend_api.py          # BackendApiClient — httpx async wrapper for Express API
    │   ├── rag_store.py            # RAG vector store operations
    │   ├── retrieval.py            # RetrievalPipeline — queries RAG store
    │   ├── validators.py           # validate_period() date guard
    │   └── prompt_loader.py        # Loads prompt templates from agents/prompts/
    ├── schemas/
    │   ├── messages.py             # ChatRequest, ChatResponse, EvidenceItem, IntentName
    │   ├── booking.py              # Booking-specific Pydantic models
    │   └── tool_contracts.py       # Typed contracts for tool return values
    ├── prompts/                    # Jinja2 / plain-text prompt templates
    ├── rag/
    │   ├── knowledge/              # Source documents for RAG ingestion
    │   └── ingest.py               # Script to build/refresh the vector store
    ├── logs/                       # Structured log output directory
    ├── tests/
    │   ├── fixtures/               # Test fixture data
    │   ├── test_booking_flow.py
    │   ├── test_overbooking_guard.py
    │   └── test_policy_rag.py
    └── Dockerfile                  # Python image build for agents service
```

## Key File Locations

**Entry Points:**
- `backend/src/server.ts` — Node.js process start; database init then HTTP listen
- `frontend/src/app/layout.tsx` — Next.js root layout; controls Header/Sidenav presence
- `agents/app/server.py` — FastAPI app; uvicorn run target

**API Surface:**
- `backend/src/routes/index.ts` — single place that assembles all Express routers
- `frontend/src/app/api/agents/chat/route.ts` — Next.js Route Handler bridging frontend to agents

**Domain Logic:**
- `backend/src/domain/models.ts` — canonical TypeScript entity definitions
- `backend/src/utils/reservation.ts` — `calculateReservationTotal()` — authoritative pricing logic
- `backend/src/modules/reservations/reservations.routes.ts` — `ensureRoomIsAvailable()` overbooking guard

**AI Orchestration:**
- `agents/orchestration/supervisor.py` — top-level agent pipeline
- `agents/orchestration/flows.py` — per-intent flow implementations

**Configuration:**
- `docker-compose.yaml` — service topology, ports, env injection
- `backend/src/config/env.ts` — typed backend env access
- `agents/app/settings.py` — Pydantic Settings for agents

## Naming Conventions

**Frontend files:**
- Page files: `page.tsx` (Next.js convention)
- Component files: PascalCase (`ReservationsTable.tsx`, `GraficoOcupacaoDashboard.tsx`)
- Service/utility files: camelCase (`apiService.ts`, `format.ts`)
- Hook files: camelCase prefixed with `use` (`useCachedFetch.ts`)

**Backend files:**
- Module files: `kebab-case.purpose.ts` (`reservations.routes.ts`, `auth.schema.ts`)
- Utility files: `kebab-case.ts` (`async-handler.ts`, `http-error.ts`)

**Agents files:**
- Module files: `snake_case_purpose.py` (`booking_agent.py`, `backend_api.py`)
- Class names: PascalCase (`Supervisor`, `FlowCoordinator`, `BackendApiClient`)

**Route naming:** Backend REST routes use PascalCase resource names in URLs (`/Reservations`, `/Rooms`) — mixed with lowercase in some places (`/rooms/availability`). Maintain existing casing per module when adding endpoints.

## Where to Add New Code

**New UI page/feature:**
- Page: `frontend/src/app/<feature-name>/page.tsx`
- Components: `frontend/src/components/<feature-name>/` directory
- API calls: use `apiGet` / `apiPost` from `frontend/src/services/apiService.ts`
- Types: `frontend/src/types/<feature-name>.ts`

**New backend domain module:**
- Create `backend/src/modules/<module-name>/` with `<module-name>.routes.ts` and `<module-name>.schema.ts`
- Register router in `backend/src/routes/index.ts`
- Add domain interface to `backend/src/domain/models.ts`
- Add `CREATE TABLE` to `backend/src/db/init.ts`

**New agent capability:**
- Create agent class in `agents/agents/<capability>_agent.py`
- Add intent branch in `agents/orchestration/supervisor.py` `handle_chat()`
- Add flow method in `agents/orchestration/flows.py` `FlowCoordinator`
- Add intent to `IntentName` union in `agents/schemas/messages.py`
- Expose new backend endpoints via `agents/tools/backend_api.py`

**Shared utilities:**
- Backend helpers: `backend/src/utils/`
- Frontend helpers: `frontend/src/utils/`
- Agent tools/validators: `agents/tools/`

## Special Directories

**`frontend/.next/`:**
- Purpose: Next.js build cache and compiled output
- Generated: Yes
- Committed: No

**`backend/dist/`:**
- Purpose: TypeScript compiled output (mirrors `src/`)
- Generated: Yes
- Committed: No (but present in repo due to missing gitignore entry)

**`agents/rag/knowledge/`:**
- Purpose: Source documents ingested into the RAG vector store
- Generated: No (manually maintained)
- Committed: Yes

**`agents/logs/`:**
- Purpose: Structured JSON log files written by `agents/app/logger.py`
- Generated: Yes
- Committed: No

**`.planning/codebase/`:**
- Purpose: GSD architecture/convention analysis documents
- Generated: Yes (by GSD mapper)
- Committed: Yes

---

*Structure analysis: 2026-05-11*
