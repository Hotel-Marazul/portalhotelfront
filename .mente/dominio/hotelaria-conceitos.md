---
tags: [dominio, hotelaria, conceitos]
---

# Hotelaria — Conceitos Fundamentais

## Terminologia do domínio

| Termo | Significado no contexto |
|-------|------------------------|
| **Check-in** | Chegada do hóspede e início da ocupação do quarto |
| **Check-out** | Saída do hóspede e liberação do quarto |
| **Diária** | Unidade de cobrança (1 dia de hospedagem) |
| **Reserva** | Compromisso de disponibilidade de quarto para um período |
| **Hóspede** | Pessoa que ocupa o quarto (pode ser diferente do titular da reserva) |
| **Titular** | Cliente que faz a reserva (cadastrado no sistema) |
| **Categoria** | Classificação do quarto (ex: Standard, Superior, Suíte) |
| **Ocupação** | Percentual de quartos ocupados em um período |
| **Taxa de ocupação** | `quartos_ocupados / total_quartos × 100` |
| **RevPAR** | Revenue Per Available Room — receita / quartos disponíveis |
| **ADR** | Average Daily Rate — diária média |
| **No-show** | Hóspede com reserva que não compareceu |

## Cálculo de noites

```
noites = checkout_date - checkin_date (em dias)

Exemplo:
  check-in: 2026-05-10
  check-out: 2026-05-12
  noites: 2
```

**Implementação:** `frontend/src/utils/format.ts` → `calculateNights(checkIn, checkOut)`

## Ocupação e disponibilidade

Um quarto está **disponível** quando não há reserva ativa (não cancelada) que se sobreponha ao período solicitado.

**Sobreposição de datas:**
```
Reserva A: [check_in_A, check_out_A)
Reserva B: [check_in_B, check_out_B)

Conflito quando: check_in_A < check_out_B AND check_out_A > check_in_B
```

**Estados operacionais de quarto:**
- `Disponível` — livre para reserva
- `Ocupado` — hóspede presente
- `Reservado` — reserva futura confirmada
- `Manutenção` — bloqueado para serviços
- `Limpeza` — aguardando preparação

## Pricing em pequenos hotéis

Modelos comuns:
1. **Preço fixo por quarto** — valor flat independente do número de hóspedes
2. **Preço base + adicional por hóspede** — modelo implementado no PortalHotel
3. **Preço por pessoa** — valor multiplicado pelo número de pessoas

**Modelo implementado no PortalHotel:**
```
total = valor_base_categoria × noites
      + soma(adicional por hóspede × noites) para hóspedes a partir do 2º
```

Primeiro hóspede sempre incluído no valor base.

## Tipologia de hóspedes

Categorias típicas e suas cobranças:
- **Adulto** — cobrança padrão
- **Criança** — frequentemente com desconto ou gratuidade até certa idade
- **Bebê** — frequentemente gratuito (abaixo de 2-3 anos)
- **Idoso** — pode ter desconto dependendo da política

No PortalHotel: definido via tabela `pricing_rules` com `guest_type` e `additional_price`.

## Boas práticas para pequenos hotéis

### Reservas
- Evitar overbooking a todo custo — dano à reputação imediato
- Confirmação por e-mail é esperada pelo hóspede
- Política de cancelamento clara (com ou sem multa)

### Dashboard operacional
- Taxa de ocupação por mês/semana — indicador principal
- Quartos em manutenção reduzem capacidade disponível
- Check-ins e check-outs do dia — visão operacional imediata

### Dados de qualidade
- CPF do hóspede: obrigatório para emissão de nota fiscal em alguns estados brasileiros
- Histórico de reservas por cliente: fundamental para fidelização
