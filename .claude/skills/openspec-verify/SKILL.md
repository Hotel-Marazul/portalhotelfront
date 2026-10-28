---
name: openspec-verify
description: Confere spec × código de uma change do OpenSpec, item por item, com testes executados, e grava openspec/changes/<change>/verification.md. Use quando todas as tarefas de uma change estiverem marcadas, antes de `openspec archive`, ou quando o usuário pedir para validar ou fechar uma change.
---

# Verificar change antes de arquivar

Objetivo: provar que cada requisito e cenário da change existe no código e foi testado. "Deve funcionar" não vale; vale o comando rodado e a saída dele.

## Passo a passo

1. **Estado da change.**
   - `node scripts/openspec-audit.mjs <change>`: nenhuma FALHA, e anote os avisos.
   - `openspec show <change>` e leia `specs/*/spec.md`, `design.md` e `tasks.md`.
   - Se houver tarefa `[ ]`, pare e diga quais faltam.

2. **Cada requisito e cada cenário.** Para cada `### Requirement` e cada `#### Scenario`:
   - ache onde está implementado (`arquivo:linha`);
   - ache o teste que cobre o cenário, ou registre "sem teste" e por quê;
   - marque: ✅ implementado e testado · ⚠️ implementado sem teste · ❌ não implementado ou divergente.

   Leia o código de verdade. Não deduza pelo nome da tarefa.

3. **Rode os testes de quem a change tocou.**
   - backend: `cd backend && npm run build && npm test`
   - frontend: `cd frontend && npm run lint && npm run test:reservation` (roda `tests/*.test.mjs`)
   - backend com banco: `cd backend && npm run test:integration:db`. Precisa do Postgres no ar (`docker compose up db-marazul`). Se não der para subir, registre isso. Não marque como passou.

   Guarde o comando, se passou ou falhou e as linhas de resumo da saída.

4. **Escreva `openspec/changes/<change>/verification.md`:**

   ```markdown
   # Verificação: <change>

   Data: AAAA-MM-DD · Commit: <sha curto do HEAD>

   ## Resultado
   APROVADA | APROVADA COM RESSALVAS | REPROVADA, com uma frase do porquê.

   ## Requisitos
   | Requisito / cenário | Onde | Teste | Status |
   |---|---|---|---|

   ## Testes executados
   - `comando` → passou (N testes) | falhou: resumo

   ## Ressalvas
   - o que ficou ⚠️, o aviso do audit e o que não deu para rodar
   ```

   Qualquer ❌ deixa a change REPROVADA. Nesse caso, diga o que falta e não arquive.

5. **Feche.** Rode `openspec validate <change> --strict` de novo e commite só o `verification.md` (`docs(openspec): verify <change>`). Arquive (`openspec archive <change>`) apenas se o usuário pedir.
