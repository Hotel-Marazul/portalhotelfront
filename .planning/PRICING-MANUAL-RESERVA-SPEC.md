# Especificação: tarifa por reserva e cálculo hoteleiro

## Objetivo

Permitir que a recepção registre uma reserva usando uma tarifa diária ajustada
para aquele atendimento, sem perder as tarifas de referência da categoria e sem
deixar o navegador decidir o total cobrado.

## Escopo

- Entrada e saída continuam sendo datas de hospedagem, com check-in às 14:00 e
  check-out às 12:00.
- O intervalo da reserva é semiaberto: `[check-in, check-out)`. Portanto, uma
  saída às 12:00 permite nova entrada às 14:00 no mesmo dia.
- No cadastro da categoria, `couplePrice` é a tarifa de referência para duas
  pessoas e `singlePrice` é opcional. O campo legado `price` permanece durante
  a expansão do modelo e serve como compatibilidade/default de casal.
- Uma pessoa usa a tarifa de solteiro; duas ou mais usam a tarifa de casal.
  Quando não houver tarifa de solteiro cadastrada para uma pessoa e a recepção
  não informar uma diária manual, a reserva é rejeitada com mensagem clara; o
  sistema não converte silenciosamente para casal.
- A primeira pessoa adicional completa a ocupação de casal e já está incluída
  na tarifa de casal. A partir da terceira pessoa, cada hóspede adicional usa a
  regra de idade selecionada e o valor da regra é por noite.
- A recepção pode informar `dailyRateOverride` por reserva. Esse valor substitui
  apenas a tarifa-base sugerida; não altera categoria nem quarto.
- Desconto, se usado, é um valor separado e auditável. O total é sempre calculado
  no backend:

  `total = (tarifa diária da reserva + adicionais diários) × noites - desconto`

- O backend grava um snapshot da precificação: tipo de tarifa, diária efetiva,
  quantidade de noites, origem (`catalog` ou `manual`), desconto, motivo e
  usuário responsável. O cliente nunca envia `totalPrice` como fonte de verdade.

## Contrato de datas

As telas enviam `YYYY-MM-DD` para reservas. O backend transforma a data em
14:00 local no check-in e 12:00 local no check-out. Timestamps ainda aceitos por
compatibilidade não alteram a regra de noites, que é baseada no calendário e
não em blocos de 24 horas.

## Compatibilidade e migração

- A migração é aditiva e idempotente: adiciona colunas novas sem remover ou
  reescrever destrutivamente as antigas.
- `categories.price` e `rooms.daily_price` continuam disponíveis para clientes
  antigos; o novo contrato expõe as tarifas de solteiro/casal quando existirem.
- Reservas antigas permanecem consultáveis. Reservas novas gravam a precificação
  nova; na ausência de snapshot antigo, a API mantém fallback compatível.

## Fora do escopo

- Não alterar `agents/`, `frontend/src/app/agente/` nem
  `frontend/src/app/api/agents/`.
- Não criar uma role de recepcionista neste ciclo; o campo de auditoria fica
  pronto e o controle de papéis atual permanece.
- Não aceitar edição do total final pelo frontend.

## Critérios de aceite

1. Uma reserva de 04/09 a 05/09 calcula uma noite; uma de 04/09 a 07/09 calcula
   três noites.
2. Uma saída de 04/09 às 12:00 e uma entrada de 04/09 às 14:00 não entram em
   conflito no mesmo quarto.
3. A criação/edição aceita uma diária manual e devolve o detalhamento calculado.
4. A diária manual não altera a categoria, o quarto ou outras reservas.
5. Uma pessoa sem `singlePrice` configurado recebe erro de validação quando não
   houver override manual; duas pessoas usam casal; da terceira em diante as
   regras de idade são aplicadas.
6. Valores, desconto e origem ficam persistidos e o projeto compila sem tocar
   nos caminhos de agente.
