## Why

A recepção não sabe, pelo portal, se o quarto de quem chega hoje já está limpo. O desenho do Hoje e de Quartos mostra "pronto" e "em limpeza", mas o backend não guarda nada disso, e o redesign tirou essas marcas da tela.

## What Changes

- Coluna `housekeeping_status` em `rooms`: `limpo`, `em_limpeza` ou `precisa_limpar`, com data e autor da última troca.
- Check-out (reserva vai para Concluída) marca o quarto como `precisa_limpar`.
- `PATCH /api/rooms/:id/housekeeping` para a recepção e o gerente trocarem o estado.
- `GET /api/rooms` e `GET /api/rooms/summary` passam a trazer a limpeza.
- Quartos: coluna Limpeza e troca de estado no painel do quarto.
- Hoje: "Quartos agora" com a limpeza, e cada chegada com o quarto pronto ou não.

"Bloqueado" já existe como Manutenção (`rooms.status`) e continua lá.

## Capabilities

### New Capabilities

- `room-housekeeping`: estado de limpeza por quarto.

## Impact

- **Banco:** coluna nova com padrão `limpo`; nenhum dado existente muda de sentido.
- **Backend:** `db/room-housekeeping-schema.ts`, `modules/rooms/`.
- **Frontend:** `components/quartos/`, `components/today/`, `app/quarto`, `app/dashboard`.
