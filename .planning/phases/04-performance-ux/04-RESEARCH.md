# Phase 4: Performance & UX - Research

**Pesquisado em:** 2026-05-12
**Dominio:** Paginacao server-side (Express + PostgreSQL) + UI de detalhes de reserva (Next.js + MUI)
**Confianca:** HIGH (baseado em leitura direta do codebase)

---

## Resumo

A Phase 4 tem tres requisitos distintos: adicionar paginacao server-side a `GET /Reservations` (PERF-01), adicionar paginacao server-side a `GET /client` (PERF-02), e conectar o botao "Ver Detalhes" na pagina `/reservas` ao componente `ReservationDrawer` ja existente (UI-01).

**PERF-01 / PERF-02 — Estado atual:** Ambas as rotas buscam todos os registros do banco sem `LIMIT`/`OFFSET`. O frontend `/reservas` carrega todo `GET /Reservations` na memoria e filtra/pagina no cliente. A pagina `/cliente` chama `GET /client` sem paginacao, e cada cliente ja tem suas reservas embutidas na resposta (N+1 queries lazy via `getReservationsByClientIds`). A resposta atual de `GET /client` ja inclui todas as reservas de cada cliente — exatamente o que PERF-02 quer eliminar.

**UI-01 — Estado atual:** O botao "Ver Detalhes" (`<IconButton aria-label="ver">`) na pagina `/reservas` existe mas nao tem `onClick` — e um no-op. O componente `ReservationDrawer` ja existe em `frontend/src/components/reservations/ReservationDrawer.tsx` com suporte a `mode="view"` e `mode="edit"`, mostrando todos os campos necessarios (cliente, quarto, datas, hospedes, total). So falta conectar o botao ao estado do drawer.

**Recomendacao primaria:** Implementar limit/offset simples no backend com resposta envelope `{ items, total, page, pageSize }`, migrar o frontend de paginacao client-side para server-side com debounce nos filtros de texto, e conectar o `<IconButton aria-label="ver">` ao `ReservationDrawer` em modo `view`.

---

<phase_requirements>
## Requisitos da Fase

| ID | Descricao | Suporte da Pesquisa |
|----|-----------|---------------------|
| PERF-01 | `GET /Reservations` suporta paginacao server-side (limit/offset) | Rota atual usa `getReservationsByIds()` sem LIMIT/OFFSET; query SQL identificada; envelope de resposta definido |
| PERF-02 | `GET /client` suporta paginacao server-side sem embutir reservas | Rota atual ja emite todas as reservas de todos os clientes na lista; query de clientes identificada; solucao e omitir reservas da listagem |
| UI-01 | Botao "Ver Detalhes" abre detalhes da reserva | Botao existe sem `onClick`; `ReservationDrawer` ja implementado com `mode="view"`; conexao e trivial |
</phase_requirements>

---

## Mapa de Responsabilidade Arquitetural

| Capacidade | Tier Primario | Tier Secundario | Racional |
|------------|--------------|-----------------|----------|
| Paginacao de reservas | API / Backend | Banco (SQL LIMIT/OFFSET) | Logica de corte de dados pertence ao servidor; frontend so consome |
| Paginacao de clientes | API / Backend | Banco (SQL LIMIT/OFFSET) | Idem — frontend nao deve receber todos os registros |
| Total count para paginacao | Banco (COUNT(*)) | — | Query separada de COUNT ou subquery, retornada pelo backend |
| Exibicao de detalhes da reserva | Browser / Client | — | Drawer ja renderizado no cliente; apenas conexao de estado |
| Debounce de filtros | Browser / Client | — | Evitar requisicoes por tecla quando filtros disparam `GET` server-side |

---

## Stack Padrao

### Core (ja presente no projeto)

