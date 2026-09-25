## Purpose

A tela `/whatsapp`, onde a recepção vê a fila de conversas por prioridade, lê cada conversa completa ao lado do que a IA entendeu e do cadastro do hóspede, age sobre o contato e parte para o cadastro ou a reserva sem sair da tela.

## ADDED Requirements

### Requirement: Acesso restrito à recepção e ao gerente
A tela e todas as rotas do módulo, exceto o webhook, MUST exigir sessão válida de um usuário com papel `receptionist` ou `admin`. A identidade técnica do serviço de IA MUST receber 403 em todas elas. Com o módulo desligado, as rotas SHALL responder 404, exceto a de estado, que SHALL informar que o módulo está desligado.

#### Scenario: Sem sessão
- **WHEN** alguém sem sessão abre `/whatsapp`
- **THEN** é levado ao login, e as rotas do módulo respondem 401

#### Scenario: Serviço de IA tenta ler a fila
- **WHEN** a identidade técnica do serviço de IA chama a rota da fila
- **THEN** o backend responde 403 e registra a negativa

### Requirement: Fila ordenada por prioridade
A fila SHALL listar as conversas que aguardam resposta, ordenadas pela pontuação decrescente e, no empate, pela espera mais antiga. Cada item SHALL mostrar iniciais, nome (cliente vinculado, senão o nome do WhatsApp, senão o telefone formatado), tempo de espera ("há 14 min"), nível escrito por extenso, motivo curto, prévia da última mensagem ("Você: …" quando for de saída; o tipo de mídia quando não houver texto) e não lidas. Abaixo, num grupo separado, SHALL aparecer as conversas respondidas nas últimas 48 horas que esperam o hóspede. A informação de nível MUST NOT depender só de cor.

#### Scenario: Duas conversas no mesmo nível
- **WHEN** duas conversas têm a mesma pontuação
- **THEN** a que espera há mais tempo aparece primeiro

#### Scenario: Conversa respondida
- **WHEN** alguém responde uma conversa da fila
- **THEN** na próxima atualização ela sai de "Aguardando resposta" e aparece em "Respondidas · esperando o hóspede", com a etiqueta "Respondida"

### Requirement: Filtros e busca
A fila SHALL oferecer os filtros Todas, Leads, Com reserva e Outros, cada um com a contagem de conversas aguardando. Leads SHALL ser atendimentos com intenção de reserva nova ou pergunta de preço, Com reserva SHALL ser clientes com reserva pendente, confirmada ou em andamento, e Outros SHALL ser o restante. A busca SHALL encontrar conversas por nome ou telefone, inclusive as fora da fila.

#### Scenario: Filtro de leads
- **WHEN** a recepção escolhe o filtro Leads
- **THEN** só aparecem conversas de lead, na mesma ordem de prioridade

#### Scenario: Busca por telefone parcial
- **WHEN** a recepção busca "98841"
- **THEN** aparecem as conversas cujo telefone contém esses dígitos, estejam na fila ou não

### Requirement: Atender próximo
O botão Atender próximo SHALL abrir a primeira conversa da fila de espera, ignorando o filtro ativo. Se essa conversa já estiver aberta, SHALL abrir a segunda. Com a fila vazia, o botão SHALL ficar desabilitado com o texto "Fila vazia".

#### Scenario: Primeira já aberta
- **WHEN** a primeira conversa da fila está aberta e a recepção clica em Atender próximo
- **THEN** abre a segunda conversa da fila

### Requirement: Linha do tempo completa
A conversa SHALL mostrar as mensagens dos dois lados em ordem cronológica, com separador por dia no fuso do hotel e com o horário de cada mensagem. As mensagens de saída SHALL mostrar autor ou origem ("pelo celular", "Carla · sugestão editada") e status. Os marcadores da leitura da IA SHALL aparecer logo depois da mensagem que a leitura considerou, visualmente diferentes das mensagens. Mensagens anteriores SHALL ser carregadas sob demanda, 50 por vez.

