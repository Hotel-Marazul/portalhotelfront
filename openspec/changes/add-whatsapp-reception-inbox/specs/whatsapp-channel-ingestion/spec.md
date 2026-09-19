## Purpose

Recebe as mensagens do número do hotel pela Evolution e as guarda de forma confiável: sem perder, sem duplicar e sem expor dados pessoais. Também mantém contatos, conversas, atendimentos, status de entrega, estado da conexão e o vínculo de cada número com o cadastro de clientes.

## ADDED Requirements

### Requirement: Webhook autenticado por segredo
O endpoint que recebe eventos da Evolution MUST exigir o segredo configurado em `WHATSAPP_WEBHOOK_SECRET`, comparado em tempo constante, e MUST NOT gravar nada quando o segredo faltar ou estiver errado. Com o módulo desligado (`WHATSAPP_ENABLED=false`), o endpoint SHALL responder 404.

#### Scenario: Requisição sem segredo
- **WHEN** uma requisição chega ao webhook sem segredo ou com segredo diferente
- **THEN** o sistema responde 401 e nenhuma linha é criada em nenhuma tabela

#### Scenario: Módulo desligado
- **WHEN** `WHATSAPP_ENABLED=false` e uma requisição chega ao webhook, mesmo com o segredo correto
- **THEN** o sistema responde 404

### Requirement: Resposta rápida com gravação do evento bruto
Cada evento autenticado SHALL ser gravado integralmente como evento bruto antes de qualquer interpretação, e o webhook SHALL responder 200 em até 2 segundos, sem esperar o processamento. O webhook MUST NOT ser afetado pelo limite global de requisições nem pelo limite global de 100 kb do corpo; ele SHALL aceitar corpos de até 2 MB.

#### Scenario: Evento válido
- **WHEN** a Evolution envia um evento autenticado
- **THEN** o evento bruto é gravado, o webhook responde 200 e o processamento acontece depois da resposta

#### Scenario: Banco indisponível
- **WHEN** o evento bruto não pode ser gravado
- **THEN** o webhook responde 503 para que a Evolution reenvie

#### Scenario: Rajada de eventos
- **WHEN** a Evolution envia 300 eventos em um minuto a partir do mesmo IP
- **THEN** todos são aceitos, sem nenhuma resposta 429

### Requirement: Processamento isolado com novas tentativas
Uma falha ao interpretar um evento MUST NOT alterar a resposta do webhook nem impedir o processamento dos demais. O sistema SHALL registrar um código curto de erro no evento, SHALL tentar de novo automaticamente até 5 vezes e SHALL oferecer um comando para reprocessar os eventos não processados.

#### Scenario: Payload com formato inesperado
- **WHEN** um evento não pode ser interpretado
- **THEN** o evento fica sem `processed_at`, com código de erro, e os eventos seguintes continuam sendo processados

#### Scenario: Reprocessamento manual
- **WHEN** alguém corrige o parser e executa o comando de reprocessamento
- **THEN** os eventos pendentes são processados de novo, sem duplicar mensagens já gravadas

### Requirement: Eventos fora do escopo são ignorados
O sistema SHALL processar somente mensagens novas, atualizações de status e mudanças de conexão da instância configurada. Mensagens de grupos, listas de transmissão, status, canais, reações, mensagens de protocolo, eventos de outras instâncias e outros tipos de evento MUST ser marcados como ignorados, sem criar contato, conversa ou mensagem.

#### Scenario: Mensagem de grupo
- **WHEN** chega uma mensagem cujo destinatário é um grupo
- **THEN** o evento é marcado como ignorado e nenhuma conversa é criada

### Requirement: Mensagem recebida entra na conversa e na fila
Uma mensagem nova de um hóspede SHALL criar ou atualizar, numa única transação, o contato, a conversa, o atendimento aberto e a mensagem. A mensagem SHALL colocar a conversa como aguardando resposta desde a primeira mensagem ainda sem resposta, SHALL incrementar as não lidas e SHALL agendar uma nova leitura da IA. Nome do contato vazio MUST NOT sobrescrever um nome já conhecido.