| Biblioteca | Versao | Proposito | Por que padrao |
|-----------|--------|-----------|----------------|
| `pg` (node-postgres) | ~8.x | Pool de conexoes e queries raw SQL | Ja em uso; sem ORM conforme restricao do projeto |
| Express 4 | ~4.x | Roteamento backend | Ja em uso |
| axios | ^1.10.0 | HTTP client no frontend | Ja em uso via `apiClient` |
| @mui/material | ^7.2.0 | Componentes UI (TablePagination, Drawer) | Ja em uso; `TablePagination` e `Drawer` ja importados |
| Next.js 15 | 15.3.1 | App Router, Server Components | Ja em uso |

[VERIFIED: leitura direta de `frontend/package.json` e `backend/src/modules/`]

### Sem instalacao nova necessaria

Nenhuma dependencia nova e necessaria para esta fase. Todos os componentes MUI (`Drawer`, `TablePagination`) ja sao dependencias do projeto.

---

## Arquitetura de Paginacao — Padrao Recomendado

### Formato da Resposta do Backend (envelope)

```typescript
// Source: padrao adotado no projeto — ReservationsResponse ja definido em frontend/src/types/reservations.ts
{
  items: ReservationDto[],  // pagina atual
  total: number,            // total de registros (sem paginacao)
  page: number,             // pagina atual (base-1)
  pageSize: number          // registros por pagina
}
```

[VERIFIED: `ReservationsResponse` ja definido em `frontend/src/types/reservations.ts` linhas 63-68 — o tipo frontend ja espera esse envelope]

### SQL — Reservations com Paginacao

```sql
-- Query principal paginada
SELECT
  r.id, r.room_id, r.client_id,
  r.check_in_date::text, r.check_out_date::text,
  r.status, r.total_price::text,
  rm.number AS room_number, rm.type AS room_type, rm.daily_price::text AS room_daily_price,
  cl.full_name AS client_full_name, cl.cpf AS client_cpf
FROM reservations r
LEFT JOIN rooms rm ON rm.id = r.room_id
LEFT JOIN clients cl ON cl.id = r.client_id
ORDER BY r.check_in_date DESC, r.created_at DESC
LIMIT $1 OFFSET $2;

-- Count total (query separada, executar em paralelo com Promise.all)
SELECT COUNT(*) AS total FROM reservations;
```

[VERIFIED: baseado na query existente em `reservations.routes.ts` linhas 192-214, adaptada com LIMIT/OFFSET]

### SQL — Clients com Paginacao (sem reservas embutidas)

```sql
-- Listagem paginada — SEM JOIN de reservas
SELECT id, full_name, cpf, email, fone, automovel, placa
FROM clients
ORDER BY full_name ASC
LIMIT $1 OFFSET $2;

-- Count total
SELECT COUNT(*) AS total FROM clients;
```

[VERIFIED: baseado na query existente em `clients.routes.ts` linhas 178-188]

A decisao de remover as reservas da listagem `GET /client` e consistente com PERF-02: "sem embutir todas as reservas para cada cliente". O endpoint `GET /client/:id` continua retornando as reservas do cliente individual (para detalhes).

---

## Analise Detalhada do Estado Atual

### GET /Reservations — Estado Atual

**Arquivo:** `backend/src/modules/reservations/reservations.routes.ts` (linha 244-250)

```typescript
// ATUAL — sem paginacao
reservationsRouter.get(
  "/Reservations",
  asyncHandler(async (_req, res) => {
    const reservations = await getReservationsByIds();  // busca TUDO
    res.json(reservations);  // retorna array simples
  })
);
```

**Problemas identificados:**
1. `getReservationsByIds()` sem argumentos busca todos os registros (sem LIMIT)
2. Retorna `ReservationDto[]` — array simples, nao envelope com `total`
3. Frontend faz paginacao client-side em `filteredSorted.slice(start, start + rowsPerPage)`

[VERIFIED: leitura direta do arquivo]

### GET /client — Estado Atual

**Arquivo:** `backend/src/modules/clients/clients.routes.ts` (linha 175-189)

```typescript
// ATUAL — busca todos os clientes + todas as reservas de todos
clientsRouter.get(
  "/client",
  asyncHandler(async (_req, res) => {
    const rows = await query<ClientRow>(
      `SELECT id, full_name, cpf, email, fone, automovel, placa FROM clients ORDER BY full_name ASC`
    );
    // PROBLEMA: chama getReservationsByClientIds com TODOS os IDs
    const reservationsByClient = await getReservationsByClientIds(rows.map((row) => row.id));
    res.json(rows.map((row) => mapClient(row, reservationsByClient.get(row.id))));
  })
);
```

