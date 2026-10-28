## 1. Regras

- [ ] 1.1 `components/agenda/gaps.ts`: brechas por quarto, candidatos de cada brecha e o corpo do `PUT` para mover, com teste em `tests/agenda-gaps.test.mjs`.

## 2. Mapa

- [ ] 2.1 Botão "Brechas e encaixes" com a contagem; marcas das brechas no mapa, clicáveis, com nome acessível.
- [ ] 2.2 Painel da brecha num `Sheet`: título, quarto e vizinhos, candidatos com "Mover para o {quarto}" (confirmação com a regra de preço) e "Ver reserva".
- [ ] 2.3 Mover: busca o detalhe, faz o `PUT` com `version` e idempotência, mostra o erro do backend e recarrega o mapa.
