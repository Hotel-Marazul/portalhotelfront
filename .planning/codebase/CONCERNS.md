# Concerns & Risks

**Revisão:** hardening de operações de reserva — validação final

Este documento substitui o inventário histórico de 2026-05-11. Os problemas
listados abaixo foram rechecados contra o código atual; não use o diagnóstico
histórico para inferir que uma falha ainda existe.

## Resolvido nesta entrega

| Área | Evidência atual |
|---|---|
| Atomicidade de reservas | `backend/src/modules/reservations/reservations.routes.ts` usa cliente dedicado, `BEGIN/COMMIT/ROLLBACK` e preserva hóspedes omitidos em updates. |
| Overbooking e concorrência | `reservations_no_overlapping_stays` aplica `tstzrange(..., '[)')`; rotas usam locks de reserva/quarto e a suíte PostgreSQL cobre criação, edição e pagamento concorrentes. |
| Cancelamento destrutivo | `POST /reservations/:id/cancel` e `DELETE /Reservations/:id` fazem transição lógica e registram evento; hóspedes, pagamentos e preço permanecem no histórico. |
| Pagamentos | Lançamentos são idempotentes, limitados ao saldo, versionados por evento e revertidos por lançamento compensatório, sem editar o original. |
| Datas e ocupação | `HOTEL_TIMEZONE` é validado como IANA; datas civis e quarto-noites usam o fuso do hotel e o intervalo `[)`. |
| Indicadores fictícios | `counter-summary` agrega ocupação mensal real, além de separar receita reservada, recebimentos e pendências vencidas. |
| Paginação e CPF | Reservas e clientes têm filtros validados, total, teto e ordenação estável; coleções retornam CPF mascarado. |
| Agentes sem proteção | O gateway do backend exige sessão; o FastAPI exige API key e contexto HMAC; o backend aplica allowlist e usuário iniciador. |
| Mutação sem confirmação | Criação, edição e cancelamento são propostas com hash/validade e só escrevem após confirmação explícita. |
| Acesso financeiro por papel | `/api/User/me` é mínimo; `revenue-summary` é exclusivo de `admin`; `manager` mantém apenas a operação financeira da reserva. |
| Tentativas de login | `auth.routes.ts` aplica limiter dedicado de 10 requisições por 15 minutos, além do limite global. |
| Cobertura automatizada | Há 14 testes unitários do backend, 6 suítes PostgreSQL, 16 testes Node do frontend e 4 scripts dos agentes executáveis no Docker. |
| Concorrência da UI | Listas, agenda e disponibilidade usam sequência de requisição; mudanças de payload geram nova chave de idempotência. |
| Histórico do chat | Conversa fica somente em memória; chaves persistidas por versões antigas são removidas no carregamento, logout e 401. |

## Riscos e pendências atuais

### Dados legados aguardando decisão

O diagnóstico somente leitura deve ser executado antes de qualquer saneamento.
A última execução encontrou um sobrepagamento legado de R$ 10,00 e registros com
horários diferentes do padrão operacional. Nenhum status, timestamp ou valor foi
corrigido automaticamente. Qualquer ajuste deve ser uma decisão operacional e,
quando financeiro, um evento compensatório auditado.

### Validação de staging e E2E visual

A matriz reproduzível local cobre o backend, PostgreSQL real, os scripts dos
agentes, o gateway autenticado e a lógica de timeline. Ainda falta executar em
staging com contas reais de `admin` e `manager` a validação visual desktop/mobile,
a busca com mais de cem clientes, os estados de erro da UI e o fluxo completo de
mutação assistida. Isso não deve ser inferido apenas de um build verde.

### Estado de conversa do agente em memória

`agents/orchestration/state.py` mantém conversas e propostas em memória, com TTL.
Uma implantação horizontal precisa de armazenamento compartilhado com expiração,
controle de concorrência e isolamento por usuário antes de distribuir réplicas.

### Rollback operacional

As mudanças de schema são aditivas e as rotas legadas permanecem compatíveis.
O rollback documentado deve trocar as imagens dos serviços, desabilitar mutações
do agente e manter as novas tabelas/colunas sem restauração destrutiva de dados.
Esse procedimento ainda precisa ser ensaiado em staging.

### Compatibilidade de rotas

Aliases PascalCase (`/User`, `/Reservations`, `/Rooms` e
`/GuestPricingRule`) permanecem por compatibilidade. Rotas novas devem usar
kebab-case minúsculo; a remoção dos aliases exige inventário dos consumidores.

### Cobertura de componentes

Os testes atuais não substituem testes E2E de componentes React. Quando houver
infraestrutura de navegador no CI, adicionar cenários para permissões, falhas de
rede, retentativa idempotente, drawer de pagamentos e disponibilidade fail-closed.

## Regras de operação

- Não executar `seed` ou saneamento contra dados reais sem confirmar o ambiente.
- Não registrar CPF completo, cookies, tokens, credenciais, query strings ou
  payloads sensíveis nos logs.
- Não acessar PostgreSQL diretamente a partir de `agents/`; toda operação passa
  pelo backend autenticado.
