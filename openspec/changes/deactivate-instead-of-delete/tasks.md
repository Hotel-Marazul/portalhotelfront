## 1. Banco

- [x] 1.1 `active`, `deactivated_at` e `deactivated_by` em `clients`, `rooms` e `categories` no `initializeDatabase`.

## 2. Desativar e reativar

- [x] 2.1 Serviço de desativação com as travas (hóspede, quarto, categoria), rotas kebab-case só para admin e as `DELETE` legadas apontando para ele. Nenhum `DELETE FROM` nessas tabelas.
- [x] 2.2 Listas com `active` e `includeInactive=true` só para admin; cadastro com valor de desativado devolve 409 `inactive_duplicate`.

## 3. Não oferecer desativado

- [x] 3.1 Disponibilidade, resumo de quartos e agenda filtram quarto e categoria ativos.
- [x] 3.2 Cotação, criação e edição de reserva recusam quarto, categoria ou hóspede desativado (edição mantém o que a reserva já tinha).
- [x] 3.3 IA (`buildConversationFacts`) e vínculo de contato do WhatsApp ignoram desativados.

## 4. Frontend

- [ ] 4.1 "Excluir" vira "Desativar" em hóspede, quarto e categoria; filtro "Mostrar desativados" e botão "Reativar" para o gerente.
- [ ] 4.2 Cadastro com 409 `inactive_duplicate` oferece reativar o registro existente.

## 5. Testes e documentação

- [ ] 5.1 `tests/integration/record-deactivation.test.ts` cobrindo os cenários da spec; matriz de segurança com as rotas novas.
- [ ] 5.2 Atualizar `.mente/dominio/reservas-regras-negocio.md`.
