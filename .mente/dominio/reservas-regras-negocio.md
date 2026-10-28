---
tags: [dominio, reservas, pricing, regras-negocio]
---

# Reservas — Regras de Negócio

## Fonte de verdade e datas

O PostgreSQL é a fonte de verdade. O backend normaliza datas civis no fuso
`HOTEL_TIMEZONE` (padrão `America/Sao_Paulo`): check-in sem horário ocorre às
14:00 e check-out às 12:00. Noites são a diferença entre as datas civis, não a
duração em segundos.

A hospedagem ocupa o intervalo `[check_in, check_out)`. Portanto, uma saída e
uma entrada no mesmo dia podem ser adjacentes. `Cancelada` não bloqueia o
quarto; os demais status bloqueiam o intervalo e a constraint PostgreSQL
`reservations_no_overlapping_stays` é a defesa final contra sobreposição.

## Ciclo de vida

As únicas transições são:

```text
Pendente → Confirmada → EmAndamento → Concluída
    └──────────────→ Cancelada
Confirmada ────────→ Cancelada
```

`POST /api/reservations/:id/transitions` exige `version` e registra autoria.
`EmAndamento`, `Concluída` e `Cancelada` são estados terminais para o fluxo de
cancelamento comum. `EmAndamento` só começa dentro do intervalo da estadia.
Reservas pendentes ou confirmadas vencidas são exceções operacionais expostas
em consultas; nenhum job altera o status silenciosamente.

A criação inicia em `Pendente`. Somente `admin` pode criar diretamente em
`Confirmada`, informando justificativa. O `PUT` altera dados da reserva, não o
status; status usa o comando de transição.

## Cancelamento e histórico

`POST /api/reservations/:id/cancel` e a rota legada
`DELETE /api/Reservations/:id` executam cancelamento lógico, nunca `DELETE` da
reserva. O comando exige versão, motivo e registra evento append-only com
ator, estado anterior/novo, motivo, correlação e instante. Hóspedes, pagamentos,
preço e datas permanecem no histórico.

## Hóspedes, capacidade e preço

O cadastro inicial do hóspede exige somente nome e telefone. CPF, e-mail e
dados de veículo podem ser completados na edição do hóspede no check-in.
CPF e e-mail, quando informados, continuam validados; CPF informado é único.
CPF ausente é `NULL` no banco e string vazia nos DTOs, permitindo vários
cadastros iniciais sem documento. Omissão ou vazio na edição preserva o CPF
existente, inclusive para a recepção que recebe o documento mascarado.
Esse cadastro permite criar uma reserva com quarto, datas e regras normais
de capacidade, preço e disponibilidade; não introduz um novo status de reserva.

O cliente principal não é armazenado em `reservation_guests`; `guests` contém
somente acompanhantes. O primeiro acompanhante completa a tarifa de casal e
os acompanhantes seguintes são adicionais pagos por regra de idade. O total
de pessoas é `1 + guests.length` e nunca pode exceder a capacidade do quarto.
A regra de preço de cada adicional pago precisa existir e ser compatível com a
idade.

Os nomes dos acompanhantes são opcionais na reserva e na confirmação: omissão
ou branco vira string vazia, sem gravar rótulos como se fossem nomes reais.
A quantidade de acompanhantes e as idades usadas na precificação continuam
obrigatórias. O fluxo de adultos da interface usa a faixa adulta (18) para
cotação; a identificação e a idade efetiva podem ser completadas na recepção.
Antes da transição para `EmAndamento` (check-in), todos os acompanhantes devem
estar identificados; nomes não podem ser apagados durante a hospedagem.
Completar somente os nomes preserva o snapshot de preço da reserva.

O preço é calculado pelo backend a cada criação/edição e gravado como snapshot:
quantidade de noites, tarifa (solteiro/casal), adicionais, subtotal, desconto,
origem e total. O cliente não envia `totalPrice`. Ajustes manuais exigem motivo
e autoria de usuário autorizado.

### Tarifas de verão e unidade conjugada

As categorias operacionais têm tarifa de casal com café (`couple_price`) e
tarifa de casal com meia pensão (`half_board_price`). O payload de reserva e
cotação aceita `mealPlan: breakfast | half_board`; omissão em nova reserva usa
café, e omissão na edição preserva o regime salvo. Sem tarifa de meia pensão
não se presume o valor do café. `rate_valid_from` é a primeira entrada válida;
`rate_valid_until` é o limite exclusivo das diárias, permitindo saída nessa data.
A temporada ativada é dezembro/2026 a fevereiro/2027; outras datas exigem tarifa
cadastrada. Nenhum mínimo de estadia foi ativado.

Regras da temporada são vinculadas por `tariff_catalog_code`/`catalog_code` e
selecionadas pelo backend pela idade: até dois anos grátis; três a cinco anos
R$100 por hóspede por hospedagem; seis a onze R$120 por diária; doze ou mais
R$200 por diária. `billing_basis=per_stay` compõe `additionalStayTotal`, sem
multiplicar por diárias; `per_daily` compõe `additionalDailyTotal`. As regras
legadas permanecem separadas. O snapshot completo fica em `pricing_snapshot`;
`pricing_input_hash` permite preservar a cotação quando os dados de precificação
não mudam, mesmo após alteração do catálogo. Consultas nunca recalculam preço.

