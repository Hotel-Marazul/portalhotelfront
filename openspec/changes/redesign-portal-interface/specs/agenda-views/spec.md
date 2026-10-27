## ADDED Requirements

### Requirement: Mapa com meio-dia de entrada e saída
O mapa da Agenda SHALL desenhar cada reserva do meio do dia de entrada ao
meio do dia de saída. Quando uma reserva sai e outra entra no mesmo quarto
no mesmo dia, as duas SHALL ocupar metades diferentes da coluna, sem
sobreposição. Cada dia SHALL ter uma marca fina no meio. A legenda SHALL
explicar: "saída à esquerda, entrada à direita".

#### Scenario: Troca no mesmo dia
- **WHEN** Costa sai do 104 hoje e Freitas entra no 104 hoje
- **THEN** a barra de Costa termina no meio da coluna de hoje e a de Freitas começa ali, com 2 px entre elas

#### Scenario: Reserva que começou antes do período
- **WHEN** a reserva de Souza começou 3 dias antes do primeiro dia visível
- **THEN** a barra encosta na borda esquerda, com o canto esquerdo reto

#### Scenario: Diária única
- **WHEN** uma reserva tem uma noite
- **THEN** a barra ocupa a largura de um dia, entre o meio do dia de entrada e o meio do dia seguinte, e o nome completo fica no `aria-label`

### Requirement: Organização do mapa
O mapa SHALL agrupar os quartos por categoria, com o nome da categoria e a
capacidade. Cada linha SHALL mostrar o número do quarto e a capacidade. O
dia de hoje SHALL ter destaque na coluna. O quarto em manutenção SHALL
aparecer com o bloco hachurado no período. O período padrão SHALL ser de 14
dias, com navegação por semana e o botão Hoje.

#### Scenario: Quarto do casal
- **WHEN** a categoria Standard tem o 102 para 2 pessoas e os outros quartos para 4
- **THEN** o cabeçalho da categoria diz "102 para 2 · demais até 4" e cada linha mostra a sua capacidade

### Requirement: Lista de reservas
A visão Lista da Agenda SHALL ter:
- busca pelo nome do hóspede (`search`) e pelo número do quarto, que o
  frontend converte em `roomId` a partir da lista de quartos;
- filtro por período de entrada;
- filtro de status que liga e desliga, com contagem por status.

Por padrão, `Concluída` e `Cancelada` SHALL ficar desligadas. A tabela
SHALL mostrar código, hóspede com número de pessoas, quarto com categoria,
período com noites, status, total e a ação Abrir. Os filtros SHALL ir para
`GET /reservations` (`status`, `search`, `roomId`, `checkInFrom/To`), e não
filtrar só a página carregada. Buscar pelo código da reserva fica para
`add-reservation-operational-data`.

#### Scenario: Ver canceladas
- **WHEN** a recepção liga o filtro Cancelada
- **THEN** a lista consulta o backend com esse status e mostra as canceladas do período

### Requirement: Reserva aberta
A reserva SHALL abrir por cima da tela de origem, com:
- status, código e nome do hóspede;
- uma faixa de andamento: Pendente, Confirmada, Hospedada, Concluída;
- a ação do próximo passo.

O conteúdo SHALL ficar em quatro abas:
- **Resumo:** período, quarto, alimentação, preço detalhado e cliente;
- **Hóspedes:** lista com a regra por idade;
- **Pagamentos:** total, pago e saldo, registro por etapa e forma, estorno;
- **Histórico:** a última alteração registrada.

Todas as ações do drawer atual SHALL continuar, com as mesmas rotas e
validações:
- confirmar, iniciar e concluir hospedagem;
- cancelar com confirmação;
- editar datas, quarto, alimentação e hóspedes;
- diária aplicada e desconto com motivo obrigatório;
- registrar e estornar pagamento;
- alerta de exceção financeira.

#### Scenario: Concluir com saldo
- **WHEN** a hospedagem está `EmAndamento` com saldo de R$ 1.240
- **THEN** o botão "Concluir hospedagem" aparece com o aviso do saldo em aberto, e concluir não apaga o saldo

#### Scenario: Diária ajustada
- **WHEN** a reserva tem `price_source` `manual`
- **THEN** o Resumo mostra "diária ajustada" e o motivo registrado, com quem lançou

#### Scenario: Cancelar
- **WHEN** a recepção cancela uma reserva `Confirmada`
- **THEN** a tela pede confirmação antes de chamar `cancel`, como hoje

### Requirement: Nova reserva
A nova reserva SHALL abrir por cima da tela de origem, em duas colunas: o
formulário e um resumo fixo com o total. O formulário SHALL ter:
- cliente: buscar um existente ou cadastrar ali mesmo;
- datas, com o número de noites;
- adultos e crianças com idade;
- alimentação: só café ou meia pensão;
- os quartos livres agrupados por categoria, com a diária de casal da
  categoria;
- ajuste manual de preço recolhido, com motivo obrigatório.

O total SHALL vir de `quote` assim que cliente e quarto estiverem
escolhidos. Quartos sem capacidade para o grupo MUST NOT aparecer, e a tela
SHALL dizer qual ficou de fora e por quê. A disponibilidade SHALL ser
conferida de novo ao criar, como hoje.

#### Scenario: Grupo de três
- **WHEN** a reserva é para 2 adultos e uma criança de 4 anos
- **THEN** o 102 não aparece na lista, e a tela diz "O 102 não aparece porque comporta só 2 pessoas"

#### Scenario: Vinda do WhatsApp
- **WHEN** a nova reserva é aberta a partir de uma conversa com leitura da IA
- **THEN** datas e pessoas já vêm preenchidas, com a indicação "Preenchida pela conversa com {nome}"

#### Scenario: Quarto ocupado no meio do caminho
- **WHEN** outro usuário reserva o mesmo quarto antes de a recepção clicar em Criar
- **THEN** a criação falha com "O quarto selecionado deixou de estar disponível. Escolha outro quarto.", como hoje
