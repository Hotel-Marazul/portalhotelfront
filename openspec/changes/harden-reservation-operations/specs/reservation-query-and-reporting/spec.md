## Purpose

Padroniza datas, filtros e indicadores de reservas para que a operação enxergue os mesmos dias, ocupação e valores em todos os serviços e ambientes.

## ADDED Requirements

### Requirement: Fuso horário oficial do hotel
O sistema SHALL usar `America/Sao_Paulo` para interpretar datas civis, horários operacionais e limites de dia ou mês, persistindo instantes equivalentes em UTC.

#### Scenario: Conversão do check-in e check-out
- **WHEN** uma reserva é criada para datas civis informadas pelo usuário
- **THEN** check-in e check-out representam os horários operacionais dessas datas em `America/Sao_Paulo`, independentemente do fuso do container

#### Scenario: Mudança de ambiente
- **WHEN** backend e banco executam em ambientes com fusos de sistema diferentes
- **THEN** a mesma entrada produz os mesmos instantes e os mesmos resultados de disponibilidade

### Requirement: Migração segura de timestamps existentes
Antes de qualquer correção de timestamps legados, o sistema MUST produzir uma simulação com valores atuais, valores propostos e reservas afetadas; a alteração real MUST exigir aprovação explícita e backup verificável.

#### Scenario: Auditoria sem mutação
- **WHEN** a etapa de diagnóstico da migração é executada
- **THEN** nenhuma reserva é alterada e um relatório reproduzível mostra o deslocamento proposto

### Requirement: Validação das consultas de reserva
Parâmetros de filtro MUST ser validados quanto a tipo, formato, valores aceitos e limites antes da consulta ao banco. Entrada inválida SHALL produzir resposta 400 estruturada, nunca erro interno 500.

#### Scenario: Identificador de quarto inválido
- **WHEN** `roomId` não é um identificador válido
- **THEN** a API responde 400 com indicação do campo inválido

#### Scenario: Status desconhecido
- **WHEN** um filtro contém status fora da lista suportada
- **THEN** a API responde 400 sem consultar usando o valor inválido

### Requirement: Filtros por data civil inclusivos
Filtros “de” e “até” SHALL incluir integralmente as datas civis selecionadas no fuso do hotel. Limites superiores MUST usar o início exclusivo do dia seguinte ou semântica equivalente.

#### Scenario: Check-in até uma data
- **WHEN** o usuário filtra check-ins até 7 de setembro
- **THEN** todas as reservas com check-in em qualquer horário civil de 7 de setembro são incluídas

#### Scenario: Intervalo de datas
- **WHEN** o usuário informa limites inicial e final válidos
- **THEN** os resultados respeitam ambos os limites sem perder registros do último dia

### Requirement: Paginação estável
Listagens de reservas e clientes usadas pelo fluxo de reserva SHALL oferecer paginação e busca no servidor, com ordenação determinística e metadados de total.

#### Scenario: Cliente fora da primeira página
- **WHEN** o operador pesquisa um cliente que não está nos primeiros cem registros
- **THEN** a busca retorna o cliente sem carregar toda a base no navegador

### Requirement: Indicadores operacionais excluem canceladas
Contagens de check-in, check-out, ocupação e reservas ativas MUST excluir reservas canceladas e MUST separar pendências vencidas de estadias realmente ativas.

#### Scenario: Reserva cancelada no dia
- **WHEN** existe uma reserva cancelada com check-in ou check-out no dia consultado
- **THEN** ela não aumenta os indicadores operacionais desse dia

#### Scenario: Pendente vencida
- **WHEN** uma reserva pendente já ultrapassou o check-out
- **THEN** ela aparece como exceção operacional e não como reserva ativa atual

### Requirement: Ocupação calculada por noites civis
A ocupação SHALL usar a interseção de noites civis reservadas com o período consultado, respeitando check-out exclusivo, e MUST NOT derivar noites pela divisão cega de segundos por 86.400.

#### Scenario: Reserva de seis noites
- **WHEN** uma reserva ocupa seis noites civis e possui horários operacionais de entrada e saída distintos
- **THEN** o numerador da ocupação acrescenta exatamente seis quarto-noites

### Requirement: Métricas financeiras semanticamente separadas
O sistema SHALL expor separadamente `receita reservada`, baseada no valor das reservas não canceladas conforme período definido, e `recebimentos`, baseada em pagamentos confirmados conforme data de pagamento. Cada indicador MUST declarar período e critério.

#### Scenario: Reserva sem pagamento
- **WHEN** uma reserva não cancelada possui preço total mas nenhum pagamento
- **THEN** seu valor pode compor receita reservada, mas não recebimentos

#### Scenario: Pagamento de reserva antiga
- **WHEN** um pagamento ocorre no período atual para reserva criada anteriormente
- **THEN** ele compõe recebimentos do período atual conforme a data do pagamento

