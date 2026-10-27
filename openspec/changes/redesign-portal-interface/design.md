## Context

O desenho aprovado está no canvas
https://claude.ai/artifact/AmLUP63EBnGH7wfk18xytN. Cada quadro tem um
arquivo; os locais ficam em `.design/marazul-dashboard/project/`, fora do
git.

| Tela | Quadro do canvas | Rota atual |
|---|---|---|
| Hoje (recepção) | `Main.dc.html` | `/dashboard` |
| Gestão (gerente) | `Gestao.dc.html` | nova rota do frontend, `/gestao`; hoje a parte financeira fica em `/dashboard` para `admin` |
| Agenda · mapa | `Agenda.dc.html` | `/reservas` (visão Agenda) |
| Agenda · lista | `AgendaLista.dc.html` | `/reservas` (visão Lista) |
| Reserva aberta | `Reserva.dc.html` | drawer em `/reservas` |
| Nova reserva | `NovaReserva.dc.html` | modal em `/reservas` e `/cliente` |
| Hóspedes | `Hospedes.dc.html` | `/cliente` |
| Quartos | `Quartos.dc.html` | `/quarto` |
| Categorias e tarifas | `Tarifas.dc.html` | `/categoria` |
| WhatsApp · conversas | `Whatsapp.dc.html` | `/whatsapp` |
| WhatsApp · aprendizado | `WhatsappAprendizado.dc.html` | `/whatsapp/aprendizado` |
| WhatsApp · configurações | `WhatsappConfig.dc.html` | `/whatsapp/configuracoes` |
| Login | `Login.dc.html` | `/login` |
| Sistema visual | `Sistema.dc.html` | — |

Os quadros `WhatsappBase.dc.html` e `Relatorios.dc.html` pertencem às
changes seguintes. Nos outros quadros, o que está marcado como "novo"
também fica de fora desta change.

Estado atual do frontend:
- MUI 7 com Emotion, Tailwind 4, `react-icons` e estilo inline convivem.
- A geometria da Agenda está em `components/clientes/timeline-layout.ts`
  (`getTimelineRange` e `assignTimelineLanes`), com testes em
  `tests/reservation-timeline.test.mjs`.
- Os testes do frontend usam `node --test` com arquivos `.mjs`, e não
  Vitest.

## Vocabulário

| Termo | Significa | Não confundir com |
|---|---|---|
| tela | uma rota do portal | quadro (arquivo do canvas) |
| painel | a área branca de cantos arredondados onde fica o conteúdo | cartão (não usamos cartões para separar seções) |
| menu | a coluna de navegação à esquerda | sub-navegação (as abas do WhatsApp) |
| reserva aberta | o drawer de uma reserva | nova reserva |
| etapa de pagamento | Confirmação, Check-in ou Check-out (`ReservationPaymentStage`) | passo do andamento (Pendente → Concluída) |
| indicador | um número com rótulo no topo da tela | — |

## Decisions

### Tokens

Os valores vêm de `Sistema.dc.html` e ficam em `:root`, em
`styles/globals.css`, com os nomes abaixo. O `@theme inline` do Tailwind 4
os expõe como utilitários (`bg-surface`, `text-fg-2`, `border-rule`,
`rounded-panel`, `font-mono`):

| Token | Valor | Uso |
|---|---|---|
| `--bg` | `#F7F7F5` | fundo da página |
| `--surface` | `#FFFFFF` | painel |
| `--muted` | `#F1F1EE` | trilho das abas, campo desligado. Texto sobre ele usa `--fg-2` (`--fg-3` dá 4,48:1) |
| `--border` | `#E2E2DE` | borda de botão e campo |
| `--border-soft` | `#E8E8E4` | borda do painel |
| `--rule` | `#EEEEEA` | divisória |
| `--fg` / `--fg-2` / `--fg-3` | `#1C1D1F` / `#50555A` / `#6B6F73` | texto, texto secundário, rótulo |
| `--accent` | `#2F6B70` | ação de destaque, seleção, IA |
| `--accent-700` / `--accent-100` / `--accent-50` | `#1F4F53` / `#E3EFED` / `#F3F8F7` | texto sobre fundo claro de destaque, fundos de seleção |
| `--accent-300` / `--accent-200` | `#8DB3B5` / `#C9D6D5` | contorno sobre fundo de destaque, gráfico |
| `--warn` / `--warn-bg` / `--warn-fg` | `#A15C07` / `#F4E6CC` / `#7A4508` | pendente, falta dado. Sobre `--warn-bg`, o texto usa `--warn-fg` (`--warn` dá 4,2:1) |
| `--warn-border` | `#E6CFA3` | borda da barra pendente na Agenda |
| `--danger` / `--danger-bg` | `#B42318` / `#FCE8E6` | vencido, erro, desconectado, cancelada |
| `--done-bg` | `#ECECE8` | reserva concluída |
| `--hatch-a` / `--hatch-b` | `#DCDCD7` / `#F6F6F3` | listras do quarto em manutenção |
| `--command-bg` / `--command-border` | `#FBFBFA` / `#DCDDD8` | barra de busca do topo |
| `--on-dark` | `#FFFFFF` | texto sobre `--fg` e `--accent` |
| `--overlay` | `rgb(28 29 31 / 28%)` | fundo atrás da reserva aberta e da nova reserva |

