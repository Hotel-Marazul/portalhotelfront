## Purpose

Transforma o uso diário (desfechos, correções de posição e edições nas sugestões) em propostas de regra com evidência numérica. Nenhuma regra muda a fila ou as sugestões sem a aprovação do gerente, e toda decisão fica registrada e pode ser desfeita.

## ADDED Requirements

### Requirement: Desfecho por atendimento
A recepção e o gerente SHALL poder marcar o desfecho do atendimento atual como Virou reserva, Não fechou ou Não era lead, e SHALL poder voltar a Em andamento. Marcar um desfecho SHALL fechar o atendimento e registrar quem marcou e quando. Quando não houver atendimento aberto, o desfecho do atendimento mais recente SHALL continuar editável.

#### Scenario: Marcar Virou reserva
- **WHEN** a recepção marca Virou reserva numa conversa
- **THEN** o atendimento é fechado com esse desfecho, autor e horário, e a próxima mensagem do hóspede abre um novo atendimento

#### Scenario: Correção do desfecho
- **WHEN** alguém troca Não fechou por Virou reserva no atendimento mais recente
- **THEN** o desfecho passa a ser Virou reserva, com o novo autor e horário

### Requirement: Correção da posição na fila
Para a leitura atual de uma conversa, cada usuário SHALL poder registrar uma correção: Sim (a posição está certa), Subir ou Descer. A correção SHALL guardar o nível e a posição do momento. Uma nova correção da mesma pessoa para a mesma leitura SHALL substituir a anterior, e a pessoa SHALL poder desfazê-la. A correção MUST NOT mudar a pontuação da conversa na hora.

#### Scenario: Recepção acha que devia subir
- **WHEN** Carla marca Subir numa conversa em 4º lugar no nível Hoje
- **THEN** a correção é registrada com Hoje e 4, a tela confirma "Anotado" com Desfazer, e a posição da conversa não muda

### Requirement: Propostas pelos desfechos
Uma vez por dia, o sistema SHALL comparar a taxa de reserva de cada condição do catálogo fixo de condições com a taxa geral. A comparação SHALL usar os atendimentos de lead com desfecho Virou reserva ou Não fechou dos últimos 90 dias. SHALL propor uma regra de fila de +10 quando a condição tiver pelo menos 8 atendimentos e taxa pelo menos 20 pontos percentuais acima da geral, e de −10 quando estiver pelo menos 20 pontos abaixo. A evidência SHALL citar os números usados.

#### Scenario: Preço sem datas fecha pouco
- **WHEN** em 90 dias há 30 atendimentos de lead com desfecho, 12 viraram reserva (40%), e 8 deles eram pergunta de preço sem datas, dos quais 1 virou reserva (12,5%)
- **THEN** o sistema propõe "Pergunta só de preço, sem datas" com −10 e a evidência "De 8 atendimentos assim, 1 virou reserva (13%), contra 40% no geral."

#### Scenario: Amostra pequena
- **WHEN** uma condição tem 7 atendimentos com desfecho
- **THEN** nenhuma proposta é feita para ela

### Requirement: Propostas pelas correções
Uma vez por dia, o sistema SHALL agrupar as correções dos últimos 30 dias pelas condições do catálogo que casam com a leitura corrigida. SHALL propor +10 quando houver pelo menos 3 pedidos de Subir e eles forem pelo menos o dobro dos de Descer, e −10 no caso inverso. A evidência SHALL citar quantas vezes e por quem.

#### Scenario: Correções repetidas
- **WHEN** em 30 dias Carla marcou Descer 3 vezes em conversas de pergunta de preço sem datas, e ninguém marcou Subir nelas
- **THEN** o sistema propõe −10 para "Pergunta só de preço, sem datas", com a evidência "Corrigido para baixo 3 vezes por Carla"

### Requirement: Propostas pelas edições nas sugestões
Uma vez por dia, com a IA disponível e ao menos 5 envios de sugestão editada nos últimos 30 dias, o sistema SHALL pedir ao serviço de IA padrões repetidos nas edições. SHALL propor como regra de resposta cada padrão com apoio em pelo menos 5 edições, instrução de 10 a 160 caracteres e sem dados de hóspedes. A evidência SHALL deixar claro que a contagem é uma estimativa da IA.

#### Scenario: Café da manhã acrescentado
- **WHEN** a análise das edições encontra "Em orçamentos, dizer que o café da manhã está incluso" em 7 de 9 sugestões de orçamento editadas
- **THEN** o sistema propõe essa regra de resposta com a evidência "Em 7 de 9 sugestões editadas, segundo a leitura da IA."

