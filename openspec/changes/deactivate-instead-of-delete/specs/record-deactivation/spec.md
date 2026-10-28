## ADDED Requirements

### Requirement: Desativar em vez de excluir
O backend SHALL NOT apagar linhas de `clients`, `rooms` ou `categories`. Excluir SHALL marcar o registro como desativado, guardando quem e quando.

#### Scenario: Gerente desativa um quarto com estadias antigas
- **WHEN** o admin chama `POST /api/rooms/:id/deactivate` para um quarto que só tem reservas encerradas
- **THEN** a resposta é 200, o quarto fica com `active = false` e as reservas antigas continuam lendo o número do quarto

#### Scenario: Rota legada
- **WHEN** o admin chama `DELETE /api/client/:id`
- **THEN** a resposta é 204 e o hóspede continua no banco, desativado

### Requirement: Só sem compromisso futuro
O backend SHALL recusar com 409 desativar hóspede com reserva futura ou em casa, quarto com reserva futura ativa e categoria com quarto ativo.

#### Scenario: Hóspede com reserva futura
- **WHEN** o admin tenta desativar um hóspede que tem reserva confirmada para o mês que vem
- **THEN** a resposta é 409 e o hóspede continua ativo

### Requirement: Desativado não é oferecido
Um item desativado SHALL sumir de disponibilidade, listas de escolha, busca de hóspede, vínculo de contato e dos preços e disponibilidade da IA. Cotação e criação de reserva com ele SHALL responder 400.

#### Scenario: Quarto desativado na disponibilidade
- **WHEN** a recepção consulta `/api/rooms/availability` para datas livres
- **THEN** o quarto desativado não aparece

#### Scenario: Categoria desativada na IA
- **WHEN** a IA monta os fatos da conversa
- **THEN** `prices` e `availability` não trazem a categoria desativada

#### Scenario: Reserva com hóspede desativado
- **WHEN** alguém cota ou cria reserva para um hóspede desativado
- **THEN** a resposta é 400

### Requirement: Reativar
O admin SHALL ver os desativados com `includeInactive=true` e SHALL poder reativá-los. Cadastrar um CPF, número de quarto ou nome de categoria de um registro desativado SHALL responder 409 com o id dele.

#### Scenario: Recadastro de CPF desativado
- **WHEN** o admin cadastra um hóspede com o CPF de um hóspede desativado
- **THEN** a resposta é 409 com `details.code = "inactive_duplicate"` e `details.id` do desativado, e `POST /api/clients/:id/reactivate` o devolve às listas