**Problemas identificados:**
1. Busca todos os clientes sem LIMIT
2. Para cada cliente, busca TODAS as suas reservas (2 queries adicionais com N ids)
3. Resposta pode ser enorme se houver muitos clientes com historico extenso

[VERIFIED: leitura direta do arquivo]

### Botao "Ver Detalhes" — Estado Atual

**Arquivo:** `frontend/src/app/reservas/page.tsx` (linhas 337-339)

```tsx
// ATUAL — no-op, sem onClick
<IconButton size="small" aria-label="ver">
  <Visibility />
</IconButton>
```

**O que ja existe e pronto para uso:**
- `ReservationDrawer` em `frontend/src/components/reservations/ReservationDrawer.tsx`
- Suporta `mode="view"` (exibe detalhes sem campos editaveis) e `mode="edit"`
- Props: `open`, `reservation`, `mode`, `onClose`, `onSave`, `onStatusChange`
- Exibe: codigo da reserva, status, cliente (nome + CPF), quarto, periodo (check-in/out, noites), hospedes com regras de preco, total

[VERIFIED: leitura direta de ambos os arquivos]

---

## Padroes de Arquitetura

### Sistema de Paginacao — Diagrama de Fluxo

```
Usuario interage com filtros/pagina
        |
        v (debounce 300ms para inputs de texto)
Frontend monta query params: ?page=1&limit=20
        |
        v
GET /api/Reservations?page=1&limit=20
        |
        v (Express route handler)
[Promise.all]
  Query LIMIT/OFFSET ────→ PostgreSQL → rows paginados
  Query COUNT(*)     ────→ PostgreSQL → total
        |
        v
{ items: [...], total: N, page: 1, pageSize: 20 }
        |
        v
Frontend: atualiza TablePagination com count=total
```

### Estrutura de Arquivos Afetados

```
backend/src/modules/
├── reservations/
│   └── reservations.routes.ts    # Modificar GET /Reservations
└── clients/
    └── clients.routes.ts         # Modificar GET /client

frontend/src/
├── app/reservas/
│   └── page.tsx                  # Conectar ReservationDrawer + migrar para server-side pagination
└── components/reservations/
    └── ReservationDrawer.tsx     # Ja pronto — apenas importar na page
```

### Padrao de Validacao de Query Params (Backend)

```typescript
// Source: padrao do projeto — usar parse manual com fallbacks seguros
const page  = Math.max(1, parseInt(req.query.page  as string ?? "1",  10) || 1);
const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string ?? "20", 10) || 20));
const offset = (page - 1) * limit;
```

**Por que nao Zod para query params aqui:** Os outros parametros de filtro sao passados como query strings e o projeto usa Zod para `body`/`params` de rotas complexas. Para `page` e `limit` numericos simples, parse manual com fallback e idiomatico e menos verboso. [ASSUMED — nao ha schema Zod de query params existente no projeto para comparar]

### Debounce nos Filtros — Abordagem

O componente `ReservationsFilters` atual usa um botao "Filtrar" explicito (nao dispara por tecla). Isso e adequado para paginacao server-side — o usuario clica "Filtrar" e a requisicao e enviada. **Nao e necessario adicionar debounce** porque o submit ja e controlado pelo usuario.

[VERIFIED: leitura de `ReservationsFilters.tsx` — `handleApplyFilters` so e chamado em `onClick` do botao "Filtrar"]

### Compatibilidade do ReservationDrawer com a Page Atual

O `ReservationDrawer` espera:
- `onStatusChange: (reservationId: string, status: ReservationStatus) => Promise<void>` — a page `/reservas` precisa implementar esse callback
- `onSave: (reservation: ReservationDto) => void` — ja existe logica similar no `handleSave` atual da page

