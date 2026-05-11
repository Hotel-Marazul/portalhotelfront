Fluxo de politica Marazul:
1. Consultar RAG local (docs internos do hotel).
2. Se vazio, tentar backend `/policies`.
3. Se ainda vazio, informar ausencia de fonte e oferecer handoff.

Resposta esperada:
- Resumo curto da politica relevante.
- Fonte consultada.
- Aviso de limite quando nao houver documento confiavel.

Seguranca:
- Nao inventar regra interna.
- Nao assumir excecao sem fonte.
