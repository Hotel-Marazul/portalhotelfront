# Technology Stack

**Analysis Date:** 2026-05-11

## Summary

This is a three-tier hotel management portal composed of a Next.js frontend, an Express/TypeScript backend, and a Python AI agents service. All three tiers run in Docker containers orchestrated via a single `docker-compose.yaml`. The database is PostgreSQL 16 managed through a raw `pg` connection pool (no ORM).

## Details

### Languages

**Primary:**
- TypeScript 5.x — backend API (`backend/src/`) and frontend (`frontend/src/`)
- Python 3.12 — AI agents service (`agents/`)

**Secondary:**
- JavaScript — config files (`eslint.config.mjs`, `postcss.config.mjs`, `next.config.ts`)

### Runtime

**Backend & Frontend:**
- Node.js 22 (via `node:22-slim` Docker image)
- Package Manager: npm (lockfiles present at `backend/package-lock.json` and `frontend/package-lock.json`)

**Agents:**
- Python 3.12 (via `python:3.12-slim` Docker image)
- Package Manager: pip (lockfile: none — only `agents/requirements.txt`)

### Frameworks

**Frontend:**
- Next.js 15.3.1 — App Router, standalone output mode, Turbopack in local dev
  - Config: `frontend/next.config.ts`
  - Path alias: `@/*` → `frontend/src/*`

**Backend:**
- Express 4.19.2 — REST API server
  - Entry point: `backend/src/server.ts`
  - App factory: `backend/src/app.ts`

**Agents:**
- FastAPI 0.116.1 — HTTP server for the AI agent layer
  - Entry point: `agents/app/server.py`
  - ASGI server: Uvicorn 0.35.0

### UI / Styling

- Material UI (MUI) 7.x — primary component library
  - `@mui/material` 7.2.0
  - `@mui/icons-material` 7.0.2
  - `@mui/lab` 7.0.0-beta.11
  - `@mui/x-date-pickers` 8.2.0
- Tailwind CSS 4.x — utility classes (PostCSS integration via `@tailwindcss/postcss`)
- Emotion — CSS-in-JS runtime for MUI (`@emotion/react`, `@emotion/styled`)

### Key Libraries — Frontend

- `axios` 1.10.0 — HTTP client (configured in `frontend/src/services/api.ts`)
- `recharts` 2.15.3 — data visualisation / charts
- `date-fns` 4.1.0 — date utility
- `react-number-format` 5.4.4 — numeric input formatting
- `react-icons` 5.5.0 — icon set

### Key Libraries — Backend

- `jsonwebtoken` 9.0.2 — JWT issuance and validation
- `bcryptjs` 2.4.3 — password hashing
- `zod` 3.23.8 — environment variable schema validation and runtime type checking
- `helmet` 7.1.0 — HTTP security headers
- `express-rate-limit` 7.4.1 — request rate limiting
- `cors` 2.8.5 — CORS handling
- `morgan` 1.10.0 — HTTP request logging
- `dotenv` 16.4.5 — `.env` loading
- `pg` 8.13.3 — PostgreSQL client (connection pool, no ORM)

### Key Libraries — Agents

- `agno` (unpinned) — AI agent framework
- `openai` (unpinned) — OpenAI SDK
- `httpx` 0.28.1 — async HTTP client (calls backend REST API)
- `pydantic` 2.11.7 — data models and validation
- `fastapi` 0.116.1 — web framework
- `uvicorn` 0.35.0 — ASGI server

### Build & Dev Tooling

**Backend:**
- `tsx` 4.19.2 — TypeScript execution and watch mode for development (`npm run dev`)
- `tsc` — TypeScript compiler for production build (output to `backend/dist/`)

**Frontend:**
- Turbopack — bundler for local dev (`npm run dev`)
- Next.js build pipeline — production (`npm run build`)
- ESLint 9 with `eslint-config-next` 15.3.1

### Database