Para `mode="view"`, `onSave` e chamado apenas se o usuario troca para editar e salva. O drawer ja trata `mode="view"` desabilitando campos edicao.

---

## Nao Implementar do Zero

| Problema | Nao construir | Usar em vez disso | Por que |
|----------|--------------|-------------------|---------|
| Componente Drawer de detalhes | Drawer customizado | `ReservationDrawer.tsx` ja existente | Componente completo ja implementado com view/edit mode |
| Componente de paginacao | Paginacao custom | `TablePagination` do MUI (ja em uso na page) | Ja importado e renderizado na pagina; so mudar `count` |
| Cursor-based pagination | Qualquer impl de cursor | Nao implementar — v2 backlog | Fora de escopo conforme REQUIREMENTS.md e ROADMAP.md |
| Cache client-side de paginas | Cache customizado | Nao implementar nesta fase | Complexidade desnecessaria para este milestone |

---

## Armadilhas Comuns

### Armadilha 1: Total Count Duplo no GET /Reservations

**O que falha:** Fazer COUNT(*) na mesma query com LIMIT/OFFSET retorna o count da pagina, nao o total.

**Por que acontece:** `SELECT COUNT(*) ... LIMIT 20` retorna maximo 20 linhas (trivialmente retorna 1 linha com valor maximo 20).

**Como evitar:** Executar duas queries em paralelo com `Promise.all`:
```typescript
const [rows, countResult] = await Promise.all([
  query(`SELECT ... LIMIT $1 OFFSET $2`, [limit, offset]),
  query(`SELECT COUNT(*)::int AS total FROM reservations`)
]);
const total = countResult[0].total;
```

[VERIFIED: comportamento SQL padrao]

### Armadilha 2: Quebra do Frontend que Espera Array

**O que falha:** Mudar `GET /Reservations` para retornar `{ items, total }` sem atualizar o frontend.

**Por que acontece:** `page.tsx` linha 108: `Array.isArray(res.data) ? res.data : []` — se `res.data` virar objeto, retorna `[]` silenciosamente.

**Como evitar:** Atualizar o frontend na mesma entrega:
```typescript
// Antes
const res = await apiClient.get<ReservationDto[]>("/api/Reservations");
setAllReservations(res.data);

// Depois  
const res = await apiClient.get<ReservationsResponse>("/api/Reservations", { params: { page, limit } });
setAllReservations(res.data.items);
setTotal(res.data.total);
```

[VERIFIED: `ReservationsResponse` ja tipado em `frontend/src/types/reservations.ts`]

### Armadilha 3: Estado de Pagina ao Mudar Filtros

**O que falha:** Usuario esta na pagina 3, muda filtro, resultado tem 1 pagina — TablePagination fica em estado invalido.

**Como evitar:** Resetar `page` para 0 (MUI base-0) sempre que filtros mudam:
```typescript
const handleFiltersChange = (partial: Partial<ReservationsFilters>) => {
  setFilters(prev => ({ ...prev, ...partial }));
  setPage(0); // reset ao mudar filtros
};
```

[VERIFIED: ja ha logica similar no codigo atual — `setPage(0)` chamado em `onFiltersChange` e `onClear`]

### Armadilha 4: Discrepancia de Base (0 vs 1) entre MUI e Backend

**O que falha:** `TablePagination` do MUI usa pagina base-0; backend deve receber base-1 ou a conversao falha.

**Como evitar:** Converter explicitamente ao montar a requisicao:
```typescript
// MUI page e 0-based; backend espera 1-based
params: { page: page + 1, limit: rowsPerPage }
```

[VERIFIED: MUI TablePagination docs — `page` prop e zero-based]

### Armadilha 5: GET /client ainda chamado pelo frontend de reservas

**O que falha:** A pagina `/cliente` chama `GET /client` e espera reservas embutidas na resposta (`client.reservations`).

**Por que acontece:** `createUserTable.tsx` linha 89-93 usa `client.reservations` do payload. Se removermos as reservas da listagem, esse componente quebra.

