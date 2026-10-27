## ADDED Requirements

### Requirement: Menu por papel
O menu lateral SHALL mostrar só texto, com o item atual destacado. O Hoje
fica em `/dashboard` e a Gestão numa rota própria do frontend, `/gestao`. Para a
recepção (`receptionist`), os itens SHALL ser: Hoje, Agenda, Hóspedes,
Quartos, Tarifas e WhatsApp. Para o gerente (`admin`), SHALL aparecer
também Gestão, no topo. O rodapé do menu SHALL mostrar o nome e o papel de
quem está logado.

#### Scenario: Recepção entra
- **WHEN** uma usuária `receptionist` faz login
- **THEN** o menu não mostra Gestão e a primeira tela é o Hoje

#### Scenario: Gerente entra
- **WHEN** um usuário `admin` faz login
- **THEN** o menu mostra Gestão no topo e a primeira tela é a Gestão

### Requirement: Contador da fila do WhatsApp no menu
O item WhatsApp do menu SHALL mostrar quantas conversas estão aguardando
resposta, pela mesma contagem de `/api/whatsapp/queue/count`. Quando a fila
estiver vazia, o número MUST NOT aparecer.

#### Scenario: Fila com conversas
- **WHEN** há 4 conversas aguardando
- **THEN** o item WhatsApp mostra 4

### Requirement: Painel único de conteúdo
O conteúdo de cada tela SHALL ficar em um painel branco único, com borda
fina e cantos de 14 px, sobre o fundo `--bg`. Seções dentro do painel SHALL
se separar por espaço e divisórias, e não por cartões com sombra.

#### Scenario: Seções do Hoje
- **WHEN** o Hoje mostra o movimento do dia e a lista "A fazer"
- **THEN** as duas seções ficam no mesmo painel, separadas por espaço, sem caixa própria

### Requirement: Sub-navegação do WhatsApp
As telas do WhatsApp SHALL ter abas no topo do painel: Conversas (com o
número da fila), Aprendizado da IA e Configurações. A aba Configurações
SHALL aparecer só para `admin`. O botão de som de mensagem nova e o estado
da conexão SHALL ficar à direita dessas abas.

#### Scenario: Recepção no WhatsApp
- **WHEN** a recepção abre o WhatsApp
- **THEN** vê as abas Conversas e Aprendizado da IA, e não vê Configurações

#### Scenario: Número desconectado
- **WHEN** a conexão do número está `close`
- **THEN** o estado aparece como "Desconectado" em vermelho ao lado das abas

### Requirement: Barra de busca do topo
As telas de operação (Hoje, Gestão, Agenda, Hóspedes e Quartos) SHALL ter
uma barra de busca que abre também por Ctrl/⌘ K. A barra SHALL buscar:
- hóspedes por nome, e-mail, telefone ou CPF (busca de `clients`);
- reservas pelo nome do hóspede (`search` de `GET /reservations`);
- quartos pelo número, na lista de quartos já carregada, com as reservas
  ativas do quarto por `roomId`.

A barra SHALL abrir o item escolhido. Ela MUST NOT oferecer pedidos à IA nesta change.

#### Scenario: Buscar pelo quarto
- **WHEN** a recepção digita "204" na barra
- **THEN** aparecem o quarto 204 e as reservas ativas nele, e Enter abre o escolhido

#### Scenario: Buscar pelo nome
- **WHEN** a recepção digita "Menezes"
- **THEN** aparecem o hóspede e as reservas dele, mais recentes primeiro
