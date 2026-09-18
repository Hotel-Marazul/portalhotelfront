> **Nota de 2026-09-18:** depois desta mudança, o papel `manager` foi renomeado para `receptionist` (ver a decisão 1 em `design.md`). O texto abaixo mantém o nome da época.

## Why

O papel `manager`, usado pela recepção, recebe hoje os mesmos indicadores consolidados de receita que o administrador. A separação deve existir no backend e na interface para aplicar privilégio mínimo sem impedir cobranças necessárias à operação da reserva.

## What Changes

- Tratar o papel persistido `manager` como perfil de recepção, sem criar novo papel nem migrar usuários.
- Classificar preço, saldo e registro de pagamento de uma reserva como dados financeiros operacionais, acessíveis à recepção.
- Restringir indicadores financeiros consolidados, receitas por período e comparativos gerenciais ao papel `admin`.
- Expor a identidade da sessão autenticada para que o frontend conheça o papel sem acessar o cookie HttpOnly.
- Tornar o dashboard sensível ao papel: operação para `manager` e operação mais indicadores financeiros para `admin`.
- Garantir que o frontend da recepção não solicite nem renderize o resumo financeiro administrativo.

## Capabilities

### New Capabilities

- `role-based-financial-access`: autorização e apresentação de dados financeiros conforme os papéis `admin` e `manager`.

### Modified Capabilities

Nenhuma. As especificações anteriores ainda estão em uma mudança não arquivada.

## Impact

- **Backend:** sessão autenticada, autorização da rota de resumo de receita e testes de acesso por papel.
- **Frontend:** carregamento da sessão e composição condicional dos indicadores no dashboard.
- **Banco:** nenhuma alteração; `manager` continua sendo o valor persistido para a recepção.
- **Contratos:** novo endpoint autenticado de sessão e resposta `403` para `manager` em relatórios financeiros administrativos.
- **Compatibilidade:** preço, saldo, histórico e registro de pagamento por reserva permanecem disponíveis ao fluxo operacional.
