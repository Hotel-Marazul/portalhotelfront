---
plan: 04-02
phase: 04-performance-ux
status: complete
date: 2026-05-12
requirements_covered:
  - PERF-02
key-files:
  created: []
  modified:
    - backend/src/modules/clients/clients.routes.ts
    - frontend/src/components/clientes/createUserTable.tsx
decisions:
  - PERF-02: paginacao server-side em GET /client com LIMIT/OFFSET parametrizado e reservations: [] por padrao na listagem
tags:
  - performance
  - pagination
  - n+1-elimination
  - server-side
---

## What Was Built

Paginacao server-side no endpoint GET /client com Promise.all paralelo (COUNT + SELECT LIMIT/OFFSET), eliminando o N+1 de reservas que carregava todas as reservas de todos os clientes a cada listagem. Frontend migrado para server-side com TablePagination MUI usando total do servidor.

## Key Changes

### Backend — backend/src/modules/clients/clients.routes.ts (commit be5e810)

- Substituido handler `GET /client` por versao paginada que aceita `?page` e `?limit`
- Sanitizacao de params: `page = Math.max(1, ...)`, `limit = Math.min(100, Math.max(1, ...))` — teto de 100 registros, impede offset negativo (T-04-05, T-04-06, T-04-07)
- `Promise.all` executa COUNT e SELECT LIMIT/OFFSET em paralelo — sem espera sequencial
- SQL usa `$1/$2` parametrizados — nunca interpolados (previne SQL injection)
- `mapClient(row)` chamado SEM segundo argumento — `reservations: []` por default (sem N+1)
- `getReservationsByClientIds` nao chamado no handler de listagem
- Retorna envelope `{ items, total, page, pageSize }` em vez de array plano

### Frontend — frontend/src/components/clientes/createUserTable.tsx (commit 2b52776)

- Adicionados estados `tableTotal`, `tablePage` (MUI base-0) e `tableRowsPerPage`
- `carregarHospedes` atualizado para aceitar `currentPage`/`currentLimit` e enviar `?page=currentPage+1&limit=currentLimit` ao backend (conversao MUI base-0 → backend base-1)
- Resposta normalizada de `response.data` (array plano) para `response.data.items` (envelope)
- `setTableTotal(response.data.total ?? 0)` armazena total do servidor
- `TablePagination` adicionado apos `TableContainer` com `count={tableTotal}` e opcoes `[5, 10, 25, 50]`
- `TablePagination` importado de `@mui/material`
- `hospedesFiltrados` (filtro local por nome/CPF/telefone) mantido intacto — opera sobre pagina atual
- Coluna "Historico de Estadias" exibe "Nenhuma estadia" graciosamente (reservations sempre [])

## Verification

- `grep "Promise.all"` backend/src/modules/clients/clients.routes.ts → 1 match
- `grep "LIMIT"` backend/src/modules/clients/clients.routes.ts → presente com $1 OFFSET $2
- `grep "COUNT"` backend/src/modules/clients/clients.routes.ts → SELECT COUNT(*)::int AS total
- `mapClient(row)` sem segundo argumento — reservations: [] garantido
- TypeScript: arquivo backend compilado sem erros via tsc --noEmit no projeto principal
- `grep "tableTotal"` createUserTable.tsx → 2 matches (definicao + uso)
- `grep "TablePagination"` createUserTable.tsx → 2 matches (import + JSX)
- `grep "page: currentPage + 1"` createUserTable.tsx → 1 match
- `grep "response.data.items"` createUserTable.tsx → 1 match

## Deviations from Plan

None - plano executado exatamente como especificado.

## Known Stubs

None - nenhum stub ou placeholder identificado nos arquivos modificados.

## Threat Flags

Nenhuma superficie de seguranca nova alem do ja mapeado no threat model do plano (T-04-05 a T-04-08). Todas as mitigacoes foram implementadas:
- T-04-05: Math.min(100, ...) aplicado em limit
- T-04-06: Math.max(1, ...) aplicado em page
- T-04-07: $1/$2 parametrizados no SQL

## Self-Check: PASSED

- be5e810 existe: confirmed via `git log`
- 2b52776 existe: confirmed via `git log`
- backend/src/modules/clients/clients.routes.ts modificado: confirmed (Promise.all, LIMIT $1 OFFSET $2, mapClient sem segundo arg)
- frontend/src/components/clientes/createUserTable.tsx modificado: confirmed (tableTotal, TablePagination, page: currentPage + 1, response.data.items)
