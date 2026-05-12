# Phase 4: Performance & UX - Pattern Map

**Mapeado em:** 2026-05-12
**Arquivos analisados:** 5 arquivos modificados (2 backend, 3 frontend)
**Analogs encontrados:** 5 / 5

---

## File Classification

| Arquivo Modificado | Role | Data Flow | Analog Mais Proximo | Match Quality |
|--------------------|------|-----------|---------------------|---------------|
| `backend/src/modules/reservations/reservations.routes.ts` | route/controller | CRUD (request-response) | `backend/src/modules/clients/clients.routes.ts` | exact |
| `backend/src/modules/clients/clients.routes.ts` | route/controller | CRUD (request-response) | `backend/src/modules/reservations/reservations.routes.ts` | exact |
| `frontend/src/app/reservas/page.tsx` | page component | request-response (client-side state) | `frontend/src/app/cliente/page.tsx` | role-match |
| `frontend/src/components/clientes/createUserTable.tsx` | component | request-response | `frontend/src/app/reservas/page.tsx` | role-match |
| `frontend/src/types/reservations.ts` | types | — | `frontend/src/types/reservations.ts` (proprio) | exact — tipo ja existe |

---

## Pattern Assignments

### `backend/src/modules/reservations/reservations.routes.ts` (route, CRUD)

**Analog:** `backend/src/modules/clients/clients.routes.ts` + proprio arquivo

**Imports pattern** (linhas 1-13 do arquivo atual):
```typescript
import { randomUUID } from "crypto";
import { Router } from "express";
import { pool, query } from "../../db/client.js";
import { PricingRule, ReservationGuest } from "../../domain/models.js";
import { validate } from "../../middlewares/validate.js";
import { HttpError } from "../../utils/http-error.js";
import { calculateReservationTotal } from "../../utils/reservation.js";
import { asyncHandler } from "../../utils/async-handler.js";
import {
  createReservationSchema,
  reservationIdSchema,
  updateReservationSchema
} from "./reservations.schema.js";
```

