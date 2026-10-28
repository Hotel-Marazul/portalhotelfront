## ADDED Requirements

### Requirement: Estado de limpeza por quarto
O sistema SHALL guardar, para cada quarto, se está limpo, em limpeza ou precisa limpar.

#### Scenario: Check-out
- **WHEN** uma reserva passa para Concluída
- **THEN** o quarto dela fica "precisa limpar"

#### Scenario: Recepção marca o quarto
- **WHEN** a recepção marca o quarto como pronto ou em limpeza
- **THEN** o estado muda e guarda quem marcou e quando

#### Scenario: Chegada de hoje
- **WHEN** um hóspede chega hoje num quarto que não está pronto
- **THEN** o Hoje mostra o estado do quarto na linha da chegada e um item em "A fazer"
