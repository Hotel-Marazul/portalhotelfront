## Why

A interface atual mistura MUI, Tailwind e estilo inline, usa Inter com azul
e cartões brancos em toda tela, e empilha seções que obrigam a rolar. Ela
parece genérica e esconde o que a recepção precisa ver primeiro. O redesign
foi desenhado e aprovado em 2026-10-27 no canvas
https://claude.ai/artifact/AmLUP63EBnGH7wfk18xytN.

Esta change troca a interface **usando só o que o backend já entrega**. O
que o desenho mostra e o sistema ainda não tem fica para as changes listadas
em "Changes seguintes".

## Como funciona na prática

1. A recepcionista entra pelo login novo e cai no **Hoje**. Cada tela cabe
   em 1440×900 sem rolar a página.
2. No Hoje ela vê quem chega, quem sai e quem está hospedado, com o quarto e
   a ação de check-in ou check-out na mesma linha.
3. Na **Agenda**, cada reserva começa no meio do dia de entrada e termina no
   meio do dia de saída. Quem sai e quem entra no mesmo quarto, no mesmo dia,
   aparecem lado a lado na coluna.
4. Ao clicar numa reserva, ela abre por cima da Agenda com quatro abas:
   resumo, hóspedes, pagamentos e histórico. Tudo o que o drawer faz hoje
   continua lá.
5. A **nova reserva** mostra os quartos livres por categoria, com a diária
   de casal de cada categoria. O total sai da cotação do backend assim que
   cliente e quarto estão escolhidos, como hoje.
6. O gerente entra e vê **Gestão** no lugar do Hoje, com os números
   financeiros que já existem.
7. O WhatsApp ganha o visual novo nas telas que já existem: conversas,
   aprendizado da IA e configurações.

## Capability map

| Capability | Responsabilidade | Depende de |
|---|---|---|
| `portal-visual-system` | Tokens de cor, tipografia, componentes base, regra de caber na tela | — |
| `portal-navigation` | Menu por papel, painel único, sub-navegação do WhatsApp, contador da fila | `portal-visual-system` |
| `today-dashboard` | Hoje da recepção e Gestão do gerente, com os dados atuais | `portal-navigation` |
| `agenda-views` | Mapa com meio-dia, lista, reserva aberta e nova reserva | `portal-navigation` |
| `rates-overview` | Categorias, regras de hóspede adicional e validade da temporada, em leitura e edição como hoje | `portal-navigation` |

As telas de Hóspedes, Quartos, WhatsApp e Login mudam só de visual. Os
requisitos delas já estão em `add-whatsapp-reception-inbox` e
`add-whatsapp-platform-configuration`, ou são cobertos por
`portal-visual-system`.

## What Changes

- Tokens de cor e espaçamento em `globals.css` (`@theme` do Tailwind 4).
  Hanken Grotesk e Geist Mono carregadas por `next/font`.
- Um layout novo, com menu lateral só de texto e conteúdo num painel branco.
  O menu muda conforme o papel (`receptionist` ou `admin`).
- Todas as telas atuais são refeitas com o visual novo, mantendo as mesmas
  rotas, chamadas de API e regras de permissão.
- O MUI sai tela por tela. Quando a última tela migrar, ele e o Emotion
  saem do `package.json` (ver `design.md`).
- A barra de busca do topo (atalho Ctrl/⌘ K) procura hóspede, reserva e
  quarto com as rotas que já existem.
- Indicador sem dado não aparece. Nada é mostrado como zero quando o
  carregamento falhou.

## Changes seguintes

Cada uma vira uma change própria depois que esta for aprovada:

| Change | O que entrega | Precisa de backend |
|---|---|---|
| `allow-quote-without-client` | Cotação por categoria, sem cliente e sem quarto, para o simulador de Tarifas e o total por categoria na nova reserva | Sim, pequena. O `reservationQuoteSchema` exige `clientId` e `roomId`; o `facts.service` do WhatsApp já calcula por categoria e pode ser a base |
| `add-agenda-gap-fitting` | Brechas de 1 a 4 noites e sugestão de encaixe na Agenda. O "Mover" usa o `PUT /reservations/:id` atual | Não: regra no frontend. Talvez uma rota de candidatos |
| `add-reservation-operational-data` | Saldo na lista e em "Cobrar hoje", origem da reserva, rota para listar `reservation_events`, busca por código e por placa, filtros de hóspede por situação | Sim |
| `add-room-housekeeping-status` | Limpo, em limpeza, precisa limpar e bloqueado, por quarto | Sim, coluna e rota novas |
| `add-management-metrics` | Números por categoria, ocupação já reservada, comparação com o ano anterior, meta diária, Relatórios com exportação | Sim |
| `add-whatsapp-hotel-knowledge` | Base do hotel: fatos, respostas prontas com "/" e mensagens de rotina | Sim, mais o agente |
| `add-whatsapp-media-reading` | Transcrição de áudio e leitura de comprovante | Sim, mais um provedor de IA |
| `add-whatsapp-staff-tools` | Nota interna e chamado de manutenção a partir da conversa | Sim |
| `add-assistant-command-bar` | Pedidos à IA pela barra do topo ("reserva o 206 pra Ana") | Sim, mais o agente |

## Non-goals

- Rota, tabela ou migração nova no backend.
- Mudar regra de preço, disponibilidade, permissão ou status de reserva.
- Brechas, limpeza, origem, métricas novas, Base do hotel ou qualquer item
  de "Changes seguintes".
- Versão para celular além do que já funciona hoje. O layout continua
  usável em telas estreitas, mas o desenho de celular fica para depois.
- Modo escuro.

## Impact

- **frontend:** `app/layout.tsx`, `styles/globals.css`, `components/sidenav.tsx`,
  `components/header.tsx`, `components/layout/*` e todas as páginas em `app/`.
  Os componentes de `components/dashboard`, `reservations`, `clientes`,
  `quartos`, `categorias` e `whatsapp` são reescritos.
- **Dependências:** entram `lucide-react`, `@radix-ui/react-*` (diálogo,
  abas, menu, popover), `react-day-picker`, `sonner` e `cmdk`. Saem
  `@mui/*`, `@emotion/*` e `react-icons` no fim da migração.
- **backend e agents:** nenhum arquivo.
- **Testes:** os testes atuais do frontend (`test:timeline`,
  `test:reservation` e `test:whatsapp`) continuam passando. Entram testes
  para a geometria de meio-dia e para a regra de esconder indicador sem dado.

## Decisões

Tomadas em 2026-10-27.

1. **Trocar o MUI.** Os componentes passam a ser Radix com Tailwind, tela
   por tela, e o MUI sai na seção 13 do `tasks.md`.
2. **Ordem de migração das telas:** a do `tasks.md`. Hoje, Gestão, Agenda
   (mapa, lista, reserva aberta, nova reserva), Hóspedes, Quartos, Tarifas,
   WhatsApp e Login.
3. **O gerente vê também o Hoje.** O menu do gerente tem Gestão e Hoje, e
   ele entra pela Gestão (`portal-navigation`).
4. **A cotação sem cliente fica para `allow-quote-without-client`.** Até
   lá, Tarifas fica sem simulador e a nova reserva mostra a diária, e não o
   total, enquanto o cliente não for escolhido.
