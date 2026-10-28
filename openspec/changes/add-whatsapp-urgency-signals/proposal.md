## Why

Hoje a fila do WhatsApp dá a mesma nota para toda conversa com a mesma
intenção. "Pode trazer uma toalha?" e "estou sem água no quarto" valem os
mesmos 55 pontos. "Tem vaga no réveillon?" e "quero fechar hoje 2 adultos de
10 a 14/01" começam os dois em 40. A IA já lê a conversa inteira e percebe
essa diferença, mas não tem onde registrar.

Os dados atuais apontam o mesmo problema:
- as 16 leituras de `reserva_nova` estão todas em Hoje, porque 40 é
  exatamente o limite desse nível;
- das 4 correções feitas pela recepção, todas em `reserva_nova`, 2 pedem
  para descer, 1 para subir e 1 confirma.

Quatro votos não provam nada. Por isso, esta change exige uma comparação
feita antes de ativar (ver `design.md`).

## Como funciona na prática

1. O hóspede manda mensagem e a triagem roda como hoje, com a mesma chamada
   à IA.
2. Além da intenção, das datas e das pessoas, a IA devolve três sinais
   fechados:
   - **urgência**: alta, normal ou baixa;
   - **prazo hoje**: sim ou não;
   - **insatisfeito**: sim ou não.

   Junto vem um **trecho** curto da conversa que justifica a resposta.
3. O backend soma um sinal próprio, sem IA: **check-in próximo**, quando o
   hóspede tem reserva ativa com check-in em 1 ou 2 dias.
4. A conta da nota continua no `scoring.ts`, e a IA não dá nota. Cada sinal
   tem peso fixo, e a soma dos sinais da IA tem teto próprio: −10 a +20.
5. Na fila, o motivo aparece como texto, por exemplo
   `Urgente: "estou sem água no quarto"`.
6. O gerente pode aprovar regras sobre os sinais novos (por exemplo,
   "Insatisfeito +10"), pelo mesmo fluxo de aprendizado que já existe.

## Capability map

| Capability | Responsabilidade | Depende de |
|---|---|---|
| `whatsapp-ai-triage` | Leitura com sinais de urgência, peso fixo por sinal, teto dos sinais da IA, motivo com trecho | change `add-whatsapp-reception-inbox` (base ainda não arquivada) |

## What Changes

- A resposta da triagem (Python e Zod) ganha `urgency`, `deadlineToday`,
  `upset` e `urgencyEvidence`. Os campos são opcionais e têm padrão neutro,
  para que leituras antigas e o fallback continuem válidos.
- O prompt de triagem define a urgência por **situação**, não por palavras.
  Escrever "URGENTE" não muda o resultado.
- O backend passa a calcular `checkin_soon`.
- O `scoring.ts` ganha os pesos dos sinais novos, com teto próprio separado
  do teto de ±25 das regras.
- O catálogo de condições do aprendizado ganha os sinais novos.
- Um script compara, com conversas reais, o nível atual e o nível novo, sem
  gravar o texto das mensagens no repositório.

## Non-goals

- A IA devolver nota ou nível. A pontuação continua determinística.
- Uma chamada nova à IA, ou um modelo diferente.
- Mudar os limites dos níveis (70 e 40) ou o peso da espera.
- Mudar a interface além do texto dos motivos.

## Impact

- **agents:** `schemas/whatsapp.py`, `prompts/whatsapp_triage.md` e testes de
  schema.
- **backend:** `agents-client.ts`, `triage.worker.ts` (fallback),
  `signals.ts`, `scoring.ts`, `proposals.job.ts` e testes.
- **Banco:** sem migração. Os sinais ficam em
  `whatsapp_ai_readings.signals` (JSONB). Nas leituras antigas falta a
  chave, então nenhuma regra nova casa com elas, e é esse o comportamento
  certo.
- **Custo:** a mesma chamada à IA, com algumas dezenas de tokens a mais na
  saída.