Cantos: 6 px nas barras da Agenda, 8 px em botões e campos, 12 px em blocos
internos e 14 px no painel. O espaçamento segue a escala 4, 8, 12, 16, 24 e
40.

Os estados de reserva usam luminosidade diferente, e não só cor:
- hospedado: `--fg`;
- confirmada: `--accent`;
- pendente: `--warn-bg` com borda `--warn-border`;
- concluída: `--done-bg`;
- manutenção: hachurado com `--hatch-a` e `--hatch-b`;
- cancelada (só no chip, fora do mapa): `--danger` sobre `--danger-bg`.

### Tipografia

`next/font/google` carrega `Hanken_Grotesk` (400, 500, 600 e 700) e
`Geist_Mono` (400 e 500) como variáveis CSS. A Geist Mono vale só para
horas, números de quarto, valores e datas em tabela. Os tamanhos são:
- 22/600 para o título da tela;
- 15/600 para título de seção;
- 14/400 para texto;
- 12–13/500 para rótulo.

### Componentes base

Ficam em `components/ui/`, escritos sobre Radix e estilizados com os
tokens:

| Componente | Base | Substitui |
|---|---|---|
| `Button` (primário escuro, destaque, borda, fantasma) | `<button>` nativo | `@mui/material/Button` |
| `Field`, `Input`, `Select` | nativos | `TextField`, `Select` do MUI |
| `Segmented` | `@radix-ui/react-toggle-group` | `ToggleButtonGroup` e chips de filtro |
| `Tabs` | `@radix-ui/react-tabs` | abas do drawer e da Agenda |
| `Switch` | `@radix-ui/react-switch` | `Switch` do MUI |
| `Sheet` (reserva aberta, nova reserva) | `@radix-ui/react-dialog` | `Drawer` e `Dialog` do MUI |
| `StatusChip` | `<span>` | `StatusBadge` atual |
| `Toast` | `sonner` | `components/snackbar.tsx` |
| `CommandBar` | `cmdk` | — |
| `DatePicker` | `react-day-picker` com `date-fns` | `@mui/x-date-pickers` |

Os ícones vêm de `lucide-react`. Os ícones Lucide já são usados hoje pelo
`react-icons/lu`.

### Caber na tela

- O layout ocupa `100vh`. O menu e o painel não rolam juntos.
- Quando uma lista passa do espaço, quem rola é a área dela, com o cabeçalho
  fixo. A página não rola.
- Quando não cabe e não é lista, o excesso vira um link ("Ver todas",
  "Ver na agenda").
- Em telas estreitas, o menu passa para cima e o painel pode rolar. Essa é
  a única exceção.

### Migração do MUI

1. Os componentes de `components/ui/` e o layout novo entram primeiro. O
   `ThemeProvider` do MUI continua no `layout.tsx`. Os nomes antigos de
   `globals.css` (`--text-muted`, `--accent-dim`, `--surface-alt`…) viram
   apelidos dos tokens novos, e o tema do MUI (`theme/index.ts`) usa os
   mesmos valores e a Hanken Grotesk. Assim as telas que ainda não migraram
   já ficam com as cores e a fonte novas, sem misturar o azul antigo com o
   teal.
2. Cada tela migra inteira, sem misturar componentes MUI e novos na mesma
   tela.