**Core pattern — GET paginado com Promise.all** (baseado em linhas 192-242, adaptado):
```typescript
// SUBSTITUIR o handler atual do GET /Reservations (linhas 244-250) por:
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

**Funcao auxiliar reutilizada** (`reservationRowsToDto`, linhas 134-186):
- Funcao ja existe no arquivo — nao recriar. O handler paginado chama `reservationRowsToDto(reservationRows, guestRows)` exatamente como antes.

**Error handling pattern** (linhas 104-121 — `ensureRoomIsAvailable`):
```typescript
// Padrao existente: throw HttpError que asyncHandler captura
if (conflicts.length > 0) {
  throw new HttpError(409, "Ja existe uma reserva nesse quarto para o periodo informado.");
}
```

**Sanitizacao de query params** (padrao do projeto — parse manual com clamp):
```typescript
const page   = Math.max(1, parseInt(req.query.page  as string ?? "1",  10) || 1);
const limit  = Math.min(100, Math.max(1, parseInt(req.query.limit as string ?? "20", 10) || 20));
const offset = (page - 1) * limit;
```
- `Math.min(100, ...)` — teto de seguranca contra `limit=999999`
- `Math.max(1, ...)` — impede offset negativo
- Parametros sempre via `$1`/`$2` — nunca interpolacao de string

---

### `backend/src/modules/clients/clients.routes.ts` (route, CRUD)

**Analog:** `backend/src/modules/reservations/reservations.routes.ts` (padrao identico)

**Imports pattern** (linhas 1-7 do arquivo atual):
```typescript
import { randomUUID } from "crypto";
import { Router } from "express";
import { query } from "../../db/client.js";
import { validate } from "../../middlewares/validate.js";
import { HttpError } from "../../utils/http-error.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { clientBodySchema, clientIdSchema } from "./clients.schema.js";
```

**Core pattern — GET paginado sem reservas embutidas** (substituir linhas 175-189):
```typescript
// SUBSTITUIR o handler atual do GET /client por:
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
    // Omitir reservas da listagem — clients.reservations sera [] por default
    res.json({ items: rows.map(row => mapClient(row)), total, page, pageSize: limit });
  })
);
```

**Funcao mapClient existente** (linhas 68-79 — reutilizada sem alteracao):
```typescript
function mapClient(row: ClientRow, reservations?: ReservationSummaryDto[]) {
  return {
    id: row.id,
    fullName: row.full_name,
    cpf: row.cpf,
    email: row.email,
    fone: row.fone,
    automovel: row.automovel,
    placa: row.placa,
    reservations: reservations ?? []
  };
}
```
- Chamada sem o segundo argumento (`mapClient(row)`) — `reservations` fica `[]` por default.

**Atencao: Armadilha do ModalDetalhesCliente** (linhas 202-228 de `createUserTable.tsx`):
- `createUserTable.tsx` usa `hospede.reservations` do payload da listagem para exibir "X estadias" e a ultima reserva.
- `ModalDetalhesHospedes.tsx` recebe o `Client` completo (com `reservations`) como prop — nao busca `GET /client/:id`.
- **Consequencia:** Apos remover reservas da listagem, a coluna "Historico de Estadias" vai mostrar "Nenhuma estadia" para todos.
- **Decisao necessaria no plano:** Ou (a) manter `reservations` na listagem (so adicionar paginacao), ou (b) fazer `ModalDetalhesCliente` buscar `GET /client/:id` ao abrir. Ver secao "Decisoes Pendentes" abaixo.

---

### `frontend/src/app/reservas/page.tsx` (page component, request-response)

**Analog:** `frontend/src/app/cliente/page.tsx` (padrao de `useCachedFetch`) + proprio arquivo

**Imports adicionais necessarios** (adicionar ao bloco existente nas linhas 36-40):
```typescript
// Adicionar ao bloco de imports do arquivo:
import ReservationDrawer from "../../components/reservations/ReservationDrawer";
import { ReservationsResponse } from "../../types/reservations";
```

**Estado adicional necessario** (adicionar ao bloco de estado existente, linhas 89-100):
```typescript
// Adicionar apos os estados existentes de editing/deleting:
const [viewing, setViewing] = useState<ReservationDto | null>(null);
const [total, setTotal] = useState(0);
```

**Padrao loadReservations — migrar para server-side** (atual: linhas 103-119):
```typescript
// ANTES (linhas 103-119):
const loadReservations = useCallback(async () => {
  setLoading(true);
  setError(null);
  try {
    const res = await apiClient.get<ReservationDto[]>("/api/Reservations");
    setAllReservations(Array.isArray(res.data) ? res.data : []);
  } catch (e: unknown) {
    // ...
  } finally {
    setLoading(false);
  }
}, []);

// DEPOIS — aceita page/limit como parametros:
const loadReservations = useCallback(async (currentPage = page, currentLimit = rowsPerPage) => {
  setLoading(true);
  setError(null);
  try {
    const res = await apiClient.get<ReservationsResponse>("/api/Reservations", {
      params: { page: currentPage + 1, limit: currentLimit }  // MUI base-0 -> backend base-1
    });
    setAllReservations(res.data.items ?? []);
    setTotal(res.data.total ?? 0);
  } catch (e: unknown) {
    if (isAxiosError(e)) {
      setError(e.response?.data?.message ?? "Erro ao carregar reservas");
    } else {
      setError(e instanceof Error ? e.message : "Erro ao carregar reservas");
    }
    setAllReservations([]);
  } finally {
    setLoading(false);
  }
}, [page, rowsPerPage]);
```

**Padrao TablePagination — mudar count para total server-side** (atual: linha 375):
```typescript
// ANTES (linha 375):
count={filteredSorted.length}

