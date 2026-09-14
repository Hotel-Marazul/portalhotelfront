## Purpose

Garante que pagamentos de reservas sejam rastreáveis, idempotentes e limitados ao saldo real, sem modificar implicitamente o ciclo operacional da hospedagem.

## ADDED Requirements

### Requirement: Valor monetário válido
O sistema MUST registrar valores monetários com precisão decimal de centavos, na moeda configurada do hotel, e SHALL aceitar somente pagamento positivo para reserva existente e não cancelada.

#### Scenario: Valor inválido
- **WHEN** o valor do pagamento é zero, negativo, não numérico ou possui precisão não suportada
- **THEN** o sistema responde com erro de validação e não grava o pagamento

### Requirement: Limite pelo saldo pendente
Um pagamento positivo MUST ser menor ou igual ao saldo pendente da reserva no instante da transação.

#### Scenario: Pagamento exato do saldo
- **WHEN** o valor é igual ao saldo pendente
- **THEN** o sistema registra o pagamento e retorna saldo zero

#### Scenario: Pagamento acima do saldo
- **WHEN** o valor excede o saldo pendente, inclusive por requisição concorrente
- **THEN** o sistema rejeita a operação com conflito financeiro e preserva os pagamentos existentes

### Requirement: Idempotência no registro de pagamento
Toda solicitação de pagamento MUST possuir uma chave de idempotência estável por tentativa de negócio, e o sistema SHALL garantir unicidade dessa chave no escopo da reserva.

#### Scenario: Repetição da mesma solicitação
- **WHEN** a mesma chave e o mesmo payload são reenviados por duplo clique, timeout ou retentativa
- **THEN** o sistema retorna o pagamento originalmente criado sem lançar uma segunda cobrança

#### Scenario: Reutilização com payload diferente
- **WHEN** uma chave já usada é reenviada com valor, etapa ou método diferentes
- **THEN** o sistema responde com conflito de idempotência e não altera registros

### Requirement: Agregados financeiros autoritativos
Toda leitura detalhada de reserva SHALL retornar preço total, total pago confirmado e saldo pendente calculados pelo backend, sem depender de soma feita pelo navegador ou pelo agente.

#### Scenario: Pagamentos parciais
- **WHEN** a reserva possui um ou mais pagamentos válidos abaixo do total
- **THEN** a resposta apresenta total pago somado e saldo pendente não negativo

### Requirement: Pagamento não altera status operacional implicitamente
A etapa ou o método de um pagamento MUST ser informativo e MUST NOT promover a reserva para `Confirmada`, `EmAndamento` ou `Concluída` sem uma solicitação explícita de transição que satisfaça a máquina de estados.

#### Scenario: Pagamento no check-in
- **WHEN** um pagamento é registrado com etapa `CheckIn`
- **THEN** o pagamento é gravado, mas o status da reserva permanece inalterado

### Requirement: Histórico financeiro imutável
Pagamentos confirmados MUST NOT ser editados ou apagados fisicamente. Uma correção financeira SHALL ser representada por lançamento compensatório autenticado, relacionado ao original e acompanhado de motivo. A API recebe a correção como valor positivo, mas grava o lançamento `reversal` com valor negativo para que o agregado financeiro seja a soma dos lançamentos.

#### Scenario: Corrigir pagamento lançado incorretamente
- **WHEN** um usuário autorizado informa que um pagamento confirmado está incorreto
- **THEN** o sistema mantém o original e registra uma compensação com ator, instante e motivo

### Requirement: Dados financeiros legados inconsistentes
Pagamentos existentes acima do total da reserva MUST ser reportados para correção humana e MUST NOT ser removidos, truncados ou redistribuídos automaticamente durante a migração.

#### Scenario: Reserva legada com excesso pago
- **WHEN** a verificação de migração encontra total pago superior ao preço da reserva
- **THEN** a reserva aparece em relatório de exceções com diferença calculada e permanece inalterada até decisão autorizada

