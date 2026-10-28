## ADDED Requirements

### Requirement: Operações irreversíveis só para admin
O backend SHALL recusar com 403 o estorno de pagamento e a exclusão de cliente quando o papel não for `admin`.

#### Scenario: Recepção tenta estornar
- **WHEN** a recepção chama `POST /api/reservations/:id/payments/:paymentId/reverse`
- **THEN** a resposta é 403 e nenhum lançamento é criado

#### Scenario: Recepção tenta excluir cliente
- **WHEN** a recepção chama `DELETE /api/client/:id`
- **THEN** a resposta é 403 e o cliente continua no banco

### Requirement: Sem caminho de IA que altere reservas
O backend SHALL NOT expor `/api/agent/*` nem aceitar token de serviço como identidade.

#### Scenario: Token de serviço antigo
- **WHEN** alguém chama `/api/reservations` com `Authorization: Bearer <antigo AGENTS_SERVICE_TOKEN>`
- **THEN** a resposta é 401

### Requirement: Sessão confiável
O backend SHALL aceitar só JWT `HS256` assinado com `JWT_SECRET` e SHALL recusar mutações de origem fora da lista.

#### Scenario: Token com alg none ou segredo errado
- **WHEN** a requisição traz um JWT sem assinatura ou assinado com outro segredo
- **THEN** a resposta é 401

#### Scenario: Mutação de outra origem
- **WHEN** um `POST` traz `Origin: https://evil.example`
- **THEN** a resposta é 403