**Como evitar:** A mudanca de PERF-02 deve preservar `GET /client/:id` com reservas (para detalhes), mas a listagem `GET /client` pode omitir reservas. O `createUserTable.tsx` ja lista clientes sem mostrar reservas inline na tabela — as reservas aparecem so no `ModalDetalhesCliente`. Verificar se `ModalDetalhesCliente` busca `/client/:id` individualmente ou usa os dados do payload da listagem.

[ASSUMED — necessario verificar `ModalDetalhesHospedes.tsx` antes de implementar]

---

## Exemplos de Codigo

### Backend: Rota Paginada para Reservations

```typescript
// Source: adaptacao do padrao existente em reservations.routes.ts
reservationsRouter.get(
  "/Reservations",
  asyncHandler(async (req, res) => {
    const page   = Math.max(1, parseInt(req.query.page  as string ?? "1",  10) || 1);
    const limit  = Math.min(100, Math.max(1, parseInt(req.query.limit as string ?? "20", 10) || 20));
    const offset = (page - 1) * limit;

    const [reservationRows, countResult] = await Promise.all([
      query<ReservationRow>(
        `SELECT r.id, r.room_id, r.client_id,
                r.check_in_date::text, r.check_out_date::text,
                r.status, r.total_price::text,
                rm.number AS room_number, rm.type AS room_type,
                rm.daily_price::text AS room_daily_price,
                cl.full_name AS client_full_name, cl.cpf AS client_cpf
         FROM reservations r
         LEFT JOIN rooms rm ON rm.id = r.room_id
         LEFT JOIN clients cl ON cl.id = r.client_id
         ORDER BY r.check_in_date DESC, r.created_at DESC
         LIMIT $1 OFFSET $2`,
        [limit, offset]
      ),
      query<{ total: number }>(
        `SELECT COUNT(*)::int AS total FROM reservations`
      )
    ]);

    const total = countResult[0]?.total ?? 0;

    if (reservationRows.length === 0) {
      return res.json({ items: [], total, page, pageSize: limit });
    }

    const ids = reservationRows.map(r => r.id);
    const guestRows = await query<GuestRow>(
      `SELECT g.id, g.reservation_id, g.name, g.age, g.pricing_rule_id,
              pr.id AS rule_id, pr.name AS rule_name,
              pr.description AS rule_description, pr.price::text AS rule_price
       FROM reservation_guests g
       LEFT JOIN pricing_rules pr ON pr.id = g.pricing_rule_id
       WHERE g.reservation_id = ANY($1::uuid[])
       ORDER BY g.created_at ASC`,
      [ids]
    );

    const items = reservationRowsToDto(reservationRows, guestRows);
    res.json({ items, total, page, pageSize: limit });
  })
);
```

### Backend: Rota Paginada para Clients (sem reservas embutidas)

```typescript
// Source: adaptacao do padrao existente em clients.routes.ts
clientsRouter.get(
  "/client",
  asyncHandler(async (req, res) => {
    const page   = Math.max(1, parseInt(req.query.page  as string ?? "1",  10) || 1);
    const limit  = Math.min(100, Math.max(1, parseInt(req.query.limit as string ?? "20", 10) || 20));
    const offset = (page - 1) * limit;

    const [rows, countResult] = await Promise.all([
      query<ClientRow>(
        `SELECT id, full_name, cpf, email, fone, automovel, placa
         FROM clients ORDER BY full_name ASC
         LIMIT $1 OFFSET $2`,
        [limit, offset]
      ),
      query<{ total: number }>(
        `SELECT COUNT(*)::int AS total FROM clients`
      )
    ]);

    const total = countResult[0]?.total ?? 0;
    // Omitir reservas da listagem — apenas dados do cliente
    res.json({ items: rows.map(row => mapClient(row)), total, page, pageSize: limit });
  })
);
```

### Frontend: Conectar "Ver Detalhes" ao ReservationDrawer

