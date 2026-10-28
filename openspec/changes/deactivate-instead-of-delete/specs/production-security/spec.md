## MODIFIED Requirements

### Requirement: Operações irreversíveis só para admin
O backend SHALL recusar com 403 o estorno de pagamento e a desativação ou reativação de hóspede, quarto e categoria quando o papel não for `admin`.

#### Scenario: Recepção tenta estornar
- **WHEN** a recepção chama `POST /api/reservations/:id/payments/:paymentId/reverse`
- **THEN** a resposta é 403 e nenhum lançamento é criado

#### Scenario: Recepção tenta excluir cliente
- **WHEN** a recepção chama `DELETE /api/client/:id` ou `POST /api/clients/:id/deactivate`
- **THEN** a resposta é 403 e o hóspede continua ativo
