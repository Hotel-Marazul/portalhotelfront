## ADDED Requirements

### Requirement: Brechas e encaixes na Agenda
A Agenda SHALL marcar brechas de 1 a 4 noites entre ocupações do mesmo quarto e SHALL sugerir reservas que cabem nelas.

#### Scenario: Brecha com encaixe
- **WHEN** o 102 está livre por 2 noites entre duas reservas e outra reserva de 2 pessoas, nas mesmas datas, está no 205
- **THEN** a brecha do 102 aparece no mapa e o painel dela sugere mover essa reserva

#### Scenario: Mover mantém a diária
- **WHEN** a recepção confirma "Mover para o 102" e o 102 é de outra categoria
- **THEN** a reserva passa para o 102 com a mesma diária que o hóspede reservou

#### Scenario: Reserva mudou
- **WHEN** a reserva mudou desde que o mapa carregou
- **THEN** o backend recusa pela `version`, a tela mostra a mensagem e o mapa recarrega
