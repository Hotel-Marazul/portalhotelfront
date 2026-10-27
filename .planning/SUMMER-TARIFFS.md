# Tarifas operacionais de verão — Hotel Marazul

## Contrato autorizado em 2026-10-26

- Cadastrar as quatro categorias operacionais: Super Luxo, Luxo, Standard e Simples.
- Casal, só café / meia pensão: 528/638, 495/605, 473/583, 440/550 reais.
- Adicionais após as duas pessoas incluídas: 0–2 grátis; 3–5 R$100 por
  hospedagem; 6–11 R$120 por diária; 12+ R$200 por diária, nos dois regimes.
- Entrada 14h e saída 12h. Do dia 20 ao dia 25 são cinco diárias civis.
- Mínimo de estadia adiado pelo hotel: nenhuma restrição nova.
- Ativar para o próximo verão: 2026-12-01 até 2027-03-01 (fim exclusivo).
  Fora desse intervalo, não presumir preço para essas quatro categorias.
- Manter o contrato existente: a primeira pessoa é o cliente principal e o
  primeiro acompanhante completa a tarifa de casal. Não inferir tarifa individual
  promocional; quando ausente, permanece o fallback explícito para tarifa de casal.

## Implementação

1. Adicionar meia pensão e validade às categorias, e base de cobrança às regras
   etárias. Payloads antigos continuam aceitos; omissão significa só café.
2. Calcular tudo no backend, inclusive taxa por hospedagem e desconto. Persistir
   snapshot completo e fingerprint dos dados de precificação. Não recalcular
   leitura nem edição sem mudança nos dados financeiros da reserva.
3. Integrar formulários, tabela de categorias, cotações e fatos do WhatsApp.
   Não enviar mensagens externas em testes. Agentes continuam usando o backend.
4. Importar valores operacionais em transação e conferir dados. Preservar IDs,
   relações, reservas existentes e WIP não relacionado.

## Aceitação

- Casal Standard, cinco diárias: café R$2.365; meia pensão R$2.915.
- Mesmo casal + criança de 4 anos: R$2.465 / R$3.015 (taxa única de R$100).
- Criança de 8 anos acrescenta R$600; adicional de 12 anos acrescenta R$1.000.
- Rejeitar meia pensão sem tarifa, datas fora da validade, regra incompatível,
  excesso de capacidade e desconto acima do subtotal.
- Releitura e reenvio idempotente preservam preço; mudança de catálogo não altera
  snapshot de uma reserva sem mudança de seus dados financeiros.
- Testes unitários, integração PostgreSQL/HTTP, build/lint e navegador local.

## Inventário confirmado em 2026-10-27

| Categoria | Unidades reserváveis |
|---|---|
| Super Luxo | 201, 202, 203, 204, 205 |
| Luxo | 103, 104, 105, 122, 123, 131, 132 |
| Standard | 102, 106, 108, 110, 111, 121, 130 |
| Simples | 107, 109, 112, 113, 115/116, 117, 118, 119, 120 |

São 28 unidades reserváveis e 29 números físicos. O 115/116 é uma unidade
única para até cinco pessoas, também vendida para casal: `rooms.number=115`,
`connected_room_number=116`. Uma reserva bloqueia todo o conjunto. O índice
primário em `room_inventory_numbers` e o trigger de sincronização impedem
reutilizar o 116 em outra unidade, inclusive sob concorrência.

O 101 preexistente não consta da lista: foi preservado em manutenção, sem
excluir histórico. Capacidades confirmadas pelo hotel em 2026-10-27: o 102
acomoda duas pessoas; os outros quartos Standard, Simples, Luxo e Super Luxo
acomodam até quatro. O 115 sozinho acomoda casal; quando utilizado com o 116,
o conjunto acomoda até cinco. A reserva continua bloqueando o conjunto todo.
Não há capacidades pendentes de confirmação.

Importação explícita e idempotente: `node --import tsx src/db/import-marazul-rooms.ts`.
O snapshot anterior e as capacidades pendentes ficam em
`hotel_seasonal_rate_catalogs.payload.beforeRoomRosterImport/roomRosterImport`.

## Verificações locais

- Backend: 69 testes unitários e build TypeScript.
- Frontend: 34 testes e lint sem erros; build em diretório temporário separado
  do servidor de desenvolvimento (usar `NODE_ENV=production`).
- PostgreSQL/HTTP: oito suítes `reservation-*.test.ts` em banco descartável;
  cenários adicionais de tarifas, snapshots e inventário conjugado em bancos
  separados, sem criar reservas no banco operacional.
- Agente: `python tests/test_booking_flow.py`, incluindo meia pensão e a
  recusa de calcular totais a partir de tarifas brutas sem cotação do backend.
- Navegador local: 115/116, entrada 20/12/2026 e saída 25/12/2026, dois adultos
  e criança de quatro anos: café R$2.300 e meia pensão R$2.850, taxa única R$100.
  Cotação normaliza a seleção vazia da regra para `null`, sem relaxar validação
  de UUID do backend. Cenário reproduzido em teste RED/GREEN e no navegador,
  sem erros de console. Nenhuma reserva de teste foi gravada no banco do hotel;
  hóspede fictício removido e bancos descartáveis de integração excluídos.
