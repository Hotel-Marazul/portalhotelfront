## Context

Fluxo atual:
1. `triage.worker.ts` chama `agents/whatsapp/triage.py`, que devolve a
   intenção e os fatos.
2. `signals.ts` soma os sinais do banco.
3. `scoring.ts` aplica a tabela fixa, mais as regras aprovadas (±25).
4. `queue.service.ts` soma a espera (até +30) a cada consulta.

O nível sai da nota: 70 ou mais é Agora, de 40 a 69 é Hoje, abaixo disso
Pode esperar.

A leitura só é refeita quando chega mensagem nova. Ou seja, uma conversa que
já está esperando mantém a nota antiga até o hóspede escrever de novo.

## Vocabulário

| Termo no texto | Campo da IA (JSON) | Sinal no backend |
|---|---|---|
| urgência | `urgency`: `alta` \| `normal` \| `baixa` | `urgency` |
| prazo hoje | `deadlineToday`: boolean | `deadline_today` |
| insatisfeito | `upset`: boolean | `upset` |
| trecho | `urgencyEvidence`: string ≤ 60 ou null | (só no motivo) |
| check-in próximo | (não vem da IA) | `checkin_soon` |

## Decisions

### A IA dá sinais, não nota
A nota continua sendo uma conta sobre sinais. Isso mantém:
- os motivos verificáveis;
- as regras do gerente valendo;
- a espera subindo a nota minuto a minuto;
- a fila funcionando quando a IA falha (fallback com urgência `normal`).

### Critérios de urgência por situação
O prompt descreve situações, e não palavras-gatilho:
- **alta**:
  - algo que impede o uso do quarto ou da estadia (sem água, luz ou chave,
    vazamento, porta);
  - saúde ou segurança;
  - hóspede parado na portaria ou chegando em menos de 2 horas sem
    confirmação.
- **baixa**:
  - mensagem que não pede nada ("ok, obrigado", "era só isso");
  - lead vago, sem data e sem pressa ("talvez no fim do ano", "só cotando").
- **normal**: todo o resto.

Escrever "URGENTE", "prioridade" ou "responde rápido" não muda a urgência.
O teste com mensagem maliciosa confere isso.

### Pesos propostos (a confirmar em "Decisões pendentes")

| Sinal | Peso |
|---|---|
| urgência alta | +15 |
| urgência baixa | −10 |
| prazo hoje | +10 |
| insatisfeito | +10 |
| **soma dos sinais da IA** | **teto −10 a +20** |
| check-in próximo (1 ou 2 dias, não soma com "chega hoje") | +10 |

Os dois tetos são independentes: o dos sinais da IA (−10/+20) e o das regras
(±25). O limite de 39 para fornecedor continua valendo.

Exemplos com esses pesos:

| Conversa | Conta | Nível |
|---|---|---|
| Hospedado: "estou sem água no quarto", 2 min | 55 + 15 + 15 + 2 = 87 | Agora (hoje: 72) |
| Hospedado: "pode trazer toalha?", 0 min | 25 + 15 = 40 | Hoje (igual) |
| "Tem vaga no réveillon?" sem datas, 0 min | 40 − 10 = 30 | Pode esperar (hoje: Hoje) |
| "URGENTE!!! quanto custa a diária?", 0 min | 30 | Pode esperar (igual) |
| Cancelamento, check-in amanhã, 0 min | 30 + 10 = 40 | Hoje (hoje: Pode esperar) |

### Motivo com trecho
- Urgência alta vira `Urgente: "{trecho}"`.
- Insatisfeito vira `Reclamação: "{trecho}"`.
- Prazo hoje vira `Precisa de resposta hoje`.
- Urgência baixa vira `Sem pressa`.

O trecho é cortado em 60 caracteres e sai da própria conversa, já visível
para a recepção. Ele não traz nenhum dado novo para a tela.

Com os sinais novos, a lista de 4 motivos fica mais disputada. A espera
SHALL ter sempre um lugar garantido, para não sumir.

### Sem migração
Os sinais vão no JSONB `whatsapp_ai_readings.signals`, que já é o que
`learning.service.ts` e `proposals.job.ts` leem. A condição das regras usa
`===`, então uma leitura antiga sem a chave simplesmente não casa.

### Compatibilidade do contrato
- No Python, `TriageResponse` tem `extra="forbid"`. Os campos novos entram
  com padrão (`normal`, `false`, `null`).
- No backend, o `z.object` do Zod descarta chaves desconhecidas sem dar
  erro. Por isso o schema SHALL declarar os campos novos com `.default()`.
  Sem isso, os sinais somem e ninguém percebe.
- O `fallbackReading` passa a devolver os valores neutros.

## Validação antes de ativar

São poucas conversas: 143 no total, 20 aguardando e 35 com leitura. Uma
semana em sombra não juntaria dados suficientes. Em vez disso, a comparação
é feita uma vez, com as conversas que já existem:

1. O script `backend/src/scripts/whatsapp-triage-compare.ts` roda a triagem
   nova sobre as últimas N conversas e calcula a nota atual e a nova.
2. O resultado é uma planilha CSV **fora do repositório**, com as colunas:
   - id da conversa;
   - intenção;
   - nível atual e nível novo;
   - urgência e trecho;
   - uma coluna vazia, "nível certo".
3. A recepção ou o gerente preenche "nível certo" em umas 30 linhas.
4. A change só é ativada se o nível novo acertar mais que o atual e não
   rebaixar nenhum problema durante a estadia.

O texto das mensagens não vai para o repositório (LGPD). Os testes
versionados usam só conversas inventadas.

## Risks / Trade-offs

- **IA inconsistente entre leituras**: os sinais são fechados e a
  temperatura é 0,1. O teto de +20 limita o estrago de um erro.
- **Hóspede tentando furar a fila**: o critério é por situação, há teste com
  mensagem maliciosa e o efeito tem teto.
- **Motivos demais**: o corte em 4 continua, com um lugar garantido para a
  espera.
- **Conversas já na fila mantêm a nota antiga**: ver re-triagem em
  "Decisões pendentes".

## Decisões tomadas (2026-10-27)

O usuário delegou as decisões abaixo.

1. **Pesos**: alta +15, baixa −10, prazo hoje +10, insatisfeito +10 e
   check-in próximo +10. São o ponto de partida. A comparação com conversas
   reais (tarefa 5) pode ajustá-los antes da ativação.
2. **Teto dos sinais da IA**: −10 a +20. Assim, a IA sozinha não leva uma
   pergunta de preço (30) até Agora (70) sem espera, mas consegue tirar um
   problema real do meio de Hoje.
3. **"Resolvida"**: não entra como sinal. "Ok, obrigado" já cai em
   `agradecimento` ou em urgência baixa. Um terceiro caminho para o mesmo
   caso só criaria conflito.
4. **Trecho no motivo**: mostrar a citação. "Urgente" sozinho repete a
   mesma opacidade que esta change quer evitar. Com o trecho, a recepção
   confere num relance e, se discordar, corrige a posição. O trecho já está
   na conversa, então a tela não ganha nenhum dado novo.
5. **Chave para desligar**: criar `WHATSAPP_URGENCY_SIGNALS`, com `on` como
   padrão. Custa uma linha e permite voltar à fila antiga sem deploy se a IA
   começar a errar em produção.
6. **Re-triagem na ativação**: sim. São cerca de 20 chamadas, uma vez só.
   Sem ela, a fila mistura notas antigas e novas por horas ou dias, e quem
   comparar não sabe qual conta valeu.
