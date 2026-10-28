## Why

O portal vai para produção e precisa guardar o histórico. Hoje, excluir hóspede, quarto ou categoria roda `DELETE FROM`, e o registro some de vez. Por isso o hóspede só pode ser excluído sem nenhuma reserva, e o quarto com estadias antigas esbarra na chave estrangeira. O gerente quer poder tirar qualquer cadastro de uso sem perder o que já aconteceu.

## What Changes

- Hóspede, quarto e categoria deixam de ser excluídos e passam a ser **desativados**. O registro fica no banco com quem desativou e quando.
- O gerente desativa e reativa. A recepção não vê os desativados nas listas.
- Um item desativado some de tudo que oferece escolha: nova reserva, disponibilidade, resumo de quartos, agenda, vínculo de contato do WhatsApp e preços e disponibilidade que a IA mostra. Reservas antigas, relatórios e o detalhe da reserva continuam mostrando o nome.
- Só dá para desativar sem compromisso futuro:
  - hóspede: sem reserva futura ou em casa;
  - quarto: sem reserva futura ativa;
  - categoria: sem quarto ativo.
- Cadastrar de novo um CPF, número de quarto ou nome de categoria que pertence a um registro desativado devolve 409 com o id dele, e a tela oferece reativar.
- As rotas `DELETE` antigas passam a desativar, para o frontend continuar funcionando. Entram rotas novas em kebab-case: `POST /api/clients/:id/deactivate|reactivate`, `POST /api/rooms/:id/deactivate|reactivate` e `POST /api/categories/:id/deactivate|reactivate`.

Fora do escopo: apagar ou anonimizar dados a pedido do hóspede (LGPD) fica para uma change futura.

## Capabilities

### New Capabilities

- `record-deactivation`: desativar e reativar cadastros sem perder histórico.

### Modified Capabilities

- `production-security`: a operação restrita ao admin passa de "excluir cliente" para "desativar hóspede, quarto e categoria".

## Impact

- **Backend:** `db/init.ts`, `modules/clients`, `modules/rooms`, `modules/categories`, `modules/reservations` (cotação, criação e edição), `modules/rooms/availability.service.ts`, `modules/whatsapp/facts.service.ts` e `contact-link.service.ts`.
- **Frontend:** `GuestProfile`, `RoomFormSheet`, `CategoriaSheet`, os formulários de cadastro (oferta de reativar) e um filtro "Mostrar desativados" para o gerente.
- **Testes:** `tests/integration/record-deactivation.test.ts` e a matriz de segurança.
