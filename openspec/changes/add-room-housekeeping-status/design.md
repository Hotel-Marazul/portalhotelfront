## Decisões

### Onde o check-out vira "precisa limpar"
Por um gatilho no banco (`AFTER UPDATE OF status ON reservations`), no mesmo arquivo do schema. Assim toda saída para Concluída marca o quarto, venha da rota `transitions` ou de script, sem mexer em `reservations.routes.ts`, que tem trabalho de outra sessão em andamento. É o mesmo padrão do gatilho de `room_inventory_numbers`.

### Quem troca o estado
Recepção e gerente. Limpeza é rotina da operação, não configuração.

### Estados
| Valor | Na tela | Quando |
|---|---|---|
| `limpo` | Pronto | padrão; marcado pela recepção depois da limpeza |
| `em_limpeza` | Limpando | marcado pela recepção |
| `precisa_limpar` | A limpar | check-out, ou marcado pela recepção |

Quarto em manutenção mostra Manutenção e não a limpeza.
