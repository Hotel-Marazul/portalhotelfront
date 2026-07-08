---
name: data-architecture
description: Orienta modelagem PostgreSQL somente apos handoff de produto aprovado.
compatibility: opencode
---
## Quando usar
Use esta skill para schema, migracoes, consultas, indices e persistencia depois do handoff do product-owner.

## Pre-condicao
Confirme que existem entidades reais, regras de negocio e criterios de aceite. Se nao existirem, volte ao product-owner.

## Regras
- Use PostgreSQL como banco padrao.
- Use Prisma como opcao inicial leve quando houver implementacao.
- Modele apenas dados exigidos pela iteracao aprovada.
- Priorize integridade e clareza antes de otimizacoes.
- Nao crie tabelas genericas sem criterio de aceite.

## Saida esperada
- Entidades e campos necessarios.
- Relacionamentos e constraints.
- Migracoes necessarias.
- Consultas que o produto precisa suportar.
- Riscos de integridade, performance ou evolucao.