#### Scenario: Conversa longa
- **WHEN** a conversa tem 200 mensagens
- **THEN** a tela mostra as 50 mais recentes e "Carregar anteriores" traz as 50 seguintes, sem repetir nenhuma

#### Scenario: Resposta dada pelo celular
- **WHEN** a recepcionista respondeu pelo celular do hotel
- **THEN** a resposta aparece à direita, com "pelo celular"

### Requirement: Não lidas zeram ao abrir
Abrir uma conversa SHALL zerar as não lidas dela para todos os usuários.

#### Scenario: Abrir conversa
- **WHEN** a recepção abre uma conversa com 3 não lidas
- **THEN** o contador some na fila e no menu na próxima atualização

### Requirement: Atualização automática sem recarregar
Com a aba visível, a fila SHALL se atualizar a cada 10 segundos e a conversa aberta a cada 4 segundos, buscando só as mensagens novas. A atualização SHALL pausar com a aba oculta e fazer uma leitura imediata ao voltar. Uma mensagem nova na conversa aberta SHALL ser anunciada a leitores de tela, sem roubar o foco.

#### Scenario: Mensagem nova com a conversa aberta
- **WHEN** o hóspede envia uma mensagem enquanto a conversa está aberta e visível
- **THEN** a mensagem aparece em até 5 segundos, sem recarregar a página

#### Scenario: Aba em segundo plano
- **WHEN** a aba fica oculta
- **THEN** a tela para de consultar o servidor até a aba voltar

### Requirement: Painel com a leitura da IA
O painel SHALL mostrar a leitura atual: intenção, período com número de noites, hóspedes, pedidos especiais, disponibilidade por categoria e, quando houver número de hóspedes, o valor total por categoria calculado pelo backend. Campos faltantes SHALL aparecer como aviso ("Faltam datas e número de pessoas…"). O painel SHALL mostrar a posição na fila ("Por que está em 3º") com até quatro motivos, ou "Fora da fila" quando a conversa não aguarda resposta. Sem leitura da IA, o painel SHALL dizer "Sem leitura da IA" e mostrar os motivos da pontuação sem IA. O painel MUST NOT mostrar indicadores financeiros consolidados.

#### Scenario: Pedido de reserva completo
- **WHEN** a leitura tem datas de 9 a 12 de outubro, 2 adultos e 1 criança de 7 anos
- **THEN** o painel mostra "sex 9 → seg 12 out · 3 noites", "2 adultos, 1 criança (7 anos)", as categorias livres e o total de cada uma

### Requirement: Painel do hóspede
Para contato vinculado, o painel SHALL mostrar nome, "Cliente desde", telefone, CPF mascarado, número de estadias concluídas, até 3 reservas pendentes, confirmadas ou em andamento, e um link para o cadastro. Para contato sem vínculo, o painel SHALL mostrar o telefone, o nome do WhatsApp e as ações Cadastrar hóspede, Vincular a um cadastro e Marcar como fornecedor. O CPF MUST aparecer mascarado para qualquer papel.

#### Scenario: Número sem cadastro
- **WHEN** a recepção abre a conversa de um número sem vínculo
- **THEN** o painel mostra o número cru e as três ações

### Requirement: Cadastro e vínculo a partir da conversa
Cadastrar hóspede SHALL abrir o cadastro de cliente com telefone e nome do WhatsApp já preenchidos e, ao salvar, SHALL vincular o novo cliente ao contato. Vincular a um cadastro SHALL mostrar os candidatos e SHALL permitir buscar qualquer cliente. O vínculo manual SHALL registrar quem vinculou. Um contato vinculado SHALL poder ser desvinculado.

#### Scenario: Cadastro a partir da conversa
- **WHEN** a recepção cadastra o hóspede a partir da conversa e salva
- **THEN** o contato fica vinculado ao cliente novo, e o painel passa a mostrar o cadastro

