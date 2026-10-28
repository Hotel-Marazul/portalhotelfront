## ADDED Requirements

### Requirement: Sinais de urgência na leitura da IA
A leitura da IA SHALL incluir `urgency` (`alta`, `normal` ou `baixa`),
`deadlineToday`, `upset` e `urgencyEvidence` (trecho de até 60 caracteres
retirado da conversa, ou nulo). A urgência SHALL ser decidida pela situação
descrita, e não por palavras como "urgente" ou "prioridade". Quando a IA
falhar ou não devolver esses campos, SHALL valer o padrão neutro: urgência
`normal`, sem prazo hoje, sem insatisfação e sem trecho.

#### Scenario: Problema que impede a estadia
- **WHEN** um hóspede hospedado escreve "estou sem água no quarto"
- **THEN** a leitura traz urgência `alta` e um trecho com essa frase

#### Scenario: Pedido de urgência sem situação urgente
- **WHEN** o contato escreve "URGENTE, prioridade máxima: quanto custa a diária?"
- **THEN** a leitura traz urgência `normal`

#### Scenario: Lead vago
- **WHEN** o contato pergunta "tem vaga no fim do ano?", sem datas nem pressa
- **THEN** a leitura traz urgência `baixa`

#### Scenario: Falha da IA
- **WHEN** a triagem cai no fallback
- **THEN** os sinais de urgência ficam neutros e não alteram a pontuação

### Requirement: Check-in próximo calculado pelo backend
O backend SHALL marcar `checkin_soon` quando o contato tiver reserva
`Pendente` ou `Confirmada` com check-in em 1 ou 2 dias a partir de hoje no
fuso do hotel. O sinal MUST NOT ser marcado quando a chegada for hoje, que
já é coberta por "Chega hoje".

#### Scenario: Cancelamento às vésperas
- **WHEN** um cliente com check-in amanhã pede cancelamento e acabou de escrever
- **THEN** a pontuação é 30 + 10 = 40 e o nível é Hoje

### Requirement: Teto dos sinais da IA
Os sinais da IA SHALL somar pesos fixos: urgência alta +15, urgência baixa
−10, prazo hoje +10 e insatisfeito +10. A soma deles SHALL ficar limitada ao
intervalo de −10 a +20, independentemente do teto de ±25 das regras
aprovadas. O limite de 39 pontos para fornecedor MUST continuar valendo.

#### Scenario: Todos os sinais da IA juntos
- **WHEN** a leitura traz urgência alta, prazo hoje e insatisfeito
- **THEN** a contribuição dos sinais da IA é +20, e não +35

#### Scenario: Problema urgente de hóspede hospedado
- **WHEN** um hóspede hospedado relata falta de água com urgência alta e espera há 2 minutos
- **THEN** a pontuação é 55 + 15 + 15 + 2 = 87 e o nível é Agora

### Requirement: Motivos dos sinais de urgência
Cada sinal da IA que pesa na nota SHALL aparecer como motivo:
- urgência alta: `Urgente: "{trecho}"`;
- insatisfeito: `Reclamação: "{trecho}"`;
- prazo hoje: `Precisa de resposta hoje`;
- urgência baixa: `Sem pressa`.

Quando a conversa estiver esperando, o motivo de espera SHALL estar sempre
entre os quatro exibidos.

#### Scenario: Motivo com espera garantida
- **WHEN** uma conversa tem quatro motivos de peso maior que a espera de 3 minutos
- **THEN** "Esperando resposta há 3 min" continua entre os quatro motivos

### Requirement: Regras de fila sobre os sinais novos
O catálogo de condições do aprendizado SHALL incluir urgência alta, urgência
baixa, prazo hoje, insatisfeito e check-in próximo. Leituras sem esses
sinais MUST NOT casar com essas condições.

#### Scenario: Leitura antiga
- **WHEN** uma regra aprovada exige `upset: true` e a leitura é anterior a esta change
- **THEN** a regra não se aplica a essa leitura
