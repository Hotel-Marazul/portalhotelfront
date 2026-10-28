## ADDED Requirements

### Requirement: Gerente cria e edita regras de hóspede adicional
O sistema SHALL permitir que `admin` crie e edite regras de hóspede adicional, e SHALL recusar com 403 os demais papéis.

#### Scenario: Gerente cria regra
- **WHEN** o gerente salva uma regra com nome, faixa de idade, valor e cobrança válidos
- **THEN** a regra aparece em Tarifas e passa a valer nas novas cotações

#### Scenario: Faixa de idade inválida
- **WHEN** a idade máxima é menor que a mínima
- **THEN** o backend responde 400 e a tela mostra a mensagem

#### Scenario: Reservas já criadas
- **WHEN** o valor de uma regra muda
- **THEN** o total das reservas existentes não muda

#### Scenario: Recepção
- **WHEN** a recepção abre Tarifas
- **THEN** não vê "Nova regra" nem "Editar"
