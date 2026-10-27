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