// DEPOIS:
count={total}
```

**Reset de pagina ao mudar filtros** (padrao ja existente — linhas 273-281, manter):
```typescript
onFiltersChange={(partial) => {
  setFilters((previous) => ({ ...previous, ...partial }));
  setPage(0);  // ja existe — manter
}}
onClear={() => {
  setFilters({});
  setPage(0);  // ja existe — manter
}}
```

**Botao "Ver Detalhes" — conectar onClick** (atual: linha 337):
```typescript
// ANTES (linhas 337-339):
<IconButton size="small" aria-label="ver">
  <Visibility />
</IconButton>

// DEPOIS:
<IconButton
  size="small"
  aria-label="ver"
  onClick={() => setViewing(reservation)}
>
  <Visibility />
</IconButton>
```

**ReservationDrawer — adicionar ao JSX** (apos o Dialog de `deleting`, linha 455):
```tsx
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

**Interface ReservationDrawerProps** (de `ReservationDrawer.tsx`, linhas 32-39):
```typescript
interface ReservationDrawerProps {
  open: boolean;
  reservation: ReservationDto | null;
  mode: "view" | "edit";
  onClose: () => void;
  onSave: (reservation: ReservationDto) => void;
  onStatusChange: (reservationId: string, status: ReservationStatus) => Promise<void>;
}
```

---

### `frontend/src/components/clientes/createUserTable.tsx` (component, request-response)

**Analog:** `frontend/src/app/reservas/page.tsx` (mesmo padrao de carregamento com `apiClient.get`)

**Padrao de carregamento atual** (linhas 86-105 — usado como referencia):
```typescript
const carregarHospedes = useCallback(async () => {
  try {
    setLoading(true);
    const response = await apiClient.get<Client[]>("/api/client");
    const normalized = (Array.isArray(response.data) ? response.data : []).map((client) => ({
      ...client,
      reservations: Array.isArray(client.reservations) ? client.reservations : []
    }));
    setHospedes(normalized);
  } catch (error) {
    console.error(error);
    setSnackbar({ open: true, message: "Erro ao carregar hóspedes.", severity: "error" });
  } finally {
    setLoading(false);
  }
}, []);
```

**Se PERF-02 remover reservas da listagem**, o handler precisara mudar para:
```typescript
// Adaptar para envelope paginado:
const response = await apiClient.get<{ items: Client[]; total: number; page: number; pageSize: number }>(
  "/api/client",
  { params: { page: currentPage + 1, limit: rowsPerPage } }
);
const normalized = (response.data.items ?? []).map((client) => ({
  ...client,
  reservations: [] // sem reservas na listagem
}));
setHospedes(normalized);
setTotal(response.data.total ?? 0);
```

**Coluna "Historico de Estadias"** (linhas 202-235) usa `hospede.reservations` — vai mostrar "Nenhuma estadia" se reservas forem omitidas da listagem. Ver decisao em "Decisoes Pendentes".

---

### `frontend/src/types/reservations.ts` (types — sem modificacao)

**O tipo `ReservationsResponse` ja existe** (linhas 63-68):
```typescript
export interface ReservationsResponse {
  items: ReservationDto[];
  total: number;
  page: number;
  pageSize: number;
}
```

**Nenhuma alteracao necessaria neste arquivo.** O tipo frontend ja corresponde ao envelope que o backend vai retornar apos PERF-01.

---

## Shared Patterns

### Padrao asyncHandler + HttpError (Backend)
**Fonte:** `backend/src/modules/reservations/reservations.routes.ts` linhas 1-13 (imports) e todos os handlers
**Aplicar em:** Todos os handlers modificados de reservations e clients

```typescript
// Todo handler usa asyncHandler — erros sao automaticamente propagados
asyncHandler(async (req, res) => {
  // Erros de negocio: throw new HttpError(statusCode, "mensagem")
  // Erros SQL: deixar propagar para o middleware global de erro
});
```

### Padrao Promise.all para queries paralelas (Backend)
**Fonte:** Padrao identificado no codigo existente e descrito em RESEARCH.md
**Aplicar em:** GET /Reservations paginado e GET /client paginado

