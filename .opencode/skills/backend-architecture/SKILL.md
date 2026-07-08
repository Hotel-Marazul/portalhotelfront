---
name: backend-architecture
description: Orienta BFF, APIs e integracoes somente apos handoff de produto aprovado.
compatibility: opencode
---
## Quando usar
Use esta skill para route handlers, server actions, contratos HTTP, integracoes e decisoes de API depois do handoff do product-owner.

## Pre-condicao
Confirme que existem regra de negocio, escopo MVP e criterios de aceite. Se nao existirem, volte ao product-owner.

## Regras
- Use Next.js como backend-for-frontend por padrao.
- Use Route Handlers para contratos HTTP estaveis.
- Use Server Actions para mutacoes diretamente ligadas a UI.
- Crie API Node separada apenas com justificativa operacional.
- Mantenha contratos pequenos e claros.

## Saida esperada
- Fronteira escolhida: BFF, server action ou API separada.
- Contrato de entrada e saida.
- Validacoes necessarias.
- Dependencias de dados.
- Criterios de aceite atendidos.
