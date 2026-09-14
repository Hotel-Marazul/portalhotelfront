## Purpose

Define um ciclo de vida auditável e uma disponibilidade determinística para que reservas concorrentes nunca ocupem o mesmo quarto nem percam seu histórico operacional.

## ADDED Requirements

### Requirement: Intervalo de hospedagem exclusivo na saída
O sistema SHALL tratar toda reserva como o intervalo `[check-in, check-out)`, no qual a data de check-out não ocupa uma nova diária e pode ser o check-in da reserva seguinte.

#### Scenario: Troca de hóspedes no mesmo dia
- **WHEN** uma reserva termina na mesma data e horário operacional em que outra começa no mesmo quarto
- **THEN** o sistema aceita as duas reservas como não sobrepostas

#### Scenario: Intervalo realmente sobreposto
- **WHEN** uma nova reserva ativa intersecta qualquer parte do intervalo de outra reserva ativa do mesmo quarto
- **THEN** o sistema rejeita a operação com conflito de disponibilidade sem alterar dados

### Requirement: Validação de datas da reserva
O sistema MUST aceitar apenas check-in e check-out válidos, com check-out posterior ao check-in e horários operacionais normalizados no fuso do hotel.

#### Scenario: Saída anterior ou igual à entrada
- **WHEN** o cliente envia check-out anterior ou igual ao check-in
- **THEN** o sistema responde com erro de validação e não cria nem altera a reserva

### Requirement: Estados ativos bloqueiam disponibilidade
As reservas `Pendente`, `Confirmada`, `EmAndamento` e `Concluída` SHALL bloquear o quarto no respectivo intervalo, enquanto `Cancelada` SHALL deixar de bloquear disponibilidade sem ser apagada.

#### Scenario: Reutilização após cancelamento
- **WHEN** uma reserva é cancelada e outra reserva válida é solicitada para o mesmo quarto e intervalo
- **THEN** o sistema considera o quarto disponível, preservando a reserva cancelada no histórico

### Requirement: Cancelamento lógico e preservação histórica
O cancelamento MUST alterar o status para `Cancelada` de forma atômica e MUST preservar a reserva, hóspedes, pagamentos, valores, datas e autoria. Nenhuma rota pública ou ferramenta de agente poderá apagar fisicamente uma reserva.

#### Scenario: Cancelar reserva pendente ou confirmada
- **WHEN** um usuário autorizado cancela uma reserva `Pendente` ou `Confirmada` informando um motivo
- **THEN** o sistema registra `Cancelada`, ator, motivo e instante do cancelamento e mantém todos os registros associados

#### Scenario: Cancelar reserva já iniciada ou concluída
- **WHEN** alguém tenta cancelar uma reserva `EmAndamento` ou `Concluída` pelo fluxo comum
- **THEN** o sistema rejeita a transição com conflito e preserva o estado atual

#### Scenario: Consumidor legado solicita exclusão
- **WHEN** um consumidor autenticado usa temporariamente a rota legada de exclusão de reserva
- **THEN** o sistema executa o mesmo cancelamento lógico ou rejeita a transição conforme o estado, sem hard delete

### Requirement: Máquina de estados explícita
O sistema SHALL permitir somente as transições `Pendente → Confirmada`, `Pendente → Cancelada`, `Confirmada → EmAndamento`, `Confirmada → Cancelada` e `EmAndamento → Concluída`. A criação SHALL iniciar em `Pendente`, salvo um fluxo administrativo autenticado que crie diretamente em `Confirmada` e registre a justificativa.

#### Scenario: Avanço válido
- **WHEN** uma reserva segue uma transição permitida e satisfaz as regras de data
- **THEN** o sistema grava o novo status e a autoria em uma única transação

#### Scenario: Salto ou regressão de status
- **WHEN** é solicitada uma transição que pula etapa, reabre estado anterior ou parte de `Cancelada` ou `Concluída`
- **THEN** o sistema responde com conflito e não modifica a reserva

#### Scenario: Início fora da estadia
- **WHEN** é solicitado `EmAndamento` antes do dia de check-in ou após o intervalo da reserva no fuso do hotel
- **THEN** o sistema rejeita a transição e informa a regra temporal violada

### Requirement: Reconciliação de reservas vencidas
O sistema MUST identificar reservas `Pendente` ou `Confirmada` cujo check-out já passou sem alterar seu status silenciosamente, expondo-as como pendências operacionais para decisão humana.

#### Scenario: Reserva vencida detectada
- **WHEN** uma consulta operacional encontra reserva não cancelada nem concluída com check-out anterior ao instante atual
- **THEN** o sistema sinaliza a inconsistência separadamente das reservas ativas

### Requirement: Integridade concorrente no banco
Criação, alteração de quarto ou datas, transição de status, substituição de hóspedes e cancelamento MUST ocorrer em transação atômica, com serialização dos registros envolvidos e uma restrição de banco que impeça sobreposição ativa.

#### Scenario: Duas reservas simultâneas para o mesmo quarto
- **WHEN** duas requisições concorrentes tentam reservar intervalos sobrepostos no mesmo quarto
- **THEN** no máximo uma confirma e a outra recebe conflito de disponibilidade

#### Scenario: Duas alterações simultâneas
- **WHEN** dois atores alteram simultaneamente a mesma reserva a partir da mesma versão
- **THEN** somente uma alteração confirma e a outra recebe conflito de concorrência, sem sobrescrever silenciosamente a primeira

### Requirement: Capacidade do quarto
O total de hóspedes da reserva MUST incluir o hóspede principal e adicionais e MUST ser maior que zero e menor ou igual à capacidade vigente do quarto.

#### Scenario: Consulta por quantidade de hóspedes
- **WHEN** a disponibilidade é consultada para uma quantidade informada de hóspedes
- **THEN** o sistema retorna somente quartos com capacidade suficiente e livres no intervalo

#### Scenario: Criação acima da capacidade
- **WHEN** uma reserva contém mais hóspedes do que a capacidade do quarto
- **THEN** o backend rejeita a operação mesmo que a interface ou o agente tenha indicado disponibilidade

### Requirement: Autoria de mudanças críticas
O sistema MUST registrar ator, instante e motivo quando aplicável para criação, alteração de preço ou datas, transição de status e cancelamento.

#### Scenario: Mutação autenticada
- **WHEN** um usuário ou identidade técnica modifica uma reserva
- **THEN** o histórico permite identificar de forma imutável quem realizou a ação e quando

