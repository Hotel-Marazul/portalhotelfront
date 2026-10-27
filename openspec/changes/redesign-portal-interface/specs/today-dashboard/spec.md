## ADDED Requirements

### Requirement: Indicadores do Hoje para a recepção
O Hoje SHALL abrir com a saudação, a data no fuso do hotel e uma linha de
indicadores sem cartões:
- chegadas do dia, com quantas já fizeram check-in;
- saídas do dia, com quantas já foram feitas;
- hospedados, com o total de pessoas;
- conversas aguardando no WhatsApp.

Os valores SHALL vir de `counter-summary`, `rooms/summary`,
`whatsapp/queue/count` e de `GET /reservations` com as datas de hoje (para
os check-ins e check-outs já feitos e o total de pessoas).

#### Scenario: Dia com movimento
- **WHEN** há 7 entradas e 5 saídas hoje, 2 delas concluídas
- **THEN** os indicadores mostram "Chegadas 7" e "Saídas 5 · 2 feitas"

### Requirement: Movimento de hoje
O Hoje SHALL ter uma tabela com abas Chegadas, Saídas e Hospedados. Cada
linha SHALL mostrar:
- o horário padrão de entrada (14:00) ou de saída (12:00). Hora combinada
  com o hóspede fica para uma change futura;
- hóspede e número de pessoas;
- quarto;
- a ação do próximo passo: Check-in, Check-out ou Abrir.

A ação SHALL usar a mesma rota de `transitions` que a reserva aberta usa.
Uma saída já concluída SHALL aparecer esmaecida.

#### Scenario: Fazer check-in pela linha
- **WHEN** a recepção clica em Check-in na linha da Júlia Menezes
- **THEN** a reserva passa a `EmAndamento` pela rota de `transitions`, e a linha vai para a aba Hospedados

#### Scenario: Saída concluída
- **WHEN** uma reserva com saída hoje já está `Concluída`
- **THEN** a linha aparece esmaecida na aba Saídas, com a ação Abrir

### Requirement: Lista "A fazer"
O Hoje SHALL ter uma lista curta "A fazer", com no máximo quatro itens e o
link "Ver todas". A lista SHALL ser feita só de fontes que já existem:
- pendências vencidas de `counter-summary`;
- conversas do WhatsApp em nível Agora, de `GET /whatsapp/queue`;
- quartos em manutenção.

Cada item SHALL levar à tela onde se resolve.

#### Scenario: Conversa urgente
- **WHEN** há 2 conversas em nível Agora na fila
- **THEN** "A fazer" mostra "2 conversas no WhatsApp para responder agora", com link para a fila

### Requirement: Gestão para o gerente
A Gestão SHALL mostrar, só para `admin`:
- receita do mês atual, comparada com o mês anterior;
- valor recebido no mês;
- valor a receber (receita menos recebido);
- ocupação dos últimos 6 meses.

Os números SHALL vir de `revenue-summary` e de `counter-summary`.
Indicadores que dependem de dado novo (diária média, RevPAR, por categoria,
já reservado, ano anterior e meta) MUST NOT aparecer nesta change.

#### Scenario: Gerente abre a Gestão
- **WHEN** o gerente abre a Gestão com receita de R$ 96.400 no mês e R$ 88.900 no anterior
- **THEN** a tela mostra R$ 96,4 mil com "+8,4% vs mês anterior"

#### Scenario: Recepção tenta abrir a Gestão
- **WHEN** uma usuária `receptionist` acessa `/gestao`
- **THEN** ela é levada a `/dashboard`, e `revenue-summary` não é chamada
