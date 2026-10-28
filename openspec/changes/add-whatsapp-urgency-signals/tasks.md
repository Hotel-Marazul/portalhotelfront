## 1. Contrato da leitura (agents)

- [ ] 1.1 Escrever testes em `agents/tests/test_whatsapp_schemas.py`:
  - campos novos com padrão neutro;
  - `urgencyEvidence` com mais de 60 caracteres é recusado;
  - leitura sem os campos novos continua válida.
- [ ] 1.2 Adicionar `urgency`, `deadline_today`, `upset` e
  `urgency_evidence` em `TriageResponse` (`schemas/whatsapp.py`), e cortar
  o trecho em `normalize_triage_output`.
- [ ] 1.3 Reescrever `prompts/whatsapp_triage.md` com os critérios de
  urgência por situação (ver `design.md`), incluindo a regra de ignorar
  palavras-gatilho.
- [ ] 1.4 Criar conversas inventadas (sem dados reais) para os casos:
  - falta de água;
  - pedido de toalha;
  - lead vago;
  - pedido completo com prazo hoje;
  - reclamação;
  - mensagem "URGENTE" sem situação urgente;
  - "ok, obrigado".

  Rodar contra o modelo real e conferir a urgência esperada em cada uma.
  É manual, porque gasta chamadas à IA.

## 2. Contrato no backend

- [ ] 2.1 Teste: o Zod de `agents-client.ts` aceita resposta sem os campos
  novos, preenche os padrões e não descarta os campos quando eles vêm.
- [ ] 2.2 Declarar os campos no `triageResponseSchema` com `.default()`.
- [ ] 2.3 Atualizar `fallbackReading` em `triage.worker.ts` com os valores
  neutros.

## 3. Sinais e pontuação

- [ ] 3.1 Escrever testes em `scoring.test.ts` com os cinco exemplos do
  `design.md`, o teto de +20, o piso de −10, fornecedor com urgência alta
  (continua ≤ 39) e a espera garantida entre os 4 motivos.
- [ ] 3.2 `QueueSignals` ganha `urgency`, `deadline_today`, `upset` e
  `checkin_soon`. Fazer o mesmo em `buildQueueSignals` (`signals.ts`),
  incluindo a consulta do check-in em 1 ou 2 dias.
- [ ] 3.3 `scoreConversation` ganha os pesos, o teto próprio e os motivos
  com trecho.
- [ ] 3.4 Garantir a espera entre os 4 motivos, tanto em `scoring.ts` quanto
  em `scoreFor` (`queue.service.ts`), que refaz a lista na consulta.
- [ ] 3.5 Criar `WHATSAPP_URGENCY_SIGNALS` em
  `config/env.ts`, com `on` como padrão. Com `off`, os pesos dos sinais da
  IA ficam zerados.

## 4. Aprendizado

- [ ] 4.1 Teste: uma leitura antiga sem as chaves não casa com as
  condições novas.
- [ ] 4.2 Adicionar ao `CONDITION_CATALOG` (`proposals.job.ts`):
  - "Urgência alta";
  - "Sem pressa";
  - "Precisa de resposta hoje";
  - "Hóspede insatisfeito";
  - "Check-in nos próximos 2 dias".

## 5. Comparação com conversas reais

- [ ] 5.1 Criar `backend/src/scripts/whatsapp-triage-compare.ts`:
  - entrada: últimas N conversas;
  - roda a triagem nova e calcula a nota atual e a nova, com espera zero;
  - grava um CSV num caminho passado por argumento, fora do repositório;
  - não grava nada no banco.
- [ ] 5.2 Rodar com cerca de 40 conversas e entregar o CSV para preencher a
  coluna "nível certo".
- [ ] 5.3 Comparar os acertos do nível atual com os do novo. Ativar só se o
  novo acertar mais e nenhum problema durante a estadia for rebaixado.
  Senão, ajustar os pesos e repetir.

## 6. Ativação e verificação

- [ ] 6.1 `cd backend && npm run build && npm test` e `cd agents && pytest`.
- [ ] 6.2 Marcar a re-triagem das conversas que
  estão aguardando (`triage_status = 'pending'`,
  `triage_requested_at = NOW()`).
- [ ] 6.3 Conferir a fila no navegador: os motivos aparecem, a espera
  continua visível e nada estoura a largura do card.
- [ ] 6.4 Atualizar `.mente/tecnico/arquitetura-decisoes.md` com a decisão
  "IA dá sinais, não nota".
