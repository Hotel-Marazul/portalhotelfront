---
status: partial
phase: 04-performance-ux
source: [04-VERIFICATION.md]
started: 2026-05-12T00:00:00Z
updated: 2026-05-12T00:00:00Z
---

## Current Test

[aguardando testes humanos]

## Tests

### 1. Paginação server-side em /reservas
expected: Navegar para página 2 dispara nova request ao backend com dados distintos da página 1. TablePagination mostra total correto do servidor (não length do array filtrado).
result: [pending]

### 2. Paginação server-side em /cliente
expected: TablePagination visível na página /cliente com total correto do servidor. Coluna "Histórico de Estadias" exibe "Nenhuma estadia" para todos os clientes na listagem (sem erro).
result: [pending]

### 3. Botão "Ver Detalhes" abre ReservationDrawer
expected: Clicar no ícone de olho em qualquer linha da tabela de reservas abre o drawer com dados completos da reserva (cliente, quarto, datas, hóspedes, total).
result: [pending]

### 4. Fechar drawer e ausência de regressão
expected: Drawer fecha sem erros no console. Botões de editar e excluir continuam funcionando normalmente. Sem regressão visível.
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps
