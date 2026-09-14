## Context

Consulte `proposal.md` para a motivação. O banco e o JWT reconhecem apenas `admin` e `manager`; na operação atual, `manager` corresponde à recepção. O cookie de autenticação é HttpOnly, portanto o frontend não deve tentar decodificá-lo. A rota `/api/reservations/revenue-summary` entrega receita reservada e recebimentos consolidados sem restrição de papel, enquanto o dashboard sempre a consulta e renderiza.

A recepção ainda precisa consultar preço total, valor pago e saldo da reserva e registrar recebimentos. Esses dados são operacionais e não devem ser confundidos com relatórios consolidados de gestão.

## Goals / Non-Goals

**Goals:**

- Fazer o backend ser a fronteira real de autorização financeira.
- Reutilizar os papéis existentes sem migração de dados.
- Manter intacto o fluxo operacional de cobrança por reserva.
- Evitar que o dashboard de recepção solicite ou apresente agregados financeiros.
- Preservar indicadores operacionais quando o bloco financeiro do administrador falhar.

**Non-Goals:**

- Criar o papel `receptionist`, cadastro de usuários ou matriz genérica de permissões.
- Criar uma página financeira separada, DRE, fechamento de caixa ou exportação.
- Restringir preço de diária, cotação, saldo ou pagamentos da reserva.
- Alterar regras de cálculo, pagamento, estorno ou persistência financeira.
- Usar middleware do Next.js como fronteira de autorização.

## Decisions

### 1. `manager` continuará sendo o perfil técnico da recepção

A interface poderá rotular esse papel como recepção, mas o valor persistido, o JWT e os tipos continuarão usando `manager`. Isso evita migração de banco, invalidação de sessões e alterações coordenadas desnecessárias.

Alternativa considerada: adicionar `receptionist`. Rejeitada porque não existe hoje um terceiro conjunto de permissões que justifique o custo da migração.

### 2. O acesso será separado por natureza do dado, não pela presença de valores monetários

`manager` continuará acessando preço, saldo, pagamentos e ações de recebimento ligados a uma reserva específica. Somente agregados de receita, recebimentos por período e comparativos gerenciais serão exclusivos de `admin`.

Alternativa considerada: remover todo valor monetário da recepção. Rejeitada porque impediria cotação, conferência de saldo e recebimento no balcão.

### 3. O backend negará o resumo gerencial com `403`

A rota de resumo financeiro usará a autorização de papel já existente. Ocultar cartões no frontend será apenas uma medida de experiência e redução de exposição, nunca o controle de segurança.

Alternativa considerada: retornar zeros para `manager`. Rejeitada porque mascara falta de permissão e mantém um contrato ambíguo.

### 4. Um endpoint autenticado informará a sessão atual

Será adicionado `GET /api/User/me`, protegido pelo middleware de autenticação, retornando somente `id`, `email` e `role`. O frontend usará esse contrato em vez de ler ou copiar o token.

Alternativa considerada: salvar o papel em `localStorage` após o login. Rejeitada porque cria estado duplicado e manipulável que pode divergir da sessão HttpOnly.

### 5. O dashboard carregará operação e finanças separadamente

Após conhecer o papel, o dashboard sempre carregará quartos e indicadores operacionais. Apenas `admin` fará a requisição do resumo financeiro e renderizará receita do dia, receita reservada e recebido no mês. Falha financeira exibirá estado próprio sem apagar os dados operacionais já carregados.

Alternativa considerada: duplicar a página em uma rota administrativa. Rejeitada porque repetiria toda a visão operacional e aumentaria o risco de divergência.

### 6. O escopo será validado com teste de autorização e smoke da interface

Um teste automatizado do backend provará que `manager` recebe `403` e `admin` mantém acesso. A interface será verificada em ambos os papéis, incluindo ausência da chamada financeira na sessão de recepção. Não será introduzido um novo framework de testes de componentes apenas para esta mudança.

## Risks / Trade-offs

- **[O nome técnico `manager` difere do nome de negócio]** → documentar a equivalência e usar “Recepção” apenas como rótulo de interface.
- **[Novos relatórios podem nascer sem proteção]** → classificar cada novo endpoint financeiro e aplicar autorização no backend antes da UI.
- **[Sessão expira durante o dashboard]** → tratar `401` como sessão inválida e não renderizar dados protegidos.
- **[Mudança concorrente no OpenSpec de reservas]** → manter esta mudança limitada a autorização e apresentação, sem reescrever contratos de cálculo ou pagamento.
- **[Falha parcial do resumo financeiro]** → manter a visão operacional disponível e mostrar erro apenas no bloco administrativo.

## Migration Plan

1. Publicar o backend com o endpoint de sessão e a restrição do resumo financeiro.
2. Publicar o frontend sensível ao papel na mesma janela, evitando que `manager` faça chamadas que passarão a receber `403`.
3. Validar com contas `admin` e `manager` que o fluxo operacional de reserva e pagamento permanece igual.
4. Monitorar respostas `403` no resumo financeiro para identificar consumidores antigos.

**Rollback:** reverter o frontend e a autorização da rota na mesma versão de aplicação. Não há alteração de schema nem transformação de dados a desfazer.
