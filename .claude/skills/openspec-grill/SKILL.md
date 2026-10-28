---
name: openspec-grill
description: Entrevista em rodadas antes de abrir uma change nova em openspec/changes/. Use quando o usuário pedir uma feature, mudança de regra ou correção que ainda não tem change, antes de escrever proposal.md, design.md, specs ou tasks.md.
---

# Entrevista antes da change

Objetivo: chegar no proposal.md com todas as decisões tomadas. Nada de change escrita em cima de suposição.

## Passo a passo

1. **Investigue sozinho o que é fato.** Antes de perguntar qualquer coisa, leia em paralelo:
   - `openspec list` e `openspec list --specs`: existe change ou spec que já cobre isso?
   - `openspec/specs/<capability>/spec.md` das capabilities tocadas;
   - `.mente/dominio/` e `.mente/tecnico/` sobre o assunto;
   - o código envolvido (rotas, componentes, tabelas, `calculateReservationTotal` se mexer em preço).

   Nunca pergunte ao usuário algo que o repositório responde ("qual a tabela?", "qual o endpoint?").

2. **Separe o que sobrou em decisões.** Só pergunte o que depende de negócio, prioridade ou gosto:
   - quem usa (recepção = `receptionist`, gerente = `admin`) e em que tela;
   - regra de negócio em caso limite (cancelamento, sobreposição, hóspede adicional, estorno);
   - o que fica de fora (não-objetivos);
   - como saber que ficou pronto (o cenário que o usuário testaria na mão).

3. **Pergunte em rodadas.** Cada rodada traz só as perguntas cuja resposta não depende de outra pergunta ainda aberta. Numere, e dê a sua recomendação em cada uma ("Recomendo X porque..."). Use `AskUserQuestion` quando forem 1 a 4 escolhas fechadas. Espere a resposta antes da próxima rodada.

4. **Resuma e confirme.** Quando não houver decisão aberta, mostre um bloco curto com:
   - o que muda, em uma frase;
   - as decisões tomadas, uma por linha;
   - o que fica de fora;
   - os cenários (WHEN/THEN) que vão virar spec.

   Só siga depois de um "sim" explícito.

5. **Abra a change.** Use o nome kebab-case (`add-…`, `harden-…`, `fix-…`) e escreva proposal, design (se houver decisão técnica), specs e tasks conforme `openspec instructions <artifact> --change <nome>`. Em `tasks.md`, cada tarefa é um passo que vira um commit no master. Rode `openspec validate <nome> --strict` e commite o plano (`docs(openspec): plan …`).

## Regras

- Vocabulário único: use os termos que já estão em `.mente/dominio/` e nas specs. Se um termo novo surgir, registre em `.mente/dominio/` na mesma change.
- Pedido pequeno e óbvio (texto, cor, bug com causa clara)? Diga isso e pule a entrevista. Ela existe para decisões, não para cerimônia.
