Regras para todas as tarefas:
- não editar `backend/src/db/init.ts` nem `backend/src/modules/clients/clients.routes.ts`: há mudanças de outra sessão em andamento neles;
- teste para a lógica nova (backend: `node --import tsx --test`, arquivos `*.test.ts`; frontend: `node --test` em `frontend/tests`);
- `npm run build` no backend e `npm run lint` no frontend ao fim de cada seção.

## 1. Regras de hóspede adicional

- [ ] 1.1 Schema Zod (`pricing-rules.schema.ts`) com nome, descrição, idade mínima e máxima (máxima ≥ mínima), valor ≥ 0 e cobrança (`per_daily` ou `per_stay`), com teste.
- [ ] 1.2 `POST /pricing-rules` e `PUT /pricing-rules/:id` com `requireRole("admin")`, nome repetido vira 409 e regra inexistente vira 404.
- [ ] 1.3 Conferir que editar uma regra não recalcula reservas já criadas.
- [ ] 1.4 Em Tarifas, "Nova regra" e "Editar" por regra num `Sheet`, só para `admin`, com as mensagens do backend.

## 2. Excluir hóspede

- [ ] 2.1 `DELETE /client/:id` em arquivo próprio (`clients-delete.routes.ts`), dentro de transação com `FOR UPDATE`: 404 se não existe, 409 "Hóspede com reservas não pode ser excluído." se tem reservas; desvincula contatos do WhatsApp antes de apagar.
- [ ] 2.2 Teste da regra de exclusão.
- [ ] 2.3 Na ficha do hóspede, "Excluir" com `ConfirmDialog`, só quando não há estadias; ao excluir, a lista recarrega e a ficha fecha.
