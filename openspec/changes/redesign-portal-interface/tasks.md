Regras para todas as tarefas:
- não alterar `backend/` nem `agents/`;
- cada tela migra inteira;
- rodar `npm run lint` e os testes do frontend ao fim de cada seção;
- conferir cada tela em 1440×900 (sem rolar a página) e em 390 px (sem
  rolagem horizontal), comparando com o quadro correspondente do canvas
  (ver `design.md`).

## 1. Base visual

- [x] 1.1 Ler o guia do Next instalado em `node_modules/next/dist/docs/`
  sobre fontes e layout antes de mexer no `layout.tsx`, como pede o
  `frontend/AGENTS.md`.
- [x] 1.2 Trocar os tokens de `styles/globals.css` pelos da tabela do
  `design.md`, em `:root` e expostos pelo `@theme inline` do Tailwind 4,
  mantendo os nomes antigos como apelido até a seção 13. O tema do MUI passa
  a usar os mesmos valores.
- [x] 1.3 Carregar Hanken Grotesk e Geist Mono por `next/font/google` no
  `layout.tsx` e expor as variáveis no `@theme`.
- [x] 1.4 Instalar `lucide-react`, `@radix-ui/react-dialog`,
  `@radix-ui/react-tabs`, `@radix-ui/react-toggle-group`,
  `@radix-ui/react-switch`, `@radix-ui/react-popover`, `react-day-picker`,
  `sonner` e `cmdk`, em versões fixas. O container `frontend-marazul` tem
  `node_modules` próprio: rodar `docker compose restart frontend-marazul`
  antes de usar os componentes numa tela.
- [x] 1.5 Criar `components/ui/`: `Button`, `Field`, `Input`, `Select`,
  `Segmented`, `Tabs`, `Switch`, `Sheet`, `StatusChip`, `Toast`,
  `DatePicker`. Cada componente com foco visível e nome acessível.
- [x] 1.6 Escrever um teste que percorre os tokens de texto contra os fundos
  e falha quando o contraste fica abaixo de 4,5:1.

## 2. Layout e navegação

- [x] 2.1 Novo layout em `components/layout/`: menu só de texto, painel
  único com cantos de 14 px, ocupando `100vh`, e o menu acima do conteúdo
  abaixo de 900 px.
- [x] 2.2 Menu por papel: recepção sem Gestão; gerente com Gestão no topo e
  entrando por ela. Criar a rota `/gestao` no frontend, redirecionando
  `receptionist` para `/dashboard`. Nome e papel no rodapé do menu.
- [x] 2.3 Contador do WhatsApp no menu usando `useWhatsappWaiting`, oculto
  quando zero.
- [x] 2.4 `CommandBar` com `cmdk`, abrindo por Ctrl/⌘ K, buscando em
  clientes, `GET /reservations?search=` (nome) e quartos (número →
  `roomId`).
- [x] 2.5 Substituir `components/snackbar.tsx` por `sonner`.

## 3. Hoje (recepção)

- [x] 3.1 Indicadores sem cartões a partir de `counter-summary`,
  `rooms/summary` e `whatsapp/queue/count`.
- [x] 3.2 Tabela "Movimento de hoje" com abas Chegadas, Saídas e
  Hospedados, a partir de `GET /reservations` com `checkInFrom/To` e
  `checkOutFrom/To` de hoje no fuso do hotel.
- [x] 3.3 Check-in e check-out pela linha, via `transitions`, com
  atualização da linha e mensagem de erro do backend.
- [x] 3.4 Lista "A fazer", com até 4 itens, só das fontes listadas no spec
  (nível Agora vem de `GET /whatsapp/queue`).
- [x] 3.5 Testes da montagem da lista "A fazer" e da regra de esconder
  indicador sem dado (falha de rota mostra erro, não zero).

## 4. Gestão (gerente)

- [x] 4.1 Indicadores de receita, recebido e a receber a partir de
  `revenue-summary`, com comparação com o mês anterior.
- [x] 4.2 Ocupação dos últimos 6 meses a partir de
  `counter-summary.taxaOcupacaoMes`, em barras.
- [x] 4.3 Garantir que a recepção nunca chama `revenue-summary` e é levada
  ao Hoje.

## 5. Agenda · mapa

- [x] 5.1 Estender `tests/reservation-timeline.test.mjs` com a geometria de
  meio-dia:
  - troca no mesmo dia sem sobreposição;
  - recorte com canto reto nas duas bordas;
  - diária única;
  - período que começa no meio de uma reserva.
- [x] 5.2 Função de posição em `timeline-layout.ts` (esquerda e direita em
  px a partir de `start`, `end` e largura do dia) que passe nesses testes.
- [x] 5.3 Novo mapa: grupos por categoria com a capacidade, linha com
  número e capacidade, marca de meio-dia, coluna de hoje, manutenção
  hachurada e legenda.