#### Scenario: Instrução com nome de hóspede
- **WHEN** um padrão devolvido contém o nome de um hóspede presente nas conversas analisadas
- **THEN** o padrão é descartado e não vira proposta

### Requirement: Sem duplicatas nem insistência
Não SHALL existir mais de uma regra proposta ou ativa para a mesma condição ou instrução. Uma condição ou instrução ignorada ou desfeita MUST NOT ser proposta de novo antes de 30 dias.

#### Scenario: Proposta ignorada
- **WHEN** o gerente ignora uma proposta e o job roda no dia seguinte com os mesmos números
- **THEN** a mesma proposta não reaparece

### Requirement: Decisão só do gerente
Aceitar, ignorar e desfazer regras, e pedir um recálculo imediato das propostas, MUST ser permitido somente ao papel `admin`. A recepção SHALL ver propostas e regras, sem os controles de decisão, com a nota "Só o gerente aceita ou desfaz regras." Decisões sobre regras fora do estado esperado SHALL ser recusadas com 409.

#### Scenario: Recepção tenta aceitar
- **WHEN** um usuário `receptionist` chama a rota de aceitar regra
- **THEN** o backend responde 403 e a regra não muda

#### Scenario: Aceitar regra já ativa
- **WHEN** o gerente tenta aceitar uma regra que já está ativa
- **THEN** o backend responde 409

### Requirement: Efeito das decisões
Aceitar ou desfazer uma regra de fila SHALL recalcular a pontuação e os motivos de todas as conversas na fila em até 10 segundos, sem chamar a IA. Uma regra de resposta aceita SHALL entrar nas sugestões geradas depois da decisão. As sugestões já mostradas MUST NOT ser alteradas.

#### Scenario: Regra de fila aceita
- **WHEN** o gerente aceita "Quem já se hospedou antes" (+10)
- **THEN** em até 10 segundos as conversas de hóspedes que já se hospedaram sobem 10 pontos na fila, com o motivo "Regra aprovada: Quem já se hospedou antes"

### Requirement: Limites de peso
Cada regra de fila SHALL valer +10 ou −10, e a soma das regras que casam com uma conversa SHALL ficar limitada a ±25.

#### Scenario: Muitas regras positivas
- **WHEN** quatro regras de +10 casam com a mesma conversa
- **THEN** a contribuição das regras para a pontuação é +25

### Requirement: Auditoria das regras
Proposta, aceite, ignorar e desfazer SHALL ser registrados num histórico que não pode ser alterado nem apagado, com a ação, o autor (ou "sistema") e o instante. Cada regra SHALL guardar quem decidiu e quando.

#### Scenario: Consulta do histórico
- **WHEN** uma regra foi proposta, aceita e depois desfeita
- **THEN** o histórico tem os três eventos, em ordem, com os autores

### Requirement: Página de aprendizado
A página "Aprendizado da IA" SHALL mostrar, para o período escolhido (7 dias, 30 dias ou todo o histórico retido; 30 dias por padrão):
- conversas lidas;
- leads encontrados, com quantos viraram reserva e quantos estão sem desfecho;
- sugestões enviadas, com quantas foram editadas;
- correções na fila;
- por nível inicial, quantos atendimentos houve, quantos viraram reserva e a mediana do tempo até a primeira resposta;
- o destino das sugestões (enviada sem mudar, editada, descartada, sem uso);
- a lista paginada de correções.

As propostas e as regras ativas SHALL aparecer em qualquer período. Os números SHALL vir de contagens diretas sobre os registros e MUST NOT incluir valores financeiros.

#### Scenario: Gerente abre a página
- **WHEN** o gerente abre Aprendizado da IA
- **THEN** vê as propostas com Aceitar e Ignorar, as regras ativas com Desfazer e as métricas dos últimos 30 dias

#### Scenario: Recepção abre a página
- **WHEN** a recepção abre Aprendizado da IA
- **THEN** vê os mesmos dados, sem os botões de decisão

#### Scenario: Período sem dados
- **WHEN** o período escolhido não tem atendimentos
- **THEN** os indicadores mostram zero, e as tabelas mostram "—" em vez de percentuais

### Requirement: Recálculo sob demanda
O gerente SHALL poder pedir o cálculo imediato das propostas, no máximo uma vez a cada 10 minutos. Um novo pedido dentro desse prazo SHALL ser recusado com a indicação de quando será possível pedir de novo.

#### Scenario: Dois pedidos seguidos
- **WHEN** o gerente pede o recálculo duas vezes em 2 minutos
- **THEN** o segundo pedido é recusado, informando quando será possível pedir de novo
