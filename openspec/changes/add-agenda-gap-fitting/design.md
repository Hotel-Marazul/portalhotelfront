## Decisões

### O que é brecha
Noites livres entre o fim de uma ocupação e o começo da seguinte, no mesmo quarto, com 1 a 4 noites e inteiras dentro do período visível. Ocupação é reserva no mapa (Cancelada já fica fora) ou manutenção.

### Quem cabe numa brecha
Reserva Pendente ou Confirmada, de outro quarto, com entrada e saída dentro da brecha e pessoas até a capacidade do quarto da brecha. Ela entra se tiver as mesmas datas da brecha ou se estiver hoje num quarto maior, porque mover libera o quarto maior. As de mesmas datas aparecem primeiro.

### Preço ao mover
O hóspede não paga diferente por uma troca que interessa ao hotel. Se o quarto de destino é de outra categoria, o `PUT` leva a diária atual da reserva como `dailyRateOverride`, com o motivo "Diária reservada mantida na troca do quarto X para o Y.". Se é da mesma categoria, só muda o quarto. Desconto, alimentação, hóspedes e `version` seguem como estão.

### Fora desta change
As saídas alternativas do quadro do canvas ("oferecer noites a mais", "antecipar a entrada", "tarifa promocional") não têm ação no sistema e ficam de fora.