```typescript
// COUNT e dados sempre em paralelo — nunca sequencial
const [rows, countResult] = await Promise.all([
  query(`SELECT ... LIMIT $1 OFFSET $2`, [limit, offset]),
  query(`SELECT COUNT(*)::int AS total FROM tabela`)
]);
const total = countResult[0]?.total ?? 0;
```

### Padrao de fetch com apiClient (Frontend)
**Fonte:** `frontend/src/app/reservas/page.tsx` linhas 103-119 e `frontend/src/components/clientes/createUserTable.tsx` linhas 86-105
**Aplicar em:** Todos os componentes que fazem GET para endpoints paginados

```typescript
// Padrao uniforme: apiClient.get com params para paginacao
const res = await apiClient.get<EnvelopeType>("/api/endpoint", {
  params: { page: muiPage + 1, limit: rowsPerPage }  // conversao base-0 -> base-1
});
```

### Padrao TablePagination MUI (Frontend)
**Fonte:** `frontend/src/app/reservas/page.tsx` linhas 372-385
**Aplicar em:** reservas/page.tsx (mudar `count`) e createUserTable.tsx (adicionar TablePagination)

```typescript
<TablePagination
  component="div"
  count={total}                    // total vem do servidor, nao de filteredSorted.length
  page={page}                      // MUI base-0
  onPageChange={(_event, newPage) => setPage(newPage)}
  rowsPerPage={rowsPerPage}
  onRowsPerPageChange={(event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  }}
  rowsPerPageOptions={[5, 10, 25, 50]}
/>
```

### Padrao de reset de pagina ao mudar filtros (Frontend)
**Fonte:** `frontend/src/app/reservas/page.tsx` linhas 273-281
**Aplicar em:** Qualquer handler de filtro em paginas com paginacao server-side

```typescript
onFiltersChange={(partial) => {
  setFilters(prev => ({ ...prev, ...partial }));
  setPage(0);  // SEMPRE resetar ao mudar filtros
}}
```

---

## useCachedFetch — Aviso de Incompatibilidade

**Fonte:** `frontend/src/hooks/useCachedFetch.ts` (arquivo completo)
**Usado em:** `frontend/src/app/cliente/page.tsx` linhas 60-68

O hook `useCachedFetch` faz GET sem query params dinamicos:
```typescript
const { data: reservationsData } = useCachedFetch<Reservation[]>('/api/reservations', {
  cacheKey: 'reservations',
  expiresIn: 5 * 60 * 1000
});
```

**Problema:** Apos PERF-01, `/api/reservations` retorna envelope `{ items, total }` — nao mais `Reservation[]`. O `cliente/page.tsx` vai receber `null` ou objeto errado onde espera array.

**Mitigacao recomendada:** Atualizar o tipo em `cliente/page.tsx` para `ReservationsResponse` e acessar `.items`, ou usar `limit=9999` temporariamente para `ReservationTimeline` enquanto nao ha rota dedicada.

---

## Decisoes Pendentes (para o Planner)

| Decisao | Opcao A | Opcao B | Impacto |
|---------|---------|---------|---------|
| PERF-02: reservas na listagem de clientes | Manter `reservations` no payload da listagem (so paginar) | Remover reservas da listagem + fazer modal buscar `GET /client/:id` | Opcao A e mais segura (sem quebrar createUserTable.tsx) |
| cliente/page.tsx com useCachedFetch | Atualizar tipo para `ReservationsResponse` + acessar `.items` | Adicionar `?limit=9999` para a `ReservationTimeline` | Opcao A e correta a longo prazo |

---

## Sem Analog Encontrado

Nenhum arquivo desta fase e criado do zero — todos sao modificacoes de arquivos existentes com analogs diretos.

---

## Metadata

**Escopo de busca:** `backend/src/modules/`, `frontend/src/app/`, `frontend/src/components/`, `frontend/src/hooks/`, `frontend/src/types/`
**Arquivos lidos:** 9
**Data de extracao de padroes:** 2026-05-12
