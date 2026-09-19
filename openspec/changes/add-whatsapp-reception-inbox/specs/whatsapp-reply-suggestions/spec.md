## Purpose

Poupa digitação da recepção com um texto de resposta sugerido pela IA. A sugestão usa só fatos verificados pelo backend, marca o que a IA não sabe e nunca sai para o hóspede sem uma pessoa revisar e enviar.

## ADDED Requirements

### Requirement: Quando existe sugestão
Uma sugestão SHALL ser gerada quando alguém abre uma conversa que aguarda resposta, com a IA disponível e sem sugestão viva para a última mensagem do hóspede. Cada mensagem do hóspede SHALL ter no máximo uma sugestão viva, reaproveitada por qualquer pessoa que abra a conversa. Conversas que não aguardam resposta MUST NOT gerar sugestão.

#### Scenario: Duas pessoas abrem a mesma conversa
- **WHEN** Carla e depois Mariana abrem a mesma conversa sem mensagem nova no meio
- **THEN** as duas veem a mesma sugestão, e o modelo é chamado uma única vez

#### Scenario: Conversa já respondida
- **WHEN** a recepção abre uma conversa em que a última mensagem é do hotel
- **THEN** nenhuma sugestão é pedida nem mostrada

### Requirement: Só fatos verificados
A sugestão SHALL usar somente os fatos enviados pelo backend (datas, hóspedes, disponibilidade, preços totais por categoria e reservas do cliente), as políticas do hotel na base de conhecimento do serviço de IA e as regras de resposta aprovadas. Informação necessária que não esteja nessas fontes MUST aparecer como trecho a completar, entre colchetes. Todo valor em reais fora desses trechos MUST ser igual a um preço dos fatos. Uma sugestão que viole isso MUST ser descartada sem ser mostrada.

#### Scenario: Estacionamento sem política cadastrada
- **WHEN** o hóspede pergunta sobre estacionamento e a base de políticas não fala disso
- **THEN** a sugestão traz um trecho como "[confirmar vaga para 2 carros]" em vez de afirmar algo

#### Scenario: Preço inventado
- **WHEN** o modelo escreve "R$ 1.500" e o preço calculado pelo backend para o período é R$ 1.890,00
- **THEN** a sugestão é descartada, o log registra o motivo sem o texto e a tela não mostra sugestão

### Requirement: Fontes visíveis
Cada sugestão SHALL informar de 2 a 4 fontes usadas ("disponibilidade 9–12 out", "tabela de preços", "política de check-in"). A tela SHALL mostrá-las junto à sugestão.

#### Scenario: Sugestão de orçamento
- **WHEN** a sugestão responde um pedido de reserva
- **THEN** a tela mostra algo como "Usou: disponibilidade 9–12 out · tabela de preços"

### Requirement: Nunca enviada sem ação humana
A sugestão MUST NOT ser enviada ao hóspede automaticamente. Usar a sugestão SHALL apenas copiar o texto para o campo de resposta, e o envio SHALL exigir o clique em Enviar.

#### Scenario: Usar e editar
- **WHEN** a recepção clica em Usar e editar
- **THEN** o texto vai para o campo de resposta com o foco no primeiro trecho a completar, e nada é enviado

### Requirement: Descartar
A recepção SHALL poder descartar a sugestão. A sugestão descartada MUST NOT voltar a aparecer para a mesma mensagem do hóspede.

#### Scenario: Descartar e reabrir
- **WHEN** a recepção descarta a sugestão e reabre a conversa sem mensagem nova do hóspede
- **THEN** a sugestão não aparece de novo

### Requirement: Trechos a completar impedem o envio
Enquanto o texto a enviar contiver algum trecho a completar da sugestão usada, o envio SHALL ser bloqueado na tela com "Complete os trechos marcados antes de enviar" e recusado pelo backend com 422.

#### Scenario: Esqueceu o trecho
- **WHEN** a recepção tenta enviar o texto com "[confirmar vaga para 2 carros]" ainda presente
- **THEN** o envio é bloqueado e nada sai para o hóspede

### Requirement: Origem da mensagem registrada
Ao enviar, o sistema SHALL registrar se o texto foi a sugestão sem mudanças, a sugestão editada ou escrito do zero. A comparação SHALL ignorar espaços nas pontas e espaços repetidos. A sugestão enviada SHALL ficar marcada como usada.

#### Scenario: Só troca de espaços
- **WHEN** a recepção usa a sugestão e apenas remove um espaço duplo antes de enviar
- **THEN** a mensagem é registrada como sugestão sem mudanças

#### Scenario: Frase acrescentada
- **WHEN** a recepção acrescenta "Café da manhã incluso." antes de enviar
- **THEN** a mensagem é registrada como sugestão editada

### Requirement: Mensagem nova substitui a sugestão
Quando o hóspede envia uma nova mensagem, as sugestões ainda não usadas da conversa SHALL ser marcadas como substituídas, e a próxima abertura SHALL gerar uma sugestão para a mensagem nova.

#### Scenario: Hóspede complementa o pedido
- **WHEN** há uma sugestão na tela e o hóspede envia "somos em 4, na verdade"
- **THEN** a sugestão antiga deixa de valer, e uma nova considera os 4 hóspedes

### Requirement: Regras de resposta aprovadas são aplicadas
As regras de resposta que o gerente aprovou SHALL ser enviadas ao serviço de IA em toda sugestão gerada depois da aprovação. Essas regras MUST NOT se sobrepor aos fatos verificados. Uma regra desfeita MUST deixar de ser aplicada a partir da próxima sugestão gerada.

#### Scenario: Regra do primeiro nome aprovada
- **WHEN** a regra "Chamar o hóspede pelo primeiro nome" está ativa
- **THEN** as novas sugestões tratam o hóspede pelo primeiro nome, quando ele for conhecido

### Requirement: Falha silenciosa
Se a sugestão não puder ser gerada (IA indisponível, tempo esgotado ou sugestão descartada pela validação), o campo de resposta SHALL continuar funcionando normalmente, sem mensagem de erro. Enquanto a geração estiver em andamento, SHALL mostrar apenas um aviso discreto.

#### Scenario: Serviço de IA fora do ar
- **WHEN** a geração da sugestão falha
- **THEN** o aviso "IA escrevendo uma sugestão…" some, e a recepção escreve e envia normalmente
