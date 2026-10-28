## ADDED Requirements

### Requirement: Excluir hóspede sem reservas
O sistema SHALL excluir um hóspede apenas quando ele não tiver reservas.

#### Scenario: Hóspede sem reservas
- **WHEN** alguém confirma a exclusão de um hóspede sem reservas
- **THEN** o cadastro some da lista e contatos do WhatsApp ligados a ele ficam sem vínculo

#### Scenario: Hóspede com reservas
- **WHEN** o hóspede tem qualquer reserva, inclusive cancelada
- **THEN** o backend responde 409 e a ficha não mostra o botão Excluir
