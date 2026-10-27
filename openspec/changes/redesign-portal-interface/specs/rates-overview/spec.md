## ADDED Requirements

### Requirement: Diária de casal por categoria
A tela Categorias e tarifas SHALL mostrar uma tabela com:
- cada categoria;
- as unidades com seus números;
- a capacidade, inclusive as exceções (102 para 2; 115/116 para até 5);
- a diária de casal com só café;
- a diária de casal com meia pensão.

Os dados SHALL vir de `GET /categories` e da rota de quartos atual. Editar uma
categoria SHALL usar o formulário e a rota atuais, com o visual novo.

#### Scenario: Temporada de verão
- **WHEN** as quatro categorias têm tarifa de verão cadastrada
- **THEN** a tabela mostra Super Luxo R$ 528 / R$ 638, Luxo R$ 495 / R$ 605, Standard R$ 473 / R$ 583 e Simples R$ 440 / R$ 550

### Requirement: Regras de hóspede adicional
A tela SHALL listar as regras de `pricing-rules` por faixa de idade, com o
valor e a base de cobrança (por hospedagem ou por diária). A tela SHALL
dizer que as duas primeiras pessoas já estão na tarifa de casal.

#### Scenario: Criança de 4 anos
- **WHEN** a regra de 3 a 5 anos cobra R$ 100 por hospedagem
- **THEN** a linha mostra "3 a 5 anos · Uma vez por hospedagem · R$ 100"

### Requirement: Validade da temporada
A tela SHALL mostrar a validade das tarifas (`rate_valid_from` e
`rate_valid_until`) numa faixa de meses, com o dia de hoje marcado. Quando
hoje estiver fora da validade, a tela SHALL avisar que essas categorias não
têm preço no período e que a reserva pede diária manual, conforme
`SUMMER-TARIFFS.md`.

#### Scenario: Antes do verão
- **WHEN** hoje é 27 out 2026 e a validade é de 1 dez 2026 a 1 mar 2027 (fim exclusivo)
- **THEN** a faixa mostra o verão de 1 dez a 28 fev e o aviso "Até 30 nov e a partir de 1 mar não há tarifa para estas categorias"

### Requirement: Entrada, saída e estadia mínima
A tela SHALL mostrar a hora de entrada (14:00), a hora de saída (12:00) e a
estadia mínima ("Nenhuma"). Nenhuma API expõe esses valores: eles ficam
numa constante do frontend, igual a `HOTEL_CHECK_IN_HOUR` e
`HOTEL_CHECK_OUT_HOUR` de `backend/src/utils/reservation.ts`.

#### Scenario: Leitura dos horários
- **WHEN** a recepção abre Categorias e tarifas
- **THEN** vê "Entrada 14:00", "Saída 12:00" e "Estadia mínima: Nenhuma"