```tsx
// Source: adaptacao de reservas/page.tsx com ReservationDrawer
const [viewing, setViewing] = useState<ReservationDto | null>(null);

// Botao atualizado (linha ~337):
<IconButton
  size="small"
  aria-label="ver"
  onClick={() => setViewing(reservation)}
>
  <Visibility />
</IconButton>

// Drawer adicionado ao JSX (apos os outros Dialogs):
<ReservationDrawer
  open={!!viewing}
  reservation={viewing}
  mode="view"
  onClose={() => setViewing(null)}
  onSave={(updated) => {
    setAllReservations(prev => prev.map(r => r.id === updated.id ? updated : r));
    setViewing(null);
  }}
  onStatusChange={async (id, status) => {
    await apiClient.put(`/api/Reservations/${id}`, { ...viewing!, status });
    void loadReservations();
  }}
/>
```

---

## Estado da Arte

| Abordagem Antiga | Abordagem Atual | Impacto |
|-----------------|-----------------|---------|
| Paginacao client-side (filtrar array em memoria) | Paginacao server-side (LIMIT/OFFSET no SQL) | Queries deixam de crescer com o volume de dados |
| Resposta `ReservationDto[]` (array) | Resposta `{ items, total, page, pageSize }` (envelope) | Frontend pode mostrar total real e navegar paginas |
| Reservas embutidas em cada cliente na listagem | Listagem de clientes retorna so dados do cliente | Payload menor; reservas por demanda via GET /client/:id |
| Botao "Ver Detalhes" sem acao | Botao abre `ReservationDrawer` em modo view | Feature funcional — requisito UI-01 |

---

## Inventario de Estado de Runtime

Esta e uma fase de performance/UX — sem renomear, sem migrar dados. Nenhum estado de runtime afetado.

**Nenhum encontrado em nenhuma categoria** — verificado por analise do escopo (sem rename, sem migration de schema, sem mudanca de nome de coluna ou tabela).

---

## Disponibilidade do Ambiente

| Dependencia | Requerida por | Disponivel | Versao | Fallback |
|------------|--------------|-----------|--------|----------|
| PostgreSQL | PERF-01, PERF-02 | Sim (container Docker) | 16 | — |
| Node.js / npm | Build backend | Sim | ~20+ | — |
| Next.js dev server | UI-01 | Sim | 15.3.1 | — |

Nenhuma dependencia externa nova necessaria.

---

## Arquitetura de Validacao

### Framework de Testes

| Propriedade | Valor |
|-------------|-------|
| Framework | Vitest (a ser instalado — nenhum teste automatizado existe ainda) |
| Arquivo de config | Nenhum — Wave 0 deve criar |
| Comando rapido | `cd backend && npx vitest run` |
| Suite completa | `cd backend && npx vitest run && cd ../frontend && npx vitest run` |

### Mapa de Requisitos → Testes

| Req ID | Comportamento | Tipo de Teste | Comando | Arquivo existe? |
|--------|--------------|---------------|---------|-----------------|
| PERF-01 | `GET /Reservations?page=2&limit=20` retorna 20 itens, `total` correto, so pagina 2 | Integração (supertest) | `npx vitest run tests/reservations-pagination.test.ts` | Nao — Wave 0 |
| PERF-02 | `GET /client?page=1&limit=10` retorna 10 clientes sem reservas embutidas | Integracao (supertest) | `npx vitest run tests/clients-pagination.test.ts` | Nao — Wave 0 |
| UI-01 | Click em "Ver Detalhes" abre drawer com dados da reserva | Manual (Vitest/RTL muito custoso para este caso) | Verificacao manual | — |

### Lacunas do Wave 0

- [ ] `backend/tests/reservations-pagination.test.ts` — cobre PERF-01
- [ ] `backend/tests/clients-pagination.test.ts` — cobre PERF-02
- [ ] `backend/vitest.config.ts` — config do Vitest para backend
- [ ] Instalar: `cd backend && npm install -D vitest supertest @types/supertest`

---

## Segurança

### Categorias ASVS Aplicaveis

| Categoria ASVS | Aplica | Controle |
|----------------|--------|----------|
| V5 Validacao de Entrada | Sim | Sanitizacao dos params `page` e `limit` (parseInt + clamp) |
| V4 Controle de Acesso | Sim (existente) | `authMiddleware` ja protege todas as rotas — nenhuma mudanca necessaria |
| V2 Autenticacao | Nao — sem mudanca | — |

