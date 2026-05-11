---
tags: [dominio, reservas, pricing, regras-negocio]
---

# Reservas — Regras de Negócio

## Ciclo de vida de uma reserva

```
Disponibilidade verificada
        ↓
Reserva criada (status: Pendente)
        ↓
Check-in realizado (status: Ativa / Em andamento)
        ↓
Check-out realizado (status: Concluída)

Alternativas:
  → Cancelamento em qualquer etapa → status: Cancelada
  → No-show → status: (não mapeado explicitamente)
```

## Status possíveis

| Status | Código | Descrição |
|--------|--------|-----------|
| Pendente | `Pendente` | Reserva confirmada, aguardando check-in |
| Confirmada | `Confirmada` | Alias de Pendente (verificar consistência) |
| Em andamento | `Em andamento` | Hóspede no quarto (pós check-in) |
| Concluída | `Concluída` | Check-out realizado (também aceita `Concluida` sem acento) |
| Cancelada | `Cancelada` | Reserva cancelada |

**Atenção:** `Concluida` (sem acento) e `Concluída` (com acento) são tratados como equivalentes em todo o stack — ver normalização em `backend/src/utils/reservation.ts` e `frontend/src/utils/roomStatus.ts`.

## Cálculo de preço total

**Arquivo:** `backend/src/utils/reservation.ts` — função `calculateReservationTotal()`

```
preço_total = diárias × (valor_base_quarto + extras_hóspedes)

extras_hóspedes = soma de:
  para cada hóspede a partir do índice 1 (primeiro hóspede é SEMPRE incluído):
    valor_diária × numero_noites
  onde valor_diária vem da pricing_rule do tipo daquele hóspede
```

**Constante:** `INCLUDED_ADDITIONAL_GUESTS = 1` — primeiro hóspede sempre gratuito.

**Pricing rules:** tabela `pricing_rules` no banco, campos relevantes:
- `guest_type` — tipo do hóspede (ex: "Adulto", "Criança", "Bebê")
- `additional_price` — valor cobrado por noite para esse tipo
- `is_free` — flag que zera o custo independente do tipo

## Verificação de disponibilidade

**Arquivo:** `backend/src/modules/reservations/reservations.routes.ts` — `ensureRoomIsAvailable()`

Lógica: busca reservas que se sobrepõem ao intervalo `[check_in, check_out)` para o mesmo `room_id`. Considera ativas as reservas com status ≠ `Cancelada`.

**Bug crítico conhecido:** verificação e inserção são operações separadas — sem lock de transação há risco de overbooking em requisições concorrentes. Ver [[../bugs/bugs-conhecidos#overbooking]].

## Hóspedes

Cada reserva pode ter múltiplos hóspedes. Tabela `reservation_guests`:
- Referencia a reserva via `reservation_id`
- Tem `guest_type` para lookup na `pricing_rules`
- Dados opcionais: nome, CPF, data de nascimento

**Bug crítico:** INSERT de hóspedes sem transação — crash parcial deixa reserva sem hóspedes. Ver [[../bugs/bugs-conhecidos#sem-transacao]].

## Regras de negócio implícitas (descobertas no código)

1. Quarto bloqueado para manutenção não deve aparecer na disponibilidade
2. Uma reserva ativa bloqueia o quarto para qualquer outra reserva no mesmo período
3. O preço é calculado no momento da criação/edição — não fica "preso" à pricing rule histórica
4. Quartos têm uma única categoria — o preço base vem da categoria

## Perguntas em aberto

- [ ] Qual o comportamento esperado quando um hóspede faz no-show?
- [ ] Há alguma política de cancelamento com multa? Como é calculada?
- [ ] Reservas podem ter desconto manual? Há um campo para isso?
- [ ] O "primeiro hóspede incluído" aplica-se a bebês também?