3. Quando nenhum arquivo importar `@mui/*`, saem o `ThemeProvider`,
   `@mui/*`, `@emotion/*` e `react-icons`.

A regra do `stack-e-bibliotecas.md` ("Tailwind para estrutura, `sx` para
tokens MUI") é substituída por: Tailwind com os tokens para tudo. O arquivo
da knowledge base é atualizado no fim.

### Geometria de meio-dia na Agenda

A posição continua vindo de `getTimelineRange`, com dias inteiros e saída
exclusiva. Só o desenho muda:
- **esquerda** = `(start + 0,5) × largura do dia + 1 px`;
- **direita** = `(end + 0,5) × largura do dia − 1 px`;
- quando a reserva começa antes ou termina depois do período, a barra
  encosta na borda e o canto daquele lado fica reto;
- cada dia tem uma linha fina no meio, que marca saída à esquerda e entrada
  à direita.

Com isso, uma saída e uma entrada no mesmo dia ocupam metades diferentes da
coluna, com 2 px entre elas. `assignTimelineLanes` continua separando
registros que se sobrepõem de verdade.

### Dados por tela

Cada tela usa só rotas que já existem. O que depende de dado novo não
aparece. Também não aparece como zero nem com valor de exemplo.

| Tela | Rotas | Não aparece nesta change |
|---|---|---|
| Hoje | `counter-summary`, `rooms/summary`, `GET /reservations` com `checkInFrom/To` e `checkOutFrom/To` de hoje, `whatsapp/queue/count`, `whatsapp/queue` (nível Agora) | "Cobrar hoje", saldo por linha, quarto pronto ou em limpeza |
| Gestão | `revenue-summary` (só `admin`), `counter-summary.taxaOcupacaoMes` | diária média, RevPAR, por categoria, já reservado, ano anterior, meta |
| Agenda · mapa | `GET /reservations` por período, rota de quartos atual, consulta de disponibilidade atual | brechas e encaixes |
| Agenda · lista | `GET /reservations` com `status`, `search` (nome do hóspede), `roomId` e período | coluna de saldo, busca por código |
| Reserva aberta | `GET /reservations/:id`, `transitions`, `payments`, `cancel`, `PUT /reservations/:id`, `quote` | histórico completo (só a última alteração, via `audit`) e origem |
| Nova reserva | `quote`, disponibilidade, busca de clientes, `pricing-rules`, `categories` | total por categoria antes de escolher o cliente |
| Tarifas | `categories`, `pricing-rules`; entrada e saída como constante do frontend | simulador |
| Hóspedes | busca de `clients` (nome, e-mail, telefone e CPF) | busca por placa, filtros por situação (hospedado, chega hoje, reserva futura) |
| WhatsApp | rotas atuais de `/api/whatsapp/*` | Base do hotel, transcrição, comprovante, nota interna, chamado |

### Barra de busca

O `CommandBar` abre pelo campo do topo ou por Ctrl/⌘ K e busca em três
fontes:
- hóspedes, pela busca de `clients` (nome, e-mail, telefone e CPF);
- reservas, pelo `search` de `GET /reservations`, que procura só pelo nome
  do hóspede;
- quartos, pela lista de quartos já carregada, com as reservas ativas por
  `roomId`.

O texto de ajuda diz "Buscar hóspede, reserva ou quarto". Pedidos em
linguagem natural ficam para `add-assistant-command-bar`.

## Risks / Trade-offs

- **Duas bibliotecas de UI durante a migração** aumentam o bundle por
  algumas semanas. Mitigação: migrar tela inteira e remover o MUI assim que
  a última tela sair.
- **A geometria nova pode esconder uma diária de um dia só** quando o dia
  for estreito. Mitigação: largura mínima de 48 px por dia e nome no
  `title`/`aria-label`.
- **Indicadores somem enquanto o backend novo não chega**, e o Hoje fica mais
  vazio que o desenho. A alternativa seria mostrar números falsos.
- **Testes do frontend em `node --test`**, enquanto o `CLAUDE.md` pede
  Vitest. Esta change mantém `node --test` para não misturar migração de
  teste com migração visual.

## Decisões

As quatro decisões de escopo estão no fim do `proposal.md`. A decisão
técnica, tomada em 2026-10-27, é esta:

5. **Os testes novos do frontend seguem em `node --test`** (`.mjs`), como
   os atuais. A troca para Vitest não entra nesta change.
