## Why

O fluxo de reservas já impede sobreposição no PostgreSQL, mas a auditoria encontrou falhas graves ao redor dessa proteção: cancelamentos apagam o histórico, pagamentos podem exceder o saldo, status podem saltar livremente, datas dependem do fuso do container, filtros retornam erro interno ou excluem o dia selecionado e o serviço de agentes pode executar mutações sem autenticação nem confirmação. Essas inconsistências ameaçam o histórico financeiro e operacional e precisam ser corrigidas antes de ampliar o uso do sistema.

## What Changes

- Transformar cancelamento em transição lógica para `Cancelada`, preservando reserva, hóspedes, pagamentos e autoria; remover o hard delete do fluxo público.
- Formalizar a máquina de estados da reserva e serializar alterações concorrentes, mantendo a exclusão de sobreposição no banco como última barreira contra overbooking.
- Tornar pagamentos limitados ao saldo, idempotentes e independentes de mudanças implícitas de status; expor total pago e saldo pendente.
- Definir `America/Sao_Paulo` como fuso do hotel para datas civis, filtros e indicadores, mantendo instantes persistidos em UTC.
- Corrigir consultas, disponibilidade por capacidade e indicadores para usar semântica de intervalo `[check-in, check-out)` e ignorar canceladas quando apropriado.
- Proteger o serviço de agentes com autenticação, identidade técnica de privilégio mínimo e confirmação explícita antes de qualquer criação, alteração ou cancelamento.
- Fazer a interface falhar de forma segura quando a disponibilidade não puder ser consultada, permitir busca paginada de clientes e apresentar saldo e erros financeiros de forma clara.
- Reduzir exposição de CPF em coleções e registrar o ator responsável por mudanças críticas.
- Atualizar dependências vulneráveis dentro de versões compatíveis e ampliar os testes de unidade, integração e ponta a ponta do domínio de reservas.

## Capabilities

### New Capabilities

- `reservation-lifecycle-and-availability`: ciclo de vida, cancelamento lógico, concorrência, capacidade, disponibilidade e trilha de autoria das reservas.
- `reservation-payments`: registro financeiro idempotente, limites de saldo, agregados e relação explícita entre pagamento e status.
- `reservation-query-and-reporting`: datas no fuso do hotel, filtros válidos e indicadores operacionais/financeiros semanticamente corretos.
- `agent-booking-safety`: autenticação do serviço de agentes, identidade técnica, confirmação humana e contratos seguros de hóspedes.
- `reservation-ui-reliability`: comportamento seguro da interface diante de indisponibilidade, grandes cadastros, pagamentos e dados pessoais.

### Modified Capabilities

Nenhuma. Este é o primeiro conjunto de especificações OpenSpec do projeto.

## Impact

- **Backend:** contratos e schemas de reservas, pagamentos, disponibilidade, clientes e relatórios; transações, bloqueios, auditoria e inicialização/migração do PostgreSQL.
- **Banco:** evolução aditiva de metadados de auditoria/idempotência e revisão explícita dos timestamps legados; nenhuma correção destrutiva será automática.
- **Frontend:** agenda/lista, modal de nova reserva, drawer de detalhes/pagamentos, busca de clientes e tratamento de erro.
- **Agents:** autenticação FastAPI, estado de confirmação, cliente HTTP do backend e payloads de reserva/hóspedes.
- **Operação:** variáveis de ambiente, Docker Compose, atualização controlada de dependências e observabilidade sem dados sensíveis.
- **Compatibilidade:** novas rotas usarão kebab-case; consumidores legados terão adaptação temporária sem manter exclusão física de reservas.

