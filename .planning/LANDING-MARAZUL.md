# Landing pública do Hotel Marazul

Atualizada em 2026-09-13 após aprovação da composição pelo responsável.

## Experiência e limites

A rota `/` apresenta o hotel; `/login` continua sendo o acesso da equipe.
Middleware, autenticação, páginas operacionais, backend e banco não foram
alterados nesta reformulação. A home permanece pública mesmo com sessão expirada.

Direção visual baseada em Moonrise Kingdom / Wes Anderson, traduzida pela
cinematic-ui em fotografia enquadrada, título central, azul-claro e ritmo
assimétrico. A frontend-design orientou tipografia, contenção e acabamento.
O diretor e o filme são referências internas, não conteúdo público.

Paleta: deep `#163e50`, mist `#e7f0f2`, paper `#fafbf7`,
water `#bfd8df`, sun `#f0ca79`, muted `#526a72`.
Georgia nos títulos; Trebuchet/Arial nos textos, sem download de fontes.

Fluxo: piscina em moldura → fachada/apresentação → quatro acomodações
selecionáveis → díptico do café da manhã → galeria manual de lazer →
localização e consulta pelo WhatsApp → rodapé com acesso da equipe.

Documentos de direção e implementação:

- `cinematic-marazul/decisions.md`: pesquisa, escolha do filme e limites.
- `cinematic-marazul/storyboard.md`: composição aprovada pelo usuário.
- `cinematic-marazul/compiled-spec.md`: CSS/JS completos, fontes da biblioteca e ajustes.

## Fotos e conteúdo

Os dez arquivos finais são servidos por `next/image` a partir de
`frontend/public/hotel/tratadas/`:

- `piscina-v2.png`: conserva cadeiras e guarda-sóis.
- `chegada-sem-placa-v2.png`: fachada sem a placa à direita.
- `apartamento-super-luxo.png`, `apartamento-luxo.png`,
  `apartamento-standard.png`, `apartamento-simples.png`.
- `cafe-da-manha-sem-marca.png`, `restaurante-sem-marca.png`.
- `sala-de-jogos.png`, `lobby.png`.

As fotos foram tratadas em etapas anteriores a pedido do usuário; esta etapa
de implementação não gerou nem editou imagens. Originais e versões anteriores
foram preservados. A logo existente permanece intacta.

Fontes de conteúdo consultadas em 13/09/2026:

- https://www.cliclitoralsul.com.br/hotel-mar-azul-curumim/
- https://guiadecapao.com.br/hoteis-em-capao-da-canoa/ (corroboração do WhatsApp)

Não são prometidos valores, disponibilidade ou café incluído na diária.
Selecionar um quarto apenas prepara a consulta no WhatsApp com a categoria;
nenhuma reserva ou mensagem é enviada automaticamente. Mapa e telefone são
links comuns, sem embed, rastreamento ou integração nova.

Antes da publicação, a equipe deve confirmar a atualidade de comodidades,
horários e contato, além dos direitos de republicação das fotografias de
terceiros e da fidelidade das versões tratadas às instalações atuais.

## Manutenção e execução

- Página/metadados: `frontend/src/app/page.tsx`.
- Componentes, conteúdo e CSS: `frontend/src/components/landing/`.
- Conteúdo e links de consulta: `landing-content.ts`.
- Entradas nativas: `useHotelMotion.ts`, sem parallax ou biblioteca adicional.
- Testes: `frontend/tests/landing-content.test.mjs`,
  `landing-routing.test.mjs` e `reservation-timeline.test.mjs`.
- Definir `SITE_URL` no ambiente com o domínio definitivo para habilitar a
  imagem Open Graph local. Sem essa configuração não se inventa domínio.

Comandos na pasta `frontend/`:

```sh
node --experimental-strip-types --test tests/*.test.mjs
npm run lint
node --max-old-space-size=768 node_modules/typescript/bin/tsc --noEmit
npm run build
```

A prévia existente está em http://localhost:3002/.

## Validação em 13/09/2026

- 11 testes passaram: três novos contratos de conteúdo/WhatsApp, quatro de
  middleware e quatro de timeline. Os novos contratos foram executados antes
  da implementação (falharam) e depois passaram.
- ESLint e TypeScript passaram.
- Build de produção passou em cópia temporária `/tmp/marazul-build.7Wn2Ka`,
  sem alterar `.next` da prévia. Apenas a cópia de configuração usou
  `experimental.cpus: 1`, com heap de 1024 MB, devido à pressão de memória.
  Nenhum arquivo de ambiente privado foi copiado. Foram geradas 13 páginas;
  a home é estática, com 5,33 kB de código específico e 120 kB de First Load JS.
- Revisão no Chrome em 320, 768, 1024 e 1440 px: sem overflow horizontal.
  Ajustes finais: cabeçalho compacto em 320 px, título em duas linhas, piscina
  1,85:1 alinhada ao topo no desktop e 4:3 no celular para preservar guarda-sóis.
- Quatro categorias selecionadas no navegador; título, estado pressionado e
  mensagem de consulta correspondem à escolha.
- Galeria e setas exercitadas; imagens carregadas verificadas no DOM.
- Menu móvel abre, fecha ao selecionar seção, Enter abre, Tab chega ao primeiro
  link e Escape fecha com retorno de foco ao botão.
- Pausa manual verificada: todos os cinco elementos de entrada ficam sem
  animação. O navegador tem `prefers-reduced-motion: reduce`; o tratamento
  estático foi verificado. A execução visual com movimento habilitado não foi
  observada neste ambiente.
- Sem erros de aplicação observados no console. Não foi executada auditoria
  automatizada completa de acessibilidade nem teste em dispositivo físico.

Sem deploy, commit, instalação de dependências ou modificação dos containers
operacionais nesta reformulação. A publicação depende do domínio e da revisão
final do responsável.