#### Scenario: Primeira mensagem de um número
- **WHEN** um número nunca visto envia "Olá, qual o valor da diária?"
- **THEN** existem um contato, uma conversa, um atendimento aberto e uma mensagem de entrada, e a conversa aparece na fila com uma não lida

#### Scenario: Segunda mensagem sem resposta
- **WHEN** o mesmo hóspede envia outra mensagem antes de alguém responder
- **THEN** a conversa continua aguardando desde a primeira mensagem, e as não lidas passam a 2

### Requirement: Mensagens não se duplicam
Cada mensagem do WhatsApp SHALL existir no máximo uma vez, identificada pelo id da mensagem na Evolution, mesmo quando o evento for entregue mais de uma vez ou fora de ordem.

#### Scenario: Evento reentregue
- **WHEN** a Evolution entrega de novo um evento de mensagem já gravada
- **THEN** a mensagem não é duplicada, e as não lidas e o tempo de espera não mudam

#### Scenario: Evento antigo chega depois de um novo
- **WHEN** chega uma mensagem com instante anterior à última mensagem da conversa
- **THEN** ela entra na linha do tempo na posição do seu instante, sem alterar o tempo de espera nem as não lidas

### Requirement: Mensagens enviadas pelo celular do hotel são registradas
Mensagens enviadas pelo número do hotel fora do portal SHALL ser gravadas como mensagens de saída com origem "pelo celular". Elas SHALL tirar a conversa da fila, zerar as não lidas e registrar a primeira resposta do atendimento.

#### Scenario: Recepcionista responde pelo celular
- **WHEN** alguém responde uma conversa pelo celular do hotel
- **THEN** a resposta aparece na linha do tempo como "pelo celular" e a conversa vai para o grupo "Respondidas"

### Requirement: Mídia registrada sem download
Para imagem, áudio, vídeo, documento, figurinha, localização e contato, o sistema SHALL registrar o tipo e a legenda quando houver, e MUST NOT baixar nem armazenar o arquivo.

#### Scenario: Foto com legenda
- **WHEN** um hóspede envia uma foto com a legenda "o ar do quarto"
- **THEN** a mensagem é gravada com tipo imagem e corpo "o ar do quarto", sem arquivo

### Requirement: Status de entrega só avança
O status das mensagens de saída SHALL seguir a ordem enviada, entregue, lida, e MUST NOT voltar. O status de falha SHALL substituir apenas os estados enviando e enviada.

#### Scenario: Confirmação de leitura antes da de entrega
- **WHEN** chega a confirmação de leitura e depois a de entrega da mesma mensagem
- **THEN** o status final é lida

### Requirement: Estado da conexão do número
O sistema SHALL manter o estado da conexão do número (conectado, conectando, desconectado ou desconhecido) a partir dos eventos de conexão. Ele SHALL também consultar a Evolution periodicamente, no máximo a cada 60 segundos, para corrigir eventos perdidos, e SHALL expor o estado à tela.

#### Scenario: Número cai
- **WHEN** a Evolution informa que a instância desconectou
- **THEN** a tela passa a mostrar o aviso de desconexão em até 30 segundos, e o envio fica bloqueado

### Requirement: Atendimentos delimitam cada ciclo
Cada conversa SHALL ter no máximo um atendimento aberto. Um atendimento SHALL começar com a primeira mensagem do hóspede quando não houver atendimento aberto, e SHALL terminar quando a recepção marcar o desfecho ou quando a conversa ficar 7 dias sem mensagens.

#### Scenario: Hóspede volta meses depois
- **WHEN** um hóspede cujo atendimento foi fechado escreve de novo
- **THEN** um novo atendimento é aberto, e o desfecho do anterior é preservado

