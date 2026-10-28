## 1. Backend

- [ ] 1.1 `db/room-housekeeping-schema.ts`: coluna `housekeeping_status` (padrão `limpo`, CHECK), `housekeeping_updated_at`, `housekeeping_updated_by`, e o gatilho do check-out; chamado no `init.ts`.
- [ ] 1.2 `PATCH /rooms/:id/housekeeping` com Zod, para `admin` e `receptionist`, 404 para quarto inexistente; `GET /rooms` com `housekeepingStatus` e `housekeepingUpdatedAt`; `GET /rooms/summary` com a contagem por estado. Teste do schema.

## 2. Quartos

- [ ] 2.1 Coluna Limpeza na tabela e filtro "Precisa limpar".
- [ ] 2.2 No painel do quarto, a limpeza atual e os botões para trocar.

## 3. Hoje

- [ ] 3.1 "Quartos agora" com Precisa limpar e Em limpeza.
- [ ] 3.2 Chegadas com "pronto" ou o estado de limpeza do quarto.
- [ ] 3.3 "A fazer" com o quarto de chegada de hoje que ainda não está pronto.
