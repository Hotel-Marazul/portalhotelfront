## Purpose

Impede que o serviço conversacional execute operações de reserva sem identidade, confirmação humana ou validação determinística do backend.

## ADDED Requirements

### Requirement: Autenticação do serviço de agentes
Endpoints capazes de consultar dados operacionais ou iniciar fluxos de reserva MUST exigir autenticação válida e SHALL responder 401 sem credencial e 403 quando a identidade não possuir a permissão necessária.

#### Scenario: Chat sem autenticação
- **WHEN** uma requisição acessa o chat ou ferramentas operacionais sem credencial válida
- **THEN** o serviço rejeita a requisição antes de processar conteúdo ou chamar o backend

### Requirement: Identidade técnica de privilégio mínimo
Chamadas do serviço de agentes ao backend MUST usar uma identidade técnica autenticada, distinta de usuário humano, limitada às operações necessárias e registrada na auditoria.

#### Scenario: Credencial técnica inválida
- **WHEN** o agente chama o backend com credencial ausente, expirada ou inválida
- **THEN** a operação falha sem fallback anônimo e sem mutação

#### Scenario: Operação fora do escopo
- **WHEN** a identidade técnica tenta acessar uma função não autorizada
- **THEN** o backend responde 403 e registra o evento de segurança sem conteúdo sensível

### Requirement: Confirmação humana antes de mutações
Criação, alteração e cancelamento solicitados por conversa MUST permanecer em estado de proposta até que o usuário confirme explicitamente um resumo contendo ação, reserva quando existente, quarto, hóspede principal identificado de forma minimizada, datas, quantidade total de hóspedes e preço calculado pelo backend quando aplicável.

#### Scenario: Proposta sem confirmação
- **WHEN** o usuário fornece todos os dados necessários mas ainda não confirma o resumo final
- **THEN** o agente não chama nenhuma operação de escrita do backend

#### Scenario: Confirmação válida
- **WHEN** o usuário confirma explicitamente uma proposta ainda válida e inalterada
- **THEN** o agente envia uma única mutação idempotente ao backend e relata o resultado real

#### Scenario: Dados mudam após o resumo
- **WHEN** datas, quarto, hóspedes, preço ou disponibilidade mudam depois da apresentação do resumo
- **THEN** a confirmação anterior é invalidada e um novo resumo precisa ser confirmado

### Requirement: Backend permanece fonte de verdade
O agente MUST obter disponibilidade, capacidade, preço, saldo, status e resultado de mutações exclusivamente pela API autenticada do backend e MUST NOT acessar o PostgreSQL diretamente nem inventar valores quando a API falhar.

#### Scenario: Backend indisponível
- **WHEN** o backend não responde ou retorna erro
- **THEN** o agente informa que não conseguiu confirmar a operação e não declara reserva criada, alterada ou cancelada

### Requirement: Contrato completo de hóspedes
A quantidade total de hóspedes informada na conversa MUST ser enviada à consulta de disponibilidade. Antes da criação, o fluxo MUST obter os dados mínimos exigidos de cada hóspede que impacta capacidade ou preço e apresentar o preço recalculado.

#### Scenario: Grupo acima da capacidade
- **WHEN** o usuário solicita hospedagem para mais pessoas do que a capacidade do quarto
- **THEN** o quarto não é oferecido nem reservado

#### Scenario: Quantidade sem dados adicionais
- **WHEN** a quantidade indica hóspedes adicionais mas seus dados obrigatórios ainda não foram fornecidos
- **THEN** o agente solicita os dados faltantes e não cria a reserva

### Requirement: Cancelamento do agente preserva histórico
Uma solicitação de cancelamento confirmada no chat SHALL usar o contrato de cancelamento lógico e MUST NOT chamar qualquer operação de hard delete.

#### Scenario: Cancelamento confirmado no chat
- **WHEN** o usuário confirma o cancelamento de uma reserva elegível
- **THEN** o agente solicita a transição para `Cancelada` e informa o status retornado pelo backend

### Requirement: Minimização de dados sensíveis
Prompts, respostas de modelo e logs do serviço de agentes MUST NOT conter CPF completo, dados de pagamento, cookies, tokens, chaves ou credenciais. Identificadores pessoais exibidos SHALL ser mascarados quando não forem essenciais.

#### Scenario: Erro de integração
- **WHEN** ocorre erro em uma chamada que continha cabeçalhos de autenticação ou dados do hóspede
- **THEN** o log preserva contexto técnico suficiente sem registrar segredos nem dados pessoais completos