### Requirement: Telefones normalizados em E.164 com a variante do nono dígito
Telefones de contatos e de clientes SHALL ser normalizados para E.164, assumindo o Brasil (+55) quando o número tiver DDD sem código do país. A comparação entre contato e cliente SHALL considerar como equivalentes as formas com e sem o nono dígito de celulares brasileiros. Telefones que não puderem ser normalizados SHALL ficar sem forma normalizada, sem impedir o cadastro.

#### Scenario: Formatos diferentes do mesmo número
- **WHEN** um cliente tem o telefone "(48) 99999-8888" e o contato do WhatsApp é `5548999998888@s.whatsapp.net`
- **THEN** ambos são normalizados para `+5548999998888`

#### Scenario: Celular antigo sem o nono dígito
- **WHEN** o WhatsApp entrega `555188412207` e o cliente está cadastrado como `(51) 98841-2207`
- **THEN** o sistema reconhece os dois como o mesmo número

### Requirement: Vínculo entre contato e cliente
Um contato SHALL ser vinculado automaticamente a um cliente quando exatamente um cliente tiver telefone equivalente, tanto ao surgir o contato quanto ao criar ou alterar o telefone de um cliente. Com zero ou mais de um candidato, o contato MUST ficar sem vínculo, e o sistema SHALL listar até 10 candidatos para escolha manual. Depois que alguém desvincular à mão, o vínculo automático MUST NOT refazer esse vínculo.

#### Scenario: Dois clientes com o mesmo telefone
- **WHEN** chega mensagem de um número que dois clientes têm cadastrado
- **THEN** o contato fica sem vínculo, e a tela oferece os dois como candidatos

#### Scenario: Cliente cadastrado depois da conversa
- **WHEN** a recepção cadastra um cliente com o telefone de um contato sem vínculo
- **THEN** o contato passa a estar vinculado a esse cliente

#### Scenario: Desvínculo manual
- **WHEN** a recepção desvincula um contato vinculado automaticamente
- **THEN** o contato fica sem vínculo e não é vinculado de novo sozinho

### Requirement: Preenchimento dos telefones já cadastrados
O sistema SHALL oferecer um comando que normaliza os telefones dos clientes já cadastrados. Por padrão, o comando MUST apenas relatar quantos seriam normalizados e quais ids de cliente têm telefone inválido, sem gravar. Ele SHALL gravar somente quando executado com a opção explícita de aplicar, numa única transação.

#### Scenario: Execução de conferência
- **WHEN** o comando roda sem a opção de aplicar
- **THEN** ele mostra totais e ids, e nenhuma linha do banco muda

### Requirement: Contato marcado como fornecedor
A recepção e o gerente SHALL poder marcar um contato como fornecedor e desfazer a marcação. Contatos de fornecedor SHALL continuar recebendo e enviando mensagens normalmente.

#### Scenario: Marcar fornecedor
- **WHEN** a recepção marca a Distribuidora Litoral como fornecedor
- **THEN** o contato passa a ser tratado como fornecedor na fila e nas métricas de leads

### Requirement: Retenção configurável
O sistema SHALL apagar diariamente as mensagens com mais de `WHATSAPP_RETENTION_MONTHS` meses (padrão 12), junto com as leituras e sugestões ligadas a elas, os atendimentos fechados além desse prazo e os eventos brutos processados com mais de 30 dias. Regras aprendidas e seus eventos, que não guardam dados de hóspedes, MUST NOT ser apagados.

#### Scenario: Mensagem além do prazo
- **WHEN** o job diário roda e existe uma mensagem de 13 meses atrás, com retenção de 12 meses
- **THEN** a mensagem e as leituras e sugestões ligadas a ela são apagadas

### Requirement: Registro sem dados pessoais
Logs do módulo MUST NOT conter corpo de mensagem, telefone, nome do contato, CPF ou texto de sugestão. Os logs SHALL identificar eventos por id, tipo e código de erro.

#### Scenario: Erro de processamento
- **WHEN** o processamento de uma mensagem falha
- **THEN** o log registra o id do evento e o código do erro, sem o conteúdo da mensagem
