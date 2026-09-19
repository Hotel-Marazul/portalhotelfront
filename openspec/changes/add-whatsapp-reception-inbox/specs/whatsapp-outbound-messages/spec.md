## Purpose

Permite que a recepção responda o hóspede pelo portal, com o número do hotel. O envio precisa ser idempotente, com autoria registrada, status visível, reconciliado com o que volta da Evolution e seguro diante de falhas, desconexão e respostas simultâneas.

## ADDED Requirements

### Requirement: Só uma pessoa autenticada envia
Mensagens SHALL ser enviadas somente por requisição de um usuário humano autenticado com papel `receptionist` ou `admin`. A identidade técnica do serviço de IA, jobs e workers MUST NOT conseguir enviar mensagens. Nenhum caminho do sistema SHALL enviar mensagem sem a ação explícita de uma pessoa.

#### Scenario: Serviço de IA tenta enviar
- **WHEN** a identidade técnica do serviço de IA chama a rota de envio
- **THEN** o backend responde 403, nada é enviado e a negativa é registrada

### Requirement: Validação do texto
O texto SHALL ter de 1 a 4.096 caracteres depois de remover espaços das pontas. Texto vazio SHALL ser recusado com 400 antes de qualquer chamada à Evolution.

#### Scenario: Texto só com espaços
- **WHEN** a recepção tenta enviar uma mensagem só com espaços
- **THEN** o envio é recusado com 400 e nada é gravado

### Requirement: Envio idempotente
Cada envio SHALL levar um identificador de requisição gerado pela tela. Repetir a mesma requisição, por duplo clique, retentativa ou timeout de rede, MUST NOT enviar duas mensagens. A repetição SHALL devolver a mensagem já registrada, e o mesmo identificador usado em outra conversa SHALL ser recusado com 409.

#### Scenario: Duplo clique em Enviar
- **WHEN** a mesma requisição de envio chega duas vezes
- **THEN** o hóspede recebe uma única mensagem e a linha do tempo mostra uma única mensagem

### Requirement: Registro antes do envio e status visível
A mensagem SHALL ser registrada como "enviando" antes da chamada à Evolution. Depois, SHALL passar a "enviada" no sucesso ou a "falhou" com um motivo curto, e SHALL avançar para "entregue" e "lida" conforme as confirmações do WhatsApp. A linha do tempo SHALL mostrar o status de cada mensagem de saída.

#### Scenario: Envio bem-sucedido
- **WHEN** a Evolution aceita a mensagem
- **THEN** a mensagem aparece como enviada e depois como entregue e lida, conforme as confirmações

### Requirement: Autoria e origem
Toda mensagem enviada pelo portal SHALL registrar o usuário que enviou e a origem: escrita do zero, sugestão da IA sem mudanças ou sugestão editada. A linha do tempo SHALL mostrar o primeiro nome do autor e a origem. Mensagens enviadas pelo celular do hotel SHALL aparecer como "pelo celular", sem autor.

#### Scenario: Envio de sugestão editada
- **WHEN** Carla usa a sugestão, muda uma frase e envia
- **THEN** a mensagem aparece como "Carla · sugestão editada"

### Requirement: Reconciliação com o evento de volta
A mensagem enviada pelo portal e o evento de mensagem própria que a Evolution devolve SHALL resultar numa única mensagem na linha do tempo, com a autoria e a origem do portal. Isso vale em qualquer ordem de chegada: resposta da Evolution primeiro ou evento primeiro.

#### Scenario: Evento chega antes da resposta
- **WHEN** o evento de mensagem própria chega antes de a chamada de envio terminar
- **THEN** a linha do tempo mostra uma única mensagem, com o autor do portal

### Requirement: Falha e reenvio
Uma falha de envio SHALL deixar a mensagem na linha do tempo como "falhou", com o motivo e o botão Reenviar. O reenvio SHALL usar o mesmo texto. Em falha por tempo esgotado, a tela SHALL avisar que a mensagem pode já ter sido entregue antes de reenviar. Uma confirmação posterior do WhatsApp para a mesma mensagem SHALL marcá-la como enviada, sem duplicar.

#### Scenario: Evolution fora do ar
- **WHEN** a chamada à Evolution falha
- **THEN** a mensagem aparece como "falhou" com o motivo, e Reenviar tenta de novo com o mesmo texto

#### Scenario: Timeout que na verdade entregou
- **WHEN** o envio estoura o tempo, mas o evento de mensagem própria com o mesmo texto chega em até 2 minutos
- **THEN** a mensagem passa a "enviada" e não é duplicada

### Requirement: Envio bloqueado sem conexão
Com o número desconectado, o envio SHALL ser recusado com um código específico antes de chamar a Evolution. A tela SHALL mostrar o motivo no próprio campo de resposta, preservando o texto digitado.

#### Scenario: Número desconectado
- **WHEN** a recepção tenta enviar com o número desconectado
- **THEN** o envio é recusado, o texto continua no campo e a tela explica que o número está desconectado

### Requirement: Resposta simultânea
Se outra pessoa respondeu a conversa depois da última mensagem que a recepcionista viu, o envio SHALL ser recusado com um código de conflito, trazendo a resposta mais recente. A tela SHALL oferecer revisar ou enviar mesmo assim.

#### Scenario: Duas recepcionistas
- **WHEN** Carla e Mariana escrevem para o mesmo hóspede e Mariana envia primeiro
- **THEN** o envio de Carla é interrompido com "Alguém respondeu enquanto você escrevia", mostrando a resposta de Mariana, e só segue se Carla escolher enviar mesmo assim

### Requirement: Lembrete do aviso de privacidade
Quando o contato nunca recebeu mensagem do hotel, o campo de resposta SHALL mostrar o lembrete "Primeiro contato: inclua o aviso de registro" com a ação Inserir aviso. Essa ação SHALL acrescentar o texto configurado em `WHATSAPP_PRIVACY_NOTICE` ao final da resposta. O lembrete MUST NOT bloquear o envio e MUST NOT inserir o texto sozinho.

#### Scenario: Primeiro contato
- **WHEN** a recepção abre a conversa de um número que nunca recebeu mensagem do hotel
- **THEN** o lembrete aparece, e o texto só entra na resposta se ela clicar em Inserir aviso

### Requirement: Efeito do envio na fila
Uma mensagem enviada com sucesso SHALL tirar a conversa da fila de espera, zerar as não lidas e registrar a primeira resposta do atendimento quando ainda não houver.

#### Scenario: Primeira resposta do atendimento
- **WHEN** a primeira resposta de um atendimento é enviada às 10:37 para uma conversa que começou às 10:21
- **THEN** o atendimento registra 16 minutos até a primeira resposta
