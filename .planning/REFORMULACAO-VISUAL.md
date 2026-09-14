# Reformulação visual — Hotel Marazul

## Direção adotada

Reformulação solicitada para simplificar a operação: superfícies claras, azul sóbrio alinhado à logo Marazul, tipografia sem serifa, bordas discretas e menos decoração nos indicadores. A logo fornecida em `frontend/public/logo-marazul.png` é usada no menu e no login; o arquivo original permanece intacto. O enquadramento elimina o excesso de transparência via CSS.

## Implementação

- Tema MUI e estilos globais compartilhados; cabeçalhos e seções com hierarquia h1/h2.
- Navegação lateral no desktop; drawer móvel com foco gerenciado pelo MUI, Escape e retorno do foco. Link para pular ao conteúdo e foco visível.
- Login compacto e responsivo, autocomplete e rótulos persistentes.
- Dashboard, quartos, hóspedes, reservas e categorias com espaçamento consistente. Carregamento e erros explícitos nas listagens de quartos/categorias; indicadores do dashboard não aparecem como zero quando o carregamento falha.
- Mapa com dias e quartos fixos, rolagem contida, filtros, busca e períodos de 7/14 dias. Status identificado por texto e cor, manutenção identificada na linha do quarto.
- Reservas são botões nativos; detalhes acessíveis por teclado. A posição considera `[check-in, check-out)`, sem acrescentar uma diária na saída. Registros sobrepostos usam linhas separadas.
- Consulta de disponibilidade preservada em seção recolhível, via backend. O mapa continua limitado à página de até 100 reservas; quando a API informa mais registros, um aviso explicita que o mapa é parcial. Filtrar status também avisa que espaços em branco podem conter outras reservas.
- Nenhuma mudança no backend, banco, autenticação ou regras de preço; nenhum seed executado.

## Verificações

Na pasta `frontend/`, com Node 22:

```sh
npm run lint
npm run test:timeline
npm run build
```

Os quatro testes de geometria cobrem checkout exclusivo, recorte nas bordas, datas inválidas e registros sobrepostos. Tipos e lint verificados.

Revisão no Chrome com uma página temporária que renderizava os componentes reais com dados fictícios: 320, 768, 1024 e 1440 px, sem overflow horizontal do documento. Menu móvel abre/fecha com retorno do foco; Enter abre detalhes e Escape devolve foco à reserva. Estado vazio e nomes acessíveis dos botões conferidos. A página temporária foi removida após a revisão.

O login foi conferido em 320 px, incluindo carregamento da logo. A revisão identificou e corrigiu uma divergência de datas entre servidor UTC e navegador local e o rótulo sobreposto ao preenchimento automático do Chrome.

Contraste calculado: texto secundário 6:1 em branco, ação principal 7,37:1 e textos dos cinco status entre 5,7:1 e 6,8:1. Contorno de campos 3,22:1. Isso não substitui uma auditoria completa WCAG/axe.

## Limites da validação

A tela operacional apresentou falha ao carregar os indicadores no navegador. A validação de layout usou dados fictícios e não comprova os fluxos autenticados com o backend. Criação, edição e pagamento de reservas não foram executados. Revisão integral com leitor de tela e auditoria axe permanecem pendentes.

## Correção de escala e alinhamento — 2026-09-05

Após revisão da interface autenticada em `localhost:3002`, a redução excessiva foi localizada em `html { font-size: 14px; zoom: .8; }` no desktop. A escala artificial foi removida; a fonte raiz usa 100%, o cabeçalho mantém 64 px e o menu completo 224 px. O espaçamento desktop é ajustado diretamente, sem reduzir textos e alvos de interação.

- Restauradas as dimensões de títulos, indicadores, logo e navegação; ações do cabeçalho centralizadas e link principal com altura mínima de 44 px.
- O gráfico de ocupação recebia uma variável CSS diretamente em `ResponsiveContainer.height`, resultando em um contêiner sem gráfico. A altura agora é resolvida pelo elemento pai, com o gráfico usando 100% da área. Eixos e curva foram confirmados no navegador.
- O mapa usa largura mínima de 100%, eliminando a faixa vazia em monitores largos e mantendo rolagem própria nas telas menores.
- Filtros da lista usam espaçamento flexível e coluna no celular; campos de data compartilham o alinhamento dos demais campos. A paginação quebra de linha para manter seus controles visíveis.
- Navegação inferior com ícones acima dos rótulos; menu lateral permite rolagem em telas baixas.

Validação: dashboard e agenda em 320, 768, 1024 e 1440 px, sem overflow horizontal do documento; em 1920 px, mapa e contêiner com a mesma largura. Conferidos filtros avançados em 320 px, menu móvel com Tab/Escape e retorno de foco. Lint e os quatro testes existentes da timeline passaram. Build de produção realizado em cópia temporária do frontend para preservar o servidor de desenvolvimento ativo. Não foram alterados dados operacionais nem executadas ações de criação, edição ou cancelamento. A revisão não constitui auditoria completa com axe ou leitor de tela.

## Escala desktop — 2026-09-07

Após a revisão adicional, a composição para monitores grandes ganhou uma escala própria a partir de 1200 px: sidebar de 248 px, cabeçalho de 72 px, títulos de até 36 px, cards com mais respiro e gráfico de 280 px. A fonte continua em 100% e não usa zoom global; tablet e celular mantêm suas regras responsivas.