- PostgreSQL 16 (Docker image `postgres:16`)
- Managed via raw SQL through `pg` Pool — no ORM
- Schema is created on startup via `backend/src/db/init.ts` (`initializeDatabase()`)
- Admin UI: pgAdmin 4 v8 (Docker image `dpage/pgadmin4:8`, port 5050 host)

### Containerisation

- Docker Compose (`docker-compose.yaml`) — defines 5 services:
  - `frontend-marazul` — Node 22, port 3000
  - `backend-marazul` — Node 22, port 5000
  - `agents-marazul` — Python 3.12, port 5051 (internal 5050)
  - `db-marazul` — PostgreSQL 16, port 5432
  - `pgadmin-marazul` — pgAdmin 4, port 5050

## Versions & Config

### Backend (`backend/package.json`)

| Package | Version |
|---------|---------|
| express | ^4.19.2 |
| jsonwebtoken | ^9.0.2 |
| bcryptjs | ^2.4.3 |
| zod | ^3.23.8 |
| pg | ^8.13.3 |
| helmet | ^7.1.0 |
| express-rate-limit | ^7.4.1 |
| cors | ^2.8.5 |
| morgan | ^1.10.0 |
| dotenv | ^16.4.5 |
| typescript (dev) | ^5.7.2 |
| tsx (dev) | ^4.19.2 |
| @types/node (dev) | ^22.10.1 |

TypeScript target: `ES2022`, module: `NodeNext`

### Frontend (`frontend/package.json`)

| Package | Version |
|---------|---------|
| next | 15.3.1 |
| react | ^19.0.0 |
| react-dom | ^19.0.0 |
| @mui/material | ^7.2.0 |
| @mui/icons-material | ^7.0.2 |
| @mui/lab | ^7.0.0-beta.11 |
| @mui/x-date-pickers | ^8.2.0 |
| @emotion/react | ^11.14.0 |
| @emotion/styled | ^11.14.1 |
| axios | ^1.10.0 |
| recharts | ^2.15.3 |
| date-fns | ^4.1.0 |
| react-icons | ^5.5.0 |
| react-number-format | ^5.4.4 |
| tailwindcss (dev) | ^4 |
| eslint (dev) | ^9 |
| typescript (dev) | ^5 |

TypeScript target: `ES2017`, module: `ESNext` (bundler resolution)

### Agents (`agents/requirements.txt`)

| Package | Version |
|---------|---------|
| fastapi | 0.116.1 |
| uvicorn | 0.35.0 |
| httpx | 0.28.1 |
| pydantic | 2.11.7 |
| agno | unpinned |
| openai | unpinned |

Python version: 3.12

### Environment Variables (backend)

Validated by Zod in `backend/src/config/env.ts`:

| Variable | Default | Notes |
|----------|---------|-------|
| `NODE_ENV` | `development` | |
| `PORT` | `5000` | |
| `JWT_SECRET` | — | Required, min 16 chars |
| `JWT_EXPIRES_IN` | `8h` | |
| `AUTH_COOKIE_NAME` | `auth_token` | |
| `CORS_ORIGINS` | `http://localhost:3000` | |
| `DB_HOST` | `localhost` | |
| `DB_PORT` | `5432` | |
| `DB_NAME` | `portal_hotel` | |
| `DB_USER` | `admin` | |
| `DB_PASSWORD` | `admin` | |

### Environment Variables (agents)

Read in `agents/app/settings.py`:

| Variable | Default | Notes |
|----------|---------|-------|
| `AGENTS_PORT` | `5050` | |
| `BACKEND_BASE_URL` | `http://localhost:5000/api` | |
| `BACKEND_BEARER_TOKEN` | — | Optional |
| `BACKEND_TIMEOUT_SECONDS` | `10` | |
| `RAG_TOP_K` | `3` | |
| `AGNO_ENABLED` | `true` | |
| `OPENAI_API_KEY` | — | Required to enable Agno |
| `OPENAI_MODEL` | `gpt-4o-mini` | |

---

*Stack analysis: 2026-05-11*