### Requirement: Criar reserva com os dados da leitura
Quando a leitura tiver datas válidas e o contato estiver vinculado, o painel SHALL oferecer Criar reserva com esses dados. Esse botão SHALL abrir o formulário de nova reserva já existente, preenchido com cliente, datas e hóspedes, e SHALL exigir a conferência e a confirmação humanas. Sem vínculo, o botão SHALL pedir o cadastro primeiro. Depois que a reserva for criada, a tela SHALL oferecer marcar o atendimento como "Virou reserva", sem marcar sozinha.

#### Scenario: Reserva a partir da conversa
- **WHEN** a recepção clica em Criar reserva com esses dados, confere e salva
- **THEN** a reserva é criada pelo fluxo normal, e a tela pergunta se deve marcar o desfecho como Virou reserva

### Requirement: Encerrar sem responder
A recepção SHALL poder tirar da fila uma conversa que não precisa de resposta (agradecimento, confirmação de fornecedor). A conversa SHALL voltar à fila se o hóspede escrever de novo.

#### Scenario: Agradecimento
- **WHEN** a recepção marca a conversa de agradecimento como "Não precisa resposta"
- **THEN** a conversa sai da fila e só volta se chegar mensagem nova

### Requirement: Avisos de conexão e de IA
Com o número desconectado, a tela SHALL mostrar um aviso fixo dizendo que mensagens novas não chegam e o envio está bloqueado. Sem IA disponível, a tela SHALL mostrar uma faixa discreta com o motivo (IA desligada, indisponível ou limite diário atingido) e SHALL continuar funcionando sem leituras nem sugestões.

#### Scenario: IA desligada
- **WHEN** `WHATSAPP_AI_ENABLED=false`
- **THEN** a fila funciona ordenada pela espera e pelos sinais do cadastro, a faixa diz "IA desligada" e nenhuma sugestão aparece

### Requirement: Layout responsivo
Em telas de 1200 px ou mais, a tela SHALL mostrar fila, conversa e painel em três colunas, cada uma com rolagem própria. Entre 900 e 1199 px, o painel SHALL virar uma gaveta aberta pelo botão Detalhes. Abaixo de 900 px, a tela SHALL mostrar a fila e, ao abrir uma conversa, só a conversa, com Voltar e Detalhes. A conversa aberta SHALL ficar na URL, para o botão voltar do navegador funcionar. A página MUST NOT ter rolagem horizontal em 320 px.

#### Scenario: Celular
- **WHEN** a recepção abre uma conversa numa tela de 390 px
- **THEN** a conversa ocupa a tela inteira, e o botão voltar do navegador retorna à fila

### Requirement: Acessibilidade
Itens da fila, filtros e ações SHALL ser controles nativos (botões, links, campos com rótulo), alcançáveis por teclado, com área de toque de pelo menos 40 px e foco visível. A conversa aberta SHALL ser indicada com `aria-current`. Botões só com ícone SHALL ter nome acessível. Os textos SHALL ter contraste de pelo menos 4,5:1.

#### Scenario: Navegação por teclado
- **WHEN** alguém usa só o teclado
- **THEN** consegue filtrar, abrir uma conversa, usar a sugestão e enviar sem mouse

### Requirement: Navegação do portal
Com o módulo ligado, o menu lateral SHALL mostrar WhatsApp no grupo Operação, depois de Agenda, com a contagem de conversas aguardando. Essa contagem SHALL ser atualizada a cada 30 segundos. A navegação inferior do celular SHALL mostrar Hoje, Agenda, WhatsApp e Mais. Com o módulo desligado, o item WhatsApp MUST NOT aparecer, e a navegação inferior SHALL voltar a mostrar Hóspedes.

#### Scenario: Contagem no menu
- **WHEN** há 6 conversas aguardando resposta
- **THEN** o item WhatsApp mostra 6 em até 30 segundos

### Requirement: Remoção da tela do agente
A página `/agente`, sua rota de API no frontend e o item "Agente IA" do menu MUST ser removidos. O endereço `/agente` SHALL responder como página inexistente.

#### Scenario: Link antigo
- **WHEN** alguém acessa `/agente`
- **THEN** o portal mostra a página de inexistente, e nenhum item de menu aponta para ela
