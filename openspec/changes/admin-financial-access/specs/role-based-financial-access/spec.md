## Purpose

Define a separação obrigatória entre dados financeiros operacionais da reserva e indicadores financeiros gerenciais conforme o papel autenticado.

## ADDED Requirements

### Requirement: Identidade da sessão autenticada

O sistema SHALL disponibilizar ao frontend a identidade mínima da sessão autenticada, contendo `id`, `email` e `role`, sem expor o token de acesso.

#### Scenario: Administrador consulta a própria sessão

- **WHEN** uma sessão válida com papel `admin` consulta o endpoint de sessão
- **THEN** o sistema retorna `id`, `email` e `role: admin`
- **AND** a resposta não contém token nem hash de senha

#### Scenario: Recepção consulta a própria sessão

- **WHEN** uma sessão válida com papel `receptionist` consulta o endpoint de sessão
- **THEN** o sistema retorna `role: receptionist`

#### Scenario: Requisição sem sessão válida

- **WHEN** o endpoint de sessão é chamado sem autenticação válida
- **THEN** o sistema retorna `401`
- **AND** não retorna dados de usuário

### Requirement: Relatórios financeiros gerenciais exclusivos do administrador

O sistema MUST autorizar somente usuários com papel `admin` a consultar agregados de receita, recebimentos por período e comparativos financeiros gerenciais.

#### Scenario: Administrador consulta o resumo financeiro

- **WHEN** um usuário autenticado com papel `admin` consulta o resumo financeiro
- **THEN** o sistema retorna os indicadores financeiros autorizados

#### Scenario: Recepção tenta consultar o resumo financeiro diretamente

- **WHEN** um usuário autenticado com papel `receptionist` consulta o resumo financeiro
- **THEN** o sistema retorna `403`
- **AND** não retorna valores financeiros consolidados

### Requirement: Finanças operacionais disponíveis à recepção

O sistema SHALL permitir que `receptionist` consulte preço total, total pago, saldo e lançamentos de uma reserva específica e registre pagamentos permitidos pelas regras operacionais existentes.

#### Scenario: Recepção confere e registra recebimento

- **WHEN** um usuário `receptionist` abre uma reserva autorizada e registra um pagamento válido
- **THEN** o sistema apresenta preço, total pago e saldo da reserva
- **AND** registra o pagamento conforme os controles de saldo e idempotência existentes

#### Scenario: Separação não altera regras de pagamento

- **WHEN** um usuário `receptionist` tenta registrar um pagamento inválido
- **THEN** o sistema aplica as mesmas validações de saldo, status e idempotência usadas antes da separação de perfis

### Requirement: Dashboard composto conforme o papel

O frontend SHALL apresentar a mesma rota de dashboard com conteúdo operacional para `admin` e `receptionist`, acrescentando indicadores financeiros gerenciais somente para `admin`.

#### Scenario: Administrador abre o dashboard

- **WHEN** a sessão atual possui papel `admin`
- **THEN** o dashboard apresenta indicadores operacionais e financeiros gerenciais
- **AND** solicita o resumo financeiro autorizado

#### Scenario: Recepção abre o dashboard

- **WHEN** a sessão atual possui papel `receptionist`
- **THEN** o dashboard apresenta somente indicadores operacionais
- **AND** não solicita o endpoint de resumo financeiro
- **AND** não renderiza receita do dia, receita reservada, recebimentos ou comparativos gerenciais

#### Scenario: Sessão não pode ser validada

- **WHEN** o frontend não consegue validar a sessão atual
- **THEN** não renderiza indicadores financeiros
- **AND** apresenta um estado seguro de sessão inválida ou erro

### Requirement: Falha financeira isolada da visão operacional

O dashboard do administrador SHALL preservar indicadores operacionais já carregados quando somente a consulta financeira falhar.

#### Scenario: Resumo financeiro falha para administrador

- **WHEN** quartos e indicadores operacionais são carregados com sucesso
- **AND** o resumo financeiro falha
- **THEN** o dashboard mantém a visão operacional disponível
- **AND** apresenta erro no contexto financeiro sem substituir valores ausentes por zero enganoso
