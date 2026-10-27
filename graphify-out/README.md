# Mapa do PortalHotel

Esta pasta contém artefatos gerados pelo Graphify. O código-fonte do produto
continua em `frontend/`, `backend/` e `agents/`.

## Por onde começar

| Arquivo | Uso |
| --- | --- |
| [graph.html](graph.html) | Explorar visualmente nós, comunidades e conexões no navegador. |
| [GRAPH_REPORT.md](GRAPH_REPORT.md) | Ler o panorama, os conceitos centrais e as limitações da extração. |
| [graph.json](graph.json) | Consultar o grafo pela CLI ou consumir os dados em ferramentas. |
| [reports/](reports/) | Consultar diagnósticos de integridade, escopo e benchmark. |
| [backups/](backups/) | Consultar snapshots anteriores preservados durante a atualização. |

## Arquivos de manutenção

Os caminhos abaixo são usados pelo próprio Graphify e ficam em seus locais
nativos para manter consultas e atualizações compatíveis:

- `manifest.json`: controle dos arquivos já processados.
- `cost.json`: histórico de execução e contadores de tokens; veja as notas de
  contabilização antes de interpretar valores iguais a zero.
- `cache/`: resultados reutilizáveis da extração.
- `.graphify_python`, `.graphify_root` e `.graphify_build.json`: interpretador,
  raiz de varredura e exclusões persistidas.
- `.graphify_labels.json`: nomes das comunidades utilizados nas exportações.

Os fragmentos temporários `.graphify_chunk_*.json` e os intermediários de
detecção/extração são removidos após a conclusão bem-sucedida da geração.

## Consultar e atualizar

Execute da raiz do repositório:

```bash
graphify query "reservations availability"
graphify path "conceito A" "conceito B"
graphify explain "conceito"
graphify update .
graphify export html
```

`graphify update .` atualiza a análise estrutural sem chamadas a modelos.
Documentação ou imagens alteradas podem precisar de uma nova extração
semântica pela skill `/graphify . --update`.

## Escopo e limites

A varredura inclui o código, a documentação e os recursos visuais do projeto,
além das skills e recursos de apoio em `.agents/skills/`. Essa pasta orienta os
assistentes de desenvolvimento; `agents/` é o serviço de IA do produto.
`graphify update .` mapeia estruturalmente os títulos e links dos documentos
Markdown e o código suportado; leia o `SKILL.md` completo antes de aplicá-lo.
Exclui históricos temporários e outras ferramentas dos assistentes: `.pi/`,
`.opencode/`, `.codex/` e `.claude/`, além dos arquivos ignorados pelo detector.
Arquivos de ambiente e artefatos de build não são fontes deste mapa.

Afirmações extraídas de planos e documentos históricos representam o conteúdo
desses documentos; não comprovam o comportamento atual do sistema. O grafo
tampouco substitui testes de autorização, integridade de reservas ou runtime.

Esta pasta foi gerada no working tree. A seleção do que versionar deve seguir a
convenção do time; nenhum commit é criado pela geração.