O conjugado 115/116 é uma única unidade de inventário para até cinco pessoas,
aceitando também casal no 115 sozinho (capacidade individual de duas pessoas).
O 102 acomoda duas pessoas. Os demais quartos cadastrados nas quatro categorias
acomodam até quatro pessoas, conforme confirmação do hotel em 2026-10-27. `connected_room_number=116` compartilha o mesmo ID do
115, portanto uma reserva bloqueia os dois números. A tabela
`room_inventory_numbers` impede cadastrar o 116 como outra unidade, inclusive
em escritas concorrentes. Recepção e agenda exibem `displayNumber=115/116`.

## Pagamentos

Todo pagamento positivo exige chave de idempotência UUID. A reserva é bloqueada
antes da soma autoritativa; o valor não pode exceder o saldo no instante da
transação. Etapa e método são informativos e não promovem status.

Lançamentos são imutáveis. Correções usam a rota de reversão, que mantém o
pagamento original e grava um lançamento `reversal` negativo relacionado ao
original, com motivo e autoria. `totalPaid` e `balanceDue` são agregados pelo
backend em centavos; reservas legadas com excesso aparecem como
`financialException` e não são reparadas automaticamente.

## Consultas e indicadores

Listas de reservas e clientes usam `page`/`pageSize` com teto, total e ordenação
estável. Filtros de data tratam o limite final como inclusivo civil, convertendo
o dia seguinte para o limite SQL exclusivo. Disponibilidade valida
`guestCount`, manutenção, status bloqueante e intervalo `[)`.

Uma reserva parcial pode bloquear quarto e período com hóspede responsável já
cadastrado, mantendo tarifa, alimentação e ocupação sem preenchimento. A API
marca `detailsPending`, registra total zero como valor ainda não definido e
impede o check-in até esses dados serem informados. Ao completar a reserva, a
edição precisa enviar hóspedes e alimentação; o backend então calcula e grava o
preço normal. Reservas parciais não recebem pagamentos.

Em reservas precificadas, a idade exata de um acompanhante pode ficar pendente
quando sua faixa de cobrança já estiver confirmada; nesse caso, a reserva grava
a regra selecionada e exige a idade antes de iniciar o check-in.

O dashboard separa receita reservada (preço de reservas não canceladas por data
de check-in) de recebimentos (lançamentos por data de criação, incluindo
reversões). Ocupação é calculada em quarto-noites civis; check-ins e check-outs
excluem canceladas, e pendências vencidas ficam fora das reservas ativas e são
exibidas separadamente. O papel `receptionist` é a recepção (até 2026-09 se
chamava `manager`, o que confundia com gerente; o gerente é `admin`): pode consultar
e registrar finanças operacionais de uma reserva, mas não acessa os agregados
financeiros gerenciais, disponíveis somente ao `admin`. A sessão expõe ao
frontend apenas `id`, `email` e `role` pelo endpoint autenticado `/api/User/me`.

## Agentes

O navegador chama somente o gateway autenticado do backend. O FastAPI exige
credencial interna, chama o backend com `BACKEND_BEARER_TOKEN` e recebe contexto
assinado do usuário iniciador. A allowlist técnica cobre somente leitura de
quartos/reservas, cotação, criação, edição e cancelamento lógico.

Mutações do agente são propostas com hash e validade de dez minutos. O backend
só é chamado após `confirmo` (ou confirmação afirmativa equivalente) vinculada
à proposta; alteração de dados, preço, disponibilidade ou expiração invalida a
proposta. Chaves estáveis tornam criação, edição, cancelamento, pagamentos e
retentativas idempotentes.

## Inicialização sem dados de demonstração

A inicialização cria o schema e os acessos configurados por ambiente, sem
cadastrar categorias, quartos, hóspedes, reservas ou regras de preço de exemplo.
`npm run seed` é mantido como comando de inicialização compatível e não apaga
nem sobrescreve dados operacionais. Tarifas e faixas etárias são cadastradas ou
importadas explicitamente. As regras antigas de R$45/R$60/R$95 não devem voltar
ao catálogo; a tabela comercial confirmada usa 0–2 grátis, 3–5 R$100 por estadia,
6–11 R$120 por diária e 12+ R$200 por diária adicional.

O teste `npm run test:integration:startup` exige um banco vazio e descartável
com nome iniciado por `portal_hotel_test_no_demo_`; ele verifica tanto a
inicialização quanto a preservação de dados ao executar o comando de seed.

## Referências

- Regras temporais e preço: `backend/src/utils/reservation.ts`
- Máquina de estados: `backend/src/utils/reservation-lifecycle.ts`
- Rotas e transações: `backend/src/modules/reservations/reservations.routes.ts`
- Schema e validações: `backend/src/modules/reservations/reservations.schema.ts`
- Diagnóstico somente leitura: `backend/src/db/reservation-diagnostics.ts`
