# Plano: tarifa manual por reserva

Este plano segue o fluxo incremental adotado pelo projeto e usa fatias
verticais. O padrão `.planning/` existente foi preservado; nenhum plano já
existente será sobrescrito.

## Fatia 1 — domínio e contrato

- Criar tipos de precificação e uma função pura para noites, tarifa-base,
  adicionais, desconto e detalhamento.
- Cobrir calendário, limite de idade, uma/duas/três pessoas, tarifa manual e
  valores monetários sem `totalPrice` vindo do cliente.
- Ajustar o contrato Zod de criação/edição com `dailyRateOverride`,
  `discountAmount` e `priceOverrideReason` opcionais.

Checkpoint: build do backend e testes determinísticos da função pura.

## Fatia 2 — expansão persistente

- Adicionar tarifas `single_price`/`couple_price` às categorias, mantendo
  `price` legado e preenchimento compatível.
- Adicionar snapshot/auditoria de precificação às reservas.
- Atualizar seed e consultas de categorias/quartos sem apagar dados existentes.

Checkpoint: build e inspeção da migração idempotente; nenhuma tabela de agente é
alterada.

## Fatia 3 — API de reservas

- Selecionar categoria e regras no backend, derivar ocupação e escolher a
  tarifa correta no servidor.
- Persistir a diária efetiva e devolver detalhamento de preço.
- Aplicar o mesmo cálculo em POST e PUT dentro da transação atual, preservando
  a proteção contra sobreposição.

Checkpoint: build e testes manuais com banco disponível; testar entrada/saída
adjacentes e rejeição de tarifa ausente.

## Fatia 4 — categorias e telas de reserva

- Expor/cadastrar defaults de solteiro e casal.
- Enviar datas de calendário, não `toISOString()` de meia-noite.
- Incluir na reserva a diária editável, desconto opcional, motivo e resumo do
  cálculo; preservar fallback para respostas antigas.

Checkpoint: lint/build do frontend e revisão visual funcional das telas de nova
reserva, edição e consulta.

## Fatia 5 — fechamento

- Revisar diff e confirmar que os caminhos excluídos não foram tocados.
- Rodar verificações finais e separar qualquer arquivo pré-existente não
  relacionado.
- Registrar decisões e preparar commits pequenos, sem incluir
  `.planning/ANALISE-WHATSAPP-OBSERVABILIDADE.md` nem `AGENTS.md`.

## Decisões de segurança e escala

- O preço manual é um override da diária, nunca do total.
- SQL continua parametrizado e a fonte de preço é resolvida no backend.
- Money é persistido em `NUMERIC(10,2)` e convertido somente na borda da API.
- Motivo e usuário responsável acompanham o override.
- A migração é expand/compatível; uma futura limpeza dos campos legados fica
  separada e só ocorrerá após clientes antigos migrarem.
