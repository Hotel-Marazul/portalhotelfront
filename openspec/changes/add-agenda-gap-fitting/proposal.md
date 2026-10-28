## Why

Entre duas reservas do mesmo quarto sobram 1 a 4 noites que quase nunca vendem sozinhas. Muitas vezes outra reserva, num quarto maior ou nas mesmas datas, cabe exatamente nesse buraco. Mover essa reserva libera uma sequência maior de noites no outro quarto. Hoje a recepção só enxerga isso olhando o mapa com atenção.

## What Changes

- A Agenda marca as brechas de 1 a 4 noites entre duas ocupações do mesmo quarto, dentro do período visível.
- O botão "Brechas e encaixes" liga e desliga as marcas e mostra quantas brechas e quantos encaixes existem.
- Clicar numa brecha abre um painel com as reservas que cabem nela e o botão "Mover para o {quarto}".
- O "Mover" usa o `PUT /reservations/:id` atual e mantém a diária que o hóspede reservou.

## Capabilities

### New Capabilities

- `agenda-gaps`: brechas e encaixes na Agenda.

## Impact

- **Frontend:** `components/agenda/` e o mapa da Agenda (`ReservationTimeline`, `TimelineGrid`).
- **Backend:** nenhum.
