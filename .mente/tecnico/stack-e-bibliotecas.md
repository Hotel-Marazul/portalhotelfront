---
tags: [tecnico, stack, bibliotecas]
---

# Stack e Bibliotecas

## Visão geral

| Camada | Tech | Versão |
|--------|------|--------|
| Frontend | Next.js App Router | 16.x |
| Frontend runtime | Node.js | 22 (slim Docker) |
| Frontend UI | componentes próprios em `components/ui/` sobre Radix | — |
| Frontend estilo | Tailwind CSS (tokens em `globals.css`) | 4.x |
| Frontend ícones | lucide-react | 1.56.0 |
| Frontend avisos | sonner | 2.0.8 |
| Frontend busca (Ctrl/⌘ K) | cmdk | 1.1.1 |
| Frontend datas | react-day-picker + date-fns | 10.0.2 / 4.x |
| Frontend HTTP | axios | 1.10.0 |
| Frontend charts | recharts (sem uso desde o redesign; gráficos em Tailwind) | 2.15.3 |
| Backend | Express | 4.19.2 |
| Backend runtime | Node.js | 22 (slim Docker) |
| Backend DB client | pg | 8.13.3 |
| Backend auth | jsonwebtoken + bcryptjs | 9.0.2 / 2.4.3 |
| Backend validação | zod | latest |
| Backend logging | morgan | 1.10.0 |
| Agents | FastAPI | 0.116.1 |
| Agents runtime | Python | 3.12 (slim Docker) |
| Agents ASGI | Uvicorn | 0.35.0 |
| Agents LLM | OpenAI via Agno | gpt-4o-mini padrão |
| Agents HTTP | httpx | latest |
| Banco | PostgreSQL | 16 |
| Orquestração | Docker Compose | — |

## Frontend — pontos importantes

### Next.js 15 App Router
- Todas as páginas com lógica interativa devem ter `"use client"` no topo
- Layout raiz (`src/app/layout.tsx`) também é client component (usa `usePathname`)
- Rotas de API Next.js: `src/app/api/*/route.ts`
- Proxy para agents: `src/app/api/agents/chat/route.ts`

### Axios (api.ts)
- Singleton `apiClient` com `withCredentials: true` (envia cookie automático)
- Interceptor de 401 redireciona para `/login`
- Base URL: `NEXT_PUBLIC_API_URL` (padrão: `http://localhost:5000`)

### UI: Tailwind + componentes próprios
O MUI, o Emotion e o `react-icons` saíram no redesign de 2026-10-27 (`openspec/changes/redesign-portal-interface`).
- Tailwind com os tokens para tudo. Os tokens ficam em `:root` de `src/styles/globals.css` e o `@theme inline` os expõe como utilitários (`bg-surface`, `text-fg-2`, `border-rule`, `rounded-panel`, `font-mono`). Valores e uso: `design.md` da change.
- Componentes base em `src/components/ui/` (`Button`, `Field`, `Input`, `Select`, `Segmented`, `Tabs`, `Switch`, `Sheet`, `StatusChip`, `Toast`, `DatePicker`, `Kpi`, `ConfirmDialog`), escritos sobre Radix (`dialog`, `popover`, `switch`, `tabs`, `toggle-group`).
- Ícones só do `lucide-react`. Marcas (o WhatsApp da landing) ficam como SVG próprio.
- Avisos pelo `toast` de `components/ui/Toast` (sonner). A busca do topo é o `CommandBar` (cmdk).
- Fontes: Hanken Grotesk (texto) e Geist Mono (números, horas, quartos, valores) por `next/font/google`.
- Lógica pura de cada tela num `.ts` ao lado dos componentes, testada com `node --test` em `frontend/tests/*.test.mjs`.

## Backend — pontos importantes

### Express + ESM
- Imports locais **devem** ter extensão `.js` (ex: `import { foo } from "./bar.js"`)
- Handlers sempre envolvidos em `asyncHandler()` do `src/utils/async-handler.ts`
- Erros de domínio: `throw new HttpError(statusCode, message)` do `src/utils/http-error.ts`

### Validação Zod
- Schemas em `<module>.schema.ts` ao lado das rotas
- Middleware `validate({ body, params, query })` aplica schema e retorna 400 com issues

### PostgreSQL `pg`
- Pool em `src/db/client.ts` — usar `query<T>()` helper para queries simples
- Para mutations multi-tabela: `pool.connect()` + transação manual
- Env vars: `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`

## Agents — pontos importantes

### FastAPI
- Entry: `agents/app/server.py`
- Router: `agents/app/router.py` — endpoints `/chat` e `/health`
- Orquestração: `agents/orchestration/supervisor.py`

### Agno + OpenAI
- `AgnoResponseAgent` em `agents/agents/agno_agent.py`
- Modelo configurável via `OPENAI_MODEL` (padrão: `gpt-4o-mini`)
- Ativado via `AGNO_ENABLED=true` + `OPENAI_API_KEY`

### RAG local
- Documentos em `agents/rag/knowledge/` (.md e .txt)
- `InMemoryRagStore` — BM25 simples, sem embeddings
- Top-K configurável via `RAG_TOP_K` (padrão: 3)
- Usado por `PolicyAgent` para responder sobre políticas do hotel

## Env vars essenciais

### Backend
```env
JWT_SECRET=         # min 16 chars, obrigatório
PORT=5000
DB_HOST=
DB_NAME=portal_hotel
DB_USER=
DB_PASSWORD=        # não use default admin
CORS_ORIGINS=http://localhost:3000
```

### Agents
```env
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o-mini
AGNO_ENABLED=true
BACKEND_BASE_URL=http://localhost:5000/api
BACKEND_BEARER_TOKEN=    # obrigatório para produção
```

### Frontend
```env
NEXT_PUBLIC_API_URL=http://localhost:5000
AGENTS_API_URL=http://agents-marazul:5050
```