- [x] 5.4 Navegação por semana, botão Hoje e período padrão de 14 dias,
  mantendo o aviso de mapa parcial quando a API indicar mais registros.

## 6. Agenda · lista

- [x] 6.1 Busca pelo nome (`search`) e pelo número do quarto (convertido em
  `roomId`), período de entrada e filtros de status que ligam e desligam,
  todos enviados ao backend.
- [x] 6.2 Tabela com código, hóspede, quarto, período, status, total e
  Abrir, com paginação do backend.

## 7. Reserva aberta

- [x] 7.1 `Sheet` com cabeçalho, faixa de andamento e ação do próximo
  passo. Concluir com saldo mostra o aviso.
- [x] 7.2 Aba Resumo: período, quarto, alimentação, preço detalhado
  (diária ajustada e motivo quando `price_source` for `manual`) e cliente.
- [x] 7.3 Aba Hóspedes com o `GuestListEditor` atual reescrito no visual
  novo.
- [x] 7.4 Aba Pagamentos: resumo de total, pago e saldo; registro por etapa
  e forma; estorno; alerta de exceção financeira.
- [x] 7.5 Aba Histórico com a última alteração (`audit`).
- [x] 7.6 Edição e cancelamento com as mesmas validações e mensagens de
  hoje. Conferir que `version` continua sendo enviado no `PUT`.

## 8. Nova reserva

- [x] 8.1 `Sheet` em duas colunas, com resumo fixo e total vindo de
  `quote`.
- [x] 8.2 Cliente existente ou cadastro ali mesmo, reaproveitando a
  validação do `ModalHospede`.
- [x] 8.3 Quartos livres por categoria, com a diária de casal e o aviso dos
  quartos sem capacidade para o grupo.
- [x] 8.4 Ajuste manual recolhido, com motivo obrigatório.
- [x] 8.5 Preenchimento vindo do WhatsApp (`reservationInitialValues`), com
  a indicação "Preenchida pela conversa com {nome}".
- [x] 8.6 Conferir os erros atuais: disponibilidade mudou, check-out antes
  do check-in, campos obrigatórios.

## 9. Hóspedes

- [x] 9.1 Lista com a busca atual de `clients` (nome, e-mail, telefone e
  CPF). Busca por placa e filtros por situação ficam para
  `add-reservation-operational-data`.
- [x] 9.2 Ficha ao lado: contato, documentos, estadias, estadia atual e
  histórico, com o conteúdo de `ModalDetalhesHospedes` e
  `ModalReservasCliente`.

## 10. Quartos

- [x] 10.1 Resumo e tabela de quartos com categoria, capacidade, diária e
  situação de hoje, sem a coluna de limpeza.
- [x] 10.2 Painel do quarto com as próximas reservas e a ocupação dos
  próximos 14 dias. Manutenção liga e desliga como hoje.
- [x] 10.3 Criar e editar quarto com o formulário atual reescrito.

## 11. Categorias e tarifas

- [x] 11.1 Tabela de diária de casal por categoria, com unidades e
  capacidade.
- [x] 11.2 Regras de hóspede adicional e faixa de validade com o aviso fora
  da temporada.
- [x] 11.3 Criar e editar categoria e regra com os formulários atuais
  reescritos. Regra fica só leitura: o backend não tem rota que grave
  `pricing_rules` nem havia formulário de regra.

## 12. WhatsApp e login

- [x] 12.1 Abas do WhatsApp (Conversas, Aprendizado da IA e Configurações,
  esta só para `admin`), com estado da conexão e som.
- [x] 12.2 Conversas: fila, conversa e leitura da IA no visual de
  `Whatsapp.dc.html`, sem os itens marcados como "novo". Manter atalho
  Alt+N, desfecho, Não precisa resposta, sugestão com trechos, status de
  entrega, mídia, vínculo de contato e criação de reserva.
- [x] 12.3 Aprendizado e Configurações no visual dos quadros, com os mesmos
  dados e permissões.
- [x] 12.4 Login no visual de `Login.dc.html`, com autocomplete, mostrar
  senha e a mensagem de erro atual.
- [ ] 12.5 Rodar `npm run test:whatsapp` e refazer o roteiro de teclado da
  tarefa 13.10 de `add-whatsapp-reception-inbox`.

## 13. Saída do MUI

- [x] 13.1 Confirmar que nenhum arquivo importa `@mui/*`, `@emotion/*` ou
  `react-icons`.
- [ ] 13.2 Remover o `ThemeProvider`, as dependências e os apelidos de
  tokens antigos.
- [ ] 13.3 Atualizar `.mente/tecnico/stack-e-bibliotecas.md` com a stack
  nova de UI.
- [ ] 13.4 `npm run lint`, os três `npm run test:*` e `npm run build` (com
  `NODE_ENV=production`, em diretório separado do servidor de
  desenvolvimento).
- [ ] 13.5 Revisão no navegador, logado como recepção e como gerente, em
  1440×900 e em 390 px, registrando o resultado no fim deste arquivo.
