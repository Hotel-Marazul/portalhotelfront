## Why

O redesign (`redesign-portal-interface`) deixou duas lacunas porque o backend não tinha rota:
- Tarifas mostra as regras de hóspede adicional só para leitura. O gerente não consegue criar nem corrigir uma regra sem mexer no banco.
- A ficha do hóspede não tem como excluir um cadastro feito por engano. O modo "excluir" do `ModalHospede` antigo nunca chegou a apagar nada.

## What Changes

- `POST /api/pricing-rules` e `PUT /api/pricing-rules/:id`, só para `admin`, com validação Zod.
- Em Tarifas, "Nova regra" e "Editar" nas regras de hóspede adicional, só para o gerente.
- `DELETE /api/client/:id`, que só exclui cliente sem reservas e responde 409 quando há reservas.
- Na ficha do hóspede, "Excluir" com confirmação, só quando o hóspede não tem estadias.

## Capabilities

### New Capabilities

- `rates-admin`: criar e editar regras de hóspede adicional.
- `guest-removal`: excluir hóspede sem reservas.

## Impact

- **Backend:** `modules/pricing-rules/` e uma rota nova de clientes num arquivo próprio, montada em `routes/index.ts`. Sem mudança de tabela.
- **Frontend:** `components/categorias/` e a tela de Hóspedes.
- **Reservas existentes:** editar uma regra não muda o total de reservas já criadas (o total fica gravado na reserva).
