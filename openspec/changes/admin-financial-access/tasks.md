## 1. Contrato e caracterização

- [x] 1.1 Adicionar testes de autorização para a sessão e o resumo financeiro, verificando `401` sem autenticação, `403` para `manager` e sucesso para `admin`.
- [x] 1.2 Registrar em teste de integração que `manager` continua consultando saldo e pagamentos e registrando um pagamento válido de reserva.

## 2. Autorização no backend

- [x] 2.1 Implementar `GET /api/User/me` com autenticação e resposta mínima `id`, `email` e `role`, verificando que token e credenciais não são serializados.
- [x] 2.2 Restringir `/api/reservations/revenue-summary` a `admin` com o middleware de papel existente e verificar que a consulta SQL não executa para `manager`.
- [x] 2.3 Revisar as rotas financeiras atuais e confirmar que apenas preço, saldo, lançamentos e registro de pagamento por reserva permanecem acessíveis a `manager`.

## 3. Dashboard por papel

- [x] 3.1 Carregar a sessão autenticada antes de decidir quais consultas do dashboard executar e tratar `401` sem exibir conteúdo protegido.
- [x] 3.2 Fazer `manager` carregar somente quartos e indicadores operacionais, verificando no navegador que nenhuma requisição ao resumo financeiro é emitida.
- [x] 3.3 Fazer `admin` carregar e renderizar os blocos financeiros na mesma rota, mantendo os rótulos distintos para receita reservada e recebimentos.
- [x] 3.4 Separar loading e erro financeiro dos estados operacionais, verificando que uma falha do resumo financeiro não apaga os indicadores operacionais.
- [x] 3.5 Validar desktop e mobile com contas `admin` e `manager`, confirmando ausência de valores gerenciais para a recepção e manutenção do fluxo de pagamento da reserva.

## Evidência de validação local — 2026-09-14

- Chrome local: `manager` carregou `/api/User/me`, resumo de quartos e indicadores, sem requisitar `revenue-summary` e sem renderizar valores financeiros; `admin` requisitou `revenue-summary` e renderizou `Receita reservada` e `Recebido no mês`.
- Desktop e headless responsivo passaram sem overflow horizontal, sem dados pessoais reais; a largura efetiva reportada pelo Chrome headless foi 500px apesar do parâmetro 390px.
- O fluxo financeiro continua coberto por `backend/tests/integration/reservation-payments.test.ts`, incluindo pagamento parcial, idempotência, saldo e reversão.

## 4. Documentação e validação

- [x] 4.1 Documentar em `.mente/dominio/reservas-regras-negocio.md` que `manager` representa a recepção e distinguir finanças operacionais de indicadores gerenciais.
- [x] 4.2 Atualizar planejamento e inventário de bugs somente se o comportamento entregue alterar o estado documentado do projeto.
- [x] 4.3 Executar testes e build do backend, build do frontend e lint; registrar separadamente qualquer falha preexistente de configuração.
- [x] 4.4 Executar `openspec validate admin-financial-access --strict` e corrigir todos os erros antes da implementação.
