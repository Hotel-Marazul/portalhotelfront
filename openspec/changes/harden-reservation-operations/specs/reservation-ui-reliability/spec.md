## Purpose

Mantém a interface de reservas segura, compreensível e utilizável mesmo diante de falhas de rede, grandes volumes de clientes ou atualizações concorrentes.

## ADDED Requirements

### Requirement: Disponibilidade falha de forma fechada
A interface MUST oferecer para seleção somente quartos confirmados como disponíveis pelo backend para o intervalo e a quantidade de hóspedes atuais.

#### Scenario: Falha na consulta de disponibilidade
- **WHEN** a consulta falha por rede, autenticação ou erro do servidor
- **THEN** a interface limpa a seleção inválida, não substitui o resultado pela lista completa de quartos e oferece uma ação de tentar novamente

#### Scenario: Datas ou quantidade mudam
- **WHEN** o usuário altera datas ou quantidade de hóspedes
- **THEN** a seleção anterior é revalidada antes de permitir envio

### Requirement: Erros acionáveis de reserva
A interface SHALL diferenciar erro de validação, conflito de disponibilidade, conflito concorrente, falha de autenticação e indisponibilidade de rede, preservando os dados seguros do formulário para correção ou nova tentativa.

#### Scenario: Quarto reservado por outra pessoa
- **WHEN** a criação recebe conflito porque o quarto deixou de estar disponível
- **THEN** a interface informa o conflito, mantém os demais campos e solicita nova seleção de quarto

### Requirement: Busca completa de clientes
O seletor de cliente SHALL pesquisar e paginar no servidor, sem limitar silenciosamente a seleção aos primeiros cem registros.

#### Scenario: Pesquisa por nome ou documento mascarado
- **WHEN** o operador digita um termo de busca
- **THEN** a interface apresenta resultados paginados e ordenados retornados pelo backend

### Requirement: Resumo financeiro autoritativo
O detalhe da reserva SHALL exibir preço total, total pago e saldo pendente retornados pelo backend, atualizar esses valores após pagamento e indicar quando a reserva possui exceção financeira.

#### Scenario: Pagamento parcial concluído
- **WHEN** um pagamento parcial é aceito
- **THEN** a interface mantém o detalhe aberto e atualiza total pago, saldo e histórico sem exigir recarregamento manual

#### Scenario: Pagamento acima do saldo
- **WHEN** o backend rejeita um valor acima do saldo
- **THEN** a interface mostra a mensagem financeira específica e não apresenta o pagamento como concluído

### Requirement: Prevenção de envio duplicado
Botões de criação, atualização, cancelamento e pagamento MUST impedir submissões simultâneas na mesma tela e SHALL reutilizar a chave idempotente durante retentativas da mesma intenção.

#### Scenario: Duplo clique em pagamento
- **WHEN** o operador aciona o pagamento repetidamente enquanto a primeira requisição está em andamento
- **THEN** somente uma intenção de pagamento é processada e o controle permanece indisponível até a resposta

### Requirement: Privacidade nas coleções
Listas, agendas, buscas e mensagens de erro MUST NOT exibir CPF completo. O detalhe completo, quando indispensável, SHALL ser restrito por papel e ação explícita.

#### Scenario: Agenda de reservas
- **WHEN** o operador visualiza a agenda ou lista de reservas
- **THEN** nomes e identificadores suficientes para operação são exibidos sem revelar CPF completo

### Requirement: Representação temporal consistente
Agenda, lista, formulários e detalhes SHALL usar as mesmas datas civis no fuso do hotel e SHALL representar a barra da reserva terminando no check-out exclusivo.

#### Scenario: Reserva com saída em 7 de setembro
- **WHEN** a reserva é exibida na agenda
- **THEN** a ocupação visual termina no limite inicial de 7 de setembro e não ocupa a noite seguinte

### Requirement: Estados completos da interface
Cada consulta de reservas, clientes, disponibilidade e pagamentos MUST possuir estados distinguíveis de carregamento, vazio, erro e sem permissão, sem apresentar dado antigo como resultado atual.

#### Scenario: Sessão expirada
- **WHEN** uma consulta retorna falha de autenticação
- **THEN** a interface não interpreta o resultado como lista vazia e conduz o usuário ao fluxo de autenticação apropriado