### Ameacas Conhecidas

| Padrao | STRIDE | Mitigacao Padrao |
|--------|--------|-----------------|
| `limit=999999` — unbounded query via param | Tampering | `Math.min(100, limit)` — teto de 100 registros por pagina |
| `page=-1` — offset negativo | Tampering | `Math.max(1, page)` — minimo de 1 |
| SQL injection via query param | Tampering | Usar `$1`/`$2` parametrizados — nunca interpolacao de string |

---

## Perguntas em Aberto

1. **`ModalDetalhesHospedes.tsx` usa dados inline da listagem ou faz GET /client/:id?**
   - O que sabemos: `createUserTable.tsx` abre `ModalDetalhesCliente` passando o `Client` do estado local (que vem da listagem `GET /client`)
   - O que nao esta claro: se o modal usa `client.reservations` do payload (que sera removido) ou busca `/client/:id`
   - Recomendacao: verificar o arquivo antes de implementar PERF-02; se necessario, fazer o modal buscar `GET /client/:id` para obter as reservas

2. **A pagina `/cliente` usa `GET /client` ou `GET /reservations`?**
   - O que sabemos: `cliente/page.tsx` chama `/api/client` via `createUserTable.tsx` E chama `/api/reservations` via `useCachedFetch` para o `ReservationTimeline`
   - O que nao esta claro: a `ReservationTimeline` funcionara corretamente apos a paginacao de reservas (hoje espera array, apos PERF-01 recebera envelope)
   - Recomendacao: atualizar o `useCachedFetch` de reservas ou passar params sem paginar para o endpoint de timeline (usar `limit=9999` temporariamente ou criar rota especifica)

---

## Log de Suposicoes

| # | Afirmacao | Secao | Risco se Errado |
|---|-----------|-------|-----------------|
| A1 | Parse manual de `page`/`limit` e idiomatico sem Zod schema | Stack Padrao | Baixo — pode-se adicionar Zod schema; logica funciona de qualquer forma |
| A2 | `ModalDetalhesCliente` pode precisar de ajuste para buscar reservas via GET /client/:id apos PERF-02 | Armadilha 5 | Medio — componente de detalhes de cliente pode quebrar se usar reservas do payload da listagem |

---

## Fontes

### Primarias (HIGH — leitura direta do codebase)

- `backend/src/modules/reservations/reservations.routes.ts` — rota atual GET /Reservations, funcao getReservationsByIds
- `backend/src/modules/clients/clients.routes.ts` — rota atual GET /client, getReservationsByClientIds
- `frontend/src/app/reservas/page.tsx` — botao no-op, paginacao client-side, loadReservations
- `frontend/src/components/reservations/ReservationDrawer.tsx` — componente de detalhes/edicao ja implementado
- `frontend/src/types/reservations.ts` — ReservationsResponse envelope ja tipado
- `frontend/src/components/reservations/ReservationsFilters.tsx` — filtros com botao explicito (nao por tecla)
- `frontend/src/components/clientes/createUserTable.tsx` — carregamento de clientes sem paginacao

### Secundarias (MEDIUM — documentacao e comportamento padrao)

- MUI TablePagination — paginacao base-0 confirmada pelo uso existente na page.tsx
- PostgreSQL COUNT(*) com LIMIT/OFFSET — comportamento SQL padrao

---

## Metadata

**Nivel de confianca por area:**

- Stack padrao: HIGH — todas as libs ja estao no projeto
- Arquitetura: HIGH — baseado em leitura direta do codigo existente
- Armadilhas: HIGH — identificadas diretamente no codigo
- Estado do botao "Ver Detalhes": HIGH — no-op confirmado na linha 337-339 de page.tsx
- Compatibilidade ReservationDrawer: HIGH — props verificadas no componente

**Data da pesquisa:** 2026-05-12
**Valido ate:** 2026-06-12 (stack estavel)
