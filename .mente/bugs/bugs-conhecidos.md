---
tags: [bugs, tecnico, inventario]
---

# Inventário de Bugs e Dívidas

Atualizado em 2026-09-13 após a mudança
`openspec/changes/harden-reservation-operations`. Itens resolvidos abaixo não
devem ser reaplicados sem confirmar o código atual.

## Resolvidos

| Item | Evidência |
|---|---|
| Criação/edição parcial de reserva | `reservations.routes.ts` usa `pool.connect()`, `BEGIN/COMMIT/ROLLBACK`; hóspedes e snapshot de preço ficam na mesma transação. |
| Overbooking, inclusive estadias concluídas | `reservations_no_overlapping_stays` usa `tstzrange(..., '[)')` para todo status diferente de `Cancelada`; rotas bloqueiam quarto e testam conflito. |
| Cancelamento com hard delete | `POST /reservations/:id/cancel` e `DELETE /Reservations/:id` fazem transição lógica, preservando associados e evento. |
| Status mutado por etapa de pagamento | Pagamentos são lançamentos informativos; transições usam comando próprio e versão otimista. |
| Dinheiro e excesso pago | Valores são comparados em centavos; excesso legado vira `financialException`/diagnóstico, sem reparo automático. |
| Ocupação mensal fictícia | `counter-summary` calcula quarto-noites civis por mês, com denominador de quartos operacionais. |
| Agente sem autenticação/identidade | FastAPI exige `X-API-Key` e contexto HMAC; backend valida token, iniciador existente e allowlist. |
| Agente grava antes de confirmar | Propostas têm hash/expiração e mutações só ocorrem após confirmação explícita. |
| CPF exposto em coleções e logs | Listas retornam máscara, detalhes de reserva também; logger redige CPF e campos sensíveis; erros não imprimem payload. |
| Paginação ausente | Reservas e clientes usam página, teto, total e ordenação estável. |
| CPF sem dígito verificador | `clients.schema.ts` valida CPF antes de criar/alterar. |
| Recepção não consegue editar CPF mascarado | PUT de cliente preserva CPF quando omitido; a UI não reenvia a máscara. |
| Datas dependentes do fuso do processo | Backend usa `HOTEL_TIMEZONE`; frontend usa helpers civis; testes cobrem `UTC` e `Pacific/Auckland`. |
| Agenda/consulta sem estados de erro | Disponibilidade falha fechada, possui loading/erro/vazio/retry e exige `guestCount`. |
| Indicadores gerenciais expostos à recepção | `/api/User/me` informa o papel; `revenue-summary` exige `admin` e o dashboard não solicita nem renderiza agregados para `receptionist`. |

## Dívidas mantidas conscientemente

### Compatibilidade de rotas PascalCase
Rotas antigas como `/Reservations`, `/Rooms` e `/User` permanecem para
consumidores existentes. Rotas novas devem usar kebab-case minúsculo. Remover
aliases exige inventário de consumidores e janela de migração.

### Rate limit dedicado de login
Existe rate limit global e o endpoint de login usa a autenticação normal. Um
limiter específico por IP/identidade pode ser adicionado quando houver requisito
de operação pública; não substituir o limite global sem testar proxy confiável.

### Middleware do Next não verifica assinatura JWT
O middleware do frontend somente decide redirecionamento por presença/expiração
legível do cookie. Autorização real e assinatura continuam no backend; não usar
o middleware como fronteira de segurança.

### Seed destrutiva
`npm run seed` recria dados de desenvolvimento e desabilita explicitamente o
trigger apenas durante a limpeza. Nunca executar contra banco real.

### Agente mantém estado em memória
Propostas e conversas ficam no processo FastAPI. Em escala horizontal é
necessário armazenamento compartilhado com expiração; antes disso manter um
único processo ou tratar perda de processo como expiração segura.

### Suíte de UI
O frontend possui scripts de timeline/data e build/lint, mas não depende de
um framework de testes de componentes. Adicionar um runner somente quando uma
regra visual interativa não puder ser coberta por teste de lógica e smoke real.
