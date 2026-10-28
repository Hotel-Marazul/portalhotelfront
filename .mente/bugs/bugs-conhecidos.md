---
tags: [bugs, tecnico, inventario]
---

# Inventário de Bugs e Dívidas

Atualizado em 2026-10-28 após a mudança
`openspec/changes/harden-production-security`. Itens resolvidos abaixo não
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
| Chat de IA capaz de alterar reservas | `/api/agent/*`, o token de serviço e o `/chat` do FastAPI foram removidos; o agente só atende o WhatsApp e não chama o backend. |
| Estorno e exclusão de cliente pela recepção | `requireRole("admin")` nas duas rotas; a UI esconde "Estornar" e "Excluir" da recepção. |
| Dependências com alerta crítico (Next RCE, proxy-addr) | `npm audit` sem pendências no frontend; no backend resta só o zod (abaixo). |
| JWT sem algoritmo fixo / login revela e-mail | Só `HS256`; e-mail inexistente compara contra um hash fixo; `JWT_SECRET` ≥ 32 em produção. |
| Compose só de desenvolvimento | `docker-compose.prod.yaml` + Caddy; só 80/443 públicos; testado ponta a ponta. |
| Sem testes de RBAC | `tests/integration/security-matrix.test.ts` cobre 401, 403 por papel, JWT forjado, origem e login. |

## Dívidas mantidas conscientemente

### Compatibilidade de rotas PascalCase
Rotas antigas como `/Reservations`, `/Rooms` e `/User` permanecem para
consumidores existentes. Rotas novas devem usar kebab-case minúsculo. Remover
aliases exige inventário de consumidores e janela de migração.

### Rate limit de login em memória
`/User/login` tem limite próprio (10 erros a cada 15 min por IP; acertos não
contam) e `TRUST_PROXY_HOPS=1` atrás do Caddy. O contador vive no processo:
com mais de uma instância do backend, mover para um store compartilhado.

### Zod 3 com alerta de memória (GHSA-mrhx-c7xc-m3w5)
Correção só no zod 4, que é versão maior e quebra os schemas. Os limites de
corpo (100 kB na API, 2 MB no webhook) seguram o abuso. Revisar até 2027-01-31.

### CSP em report-only
O Next envia a CSP só como relatório; o App Router precisa de nonce para
impor sem quebrar páginas. Conferir o console em produção e então impor.

### Sessão sem revogação
O JWT vale até expirar (8h), mesmo após logout ou troca de papel. Aceitável
sem gestão de usuários pela UI; revisar se ela for criada.

### Middleware do Next não verifica assinatura JWT
O middleware do frontend somente decide redirecionamento por presença/expiração
legível do cookie. Autorização real e assinatura continuam no backend; não usar
o middleware como fronteira de segurança.

### Seed destrutiva
`npm run seed` recria dados de desenvolvimento e desabilita explicitamente o
trigger apenas durante a limpeza. Nunca executar contra banco real.

### Suíte de UI
O frontend possui scripts de timeline/data e build/lint, mas não depende de
um framework de testes de componentes. Adicionar um runner somente quando uma
regra visual interativa não puder ser coberta por teste de lógica e smoke real.
