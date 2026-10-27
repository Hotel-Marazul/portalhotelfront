## ADDED Requirements

### Requirement: Tokens únicos de cor e tipografia
O portal SHALL usar só os tokens definidos em `styles/globals.css` para cor,
espaçamento e cantos. O texto SHALL usar Hanken Grotesk. Horas, números de
quarto, valores em reais e datas em tabela SHALL usar Geist Mono. Nenhuma
tela MUST usar estilo inline com cor fixa fora dos tokens, nem fonte
carregada de outra forma que não `next/font`.

#### Scenario: Valor em tabela
- **WHEN** uma tabela mostra o total de uma reserva
- **THEN** o valor aparece em Geist Mono, alinhado à direita

#### Scenario: Cor fora do sistema
- **WHEN** um componente precisa de um vermelho de alerta
- **THEN** ele usa `--danger` e não um hexadecimal próprio

### Requirement: Uma cor de destaque
A cor de destaque (`--accent`) SHALL marcar só três coisas: a ação principal
de destaque, a seleção atual e o que vem da IA. Alerta e pendência SHALL
aparecer apenas em textos curtos, pontos e chips (`--warn` e `--danger`),
e nunca como fundo de seção inteira.

#### Scenario: Sugestão da IA
- **WHEN** a tela mostra uma sugestão da IA
- **THEN** o bloco usa os tons de `--accent` e um ícone da IA

#### Scenario: Pagamento vencido
- **WHEN** uma reserva tem saldo vencido
- **THEN** só o valor e o rótulo ficam em `--danger`; a linha continua neutra

### Requirement: A tela cabe na janela
Em uma janela de 1440×900, nenhuma tela do portal SHALL rolar a página
inteira. Uma lista maior que o espaço SHALL rolar dentro da própria área,
com o cabeçalho fixo. Um conteúdo que não é lista e não cabe SHALL virar um
link para a tela completa. Em larguras abaixo de 900 px, o painel MAY rolar.

#### Scenario: Muitas chegadas no Hoje
- **WHEN** há 25 chegadas no dia
- **THEN** a tabela do Hoje rola por dentro e o título, os indicadores e a barra de busca continuam visíveis

#### Scenario: Tela estreita
- **WHEN** a largura é 390 px
- **THEN** o menu fica acima do conteúdo e o painel pode rolar, sem rolagem horizontal da página

### Requirement: Estado de cada reserva por luminosidade
Os estados de reserva SHALL se distinguir pela luminosidade, e não só pela
cor:
- hospedado: escuro;
- confirmada: destaque;
- pendente: claro com borda;
- concluída: cinza claro;
- manutenção: hachurado.

Cada estado SHALL ter também um rótulo em texto, no chip, no `aria-label`
ou na legenda.

#### Scenario: Leitura sem cor
- **WHEN** a Agenda é vista em escala de cinza
- **THEN** hospedado, confirmada, pendente e concluída continuam distinguíveis

### Requirement: Acessibilidade dos componentes base
Todo controle SHALL ser um elemento nativo (`button`, `a`, `input`,
`select`) ou um componente Radix com o papel correto. Botões só com ícone
SHALL ter `aria-label`. O foco SHALL ficar visível em todos os controles. O
contraste de texto SHALL ser de pelo menos 4,5:1, inclusive em rótulos de 11
a 12 px.

#### Scenario: Navegar pelo teclado
- **WHEN** a recepção percorre o Hoje só com Tab
- **THEN** cada linha da tabela, as abas e os botões recebem foco visível, na ordem da leitura

### Requirement: Indicador sem dado não aparece
Um indicador SHALL aparecer só quando o dado dele foi carregado. Quando a
rota falha, a tela SHALL mostrar a mensagem de erro daquela parte, e não
zero. Quando o dado ainda não existe no sistema, o indicador MUST NOT
aparecer, nem com valor de exemplo.

#### Scenario: Falha no resumo financeiro
- **WHEN** `revenue-summary` responde erro para o gerente
- **THEN** a Gestão mostra "Não foi possível carregar os números financeiros" no lugar da receita, e os indicadores operacionais continuam

#### Scenario: Dado que ainda não existe
- **WHEN** o Hoje é aberto antes da change de saldo por reserva
- **THEN** o indicador "Cobrar hoje" não aparece
