## 1. Baseline e testes de caracterização

- [x] 1.1 Registrar o estado do banco e dos contratos atuais sem mutação, incluindo constraints, contagens por status, sobreposições, pagamentos acima do total e timestamps amostrais; verificar que o relatório é reproduzível e não executa `INSERT`, `UPDATE` ou `DELETE`.
- [x] 1.2 Adicionar testes de integração inicialmente vermelhos para cancelamento lógico, preservação de hóspedes/pagamentos e ausência de hard delete; verificar que eles reproduzem o comportamento incorreto antes da correção.
- [x] 1.3 Adicionar testes de concorrência inicialmente vermelhos para atualização perdida, criação sobreposta e pagamento simultâneo; verificar que cada teste usa duas conexões reais e termina de forma determinística.
- [x] 1.4 Adicionar testes de contrato inicialmente vermelhos para transições, filtros inválidos, último dia inclusivo, capacidade, agregados financeiros e datas no fuso do hotel; verificar que cada cenário dos specs críticos possui cobertura identificável.

## 2. Evolução aditiva do banco e auditoria

- [x] 2.1 Adicionar versão da reserva e tabela append-only de eventos com ator, ação, estado anterior/novo, motivo, correlação e instante; verificar inicialização idempotente em banco vazio e banco existente.
- [x] 2.2 Adicionar chave de idempotência, tipo de lançamento, autoria e referência de reversão aos pagamentos, com índices e constraints compatíveis com linhas legadas; verificar migração e unicidade concorrente no PostgreSQL.
- [x] 2.3 Criar diagnóstico dry-run para timestamps, status vencidos e excessos financeiros existentes; verificar que o resultado mostra antes/depois ou diferença e que nenhuma linha é modificada.
- [x] 2.4 Confirmar após a evolução que `reservations_no_overlapping_stays` continua ativa e usa intervalo `[)` para todo status diferente de `Cancelada`; verificar com consulta ao catálogo e teste de conflito real.

## 3. Tempo, datas e máquina de estados

- [x] 3.1 Implementar a fronteira única de datas civis e horários operacionais com `HOTEL_TIMEZONE=America/Sao_Paulo`; verificar testes em processos configurados com pelo menos dois fusos de sistema diferentes.
- [x] 3.2 Centralizar o cálculo de noites por datas civis e revisar o preço para consumir essa função; verificar casos de uma noite, seis noites, troca no mesmo dia e limites de mês.
- [x] 3.3 Implementar a máquina de estados, regras temporais e detecção de pendências vencidas em serviço testável; verificar todas as transições válidas, saltos, regressões e estados terminais.
- [x] 3.4 Expor comando kebab-case de transição com versão otimista e autoria; verificar respostas de sucesso, 400, 401/403 e 409 por versão ou transição inválida.

## 4. Ciclo de vida, disponibilidade e cancelamento

- [x] 4.1 Centralizar criação e edição de reserva em transações que bloqueiam reserva/quarto, recalculam preço e validam datas, capacidade e disponibilidade; verificar rollback completo em falha de hóspede e corrida de sobreposição.
- [x] 4.2 Implementar `POST /api/reservations/:id/cancel` com versão, motivo e evento auditável, sem revalidar disponibilidade para apenas cancelar; verificar que dados associados permanecem e o quarto é liberado.
- [x] 4.3 Adaptar a rota legada `DELETE /api/Reservations/:id` ao mesmo cancelamento lógico e remover qualquer caminho público de `DELETE FROM reservations`; verificar por teste de rota e busca estática no módulo de reservas.
- [x] 4.4 Fazer a disponibilidade aplicar simultaneamente intervalo `[)`, manutenção, status e `guestCount`; verificar que grupos acima da capacidade recebem zero opções e que reservas adjacentes continuam permitidas.
- [x] 4.5 Expor versão e metadados mínimos de auditoria nos DTOs autorizados sem vazar dados internos; verificar snapshots/contratos de lista e detalhe.

## 5. Pagamentos consistentes

- [x] 5.1 Implementar serviço transacional de pagamento com lock da reserva, soma autoritativa, limite pelo saldo e chave de idempotência; verificar pagamento exato, parcial, duplicado, acima do saldo e duas requisições concorrentes.
- [x] 5.2 Remover a promoção implícita de status baseada na etapa de pagamento; verificar que `Confirmacao`, `CheckIn` e `CheckOut` não alteram o status da reserva.
- [x] 5.3 Implementar lançamento compensatório auditado sem edição ou exclusão do original; verificar reversão total/parcial, limite acumulado e rejeição para referência inválida.
- [x] 5.4 Acrescentar `totalPaid` e `balanceDue` aos detalhes e respostas de pagamento usando decimal estável; verificar que saldo nunca fica negativo e coincide com consulta SQL independente.

## 6. Consultas, paginação e indicadores

- [x] 6.1 Criar schemas de query para reservas, disponibilidade e clientes com allowlists e limites; verificar que entradas inválidas retornam 400 estruturado e nunca 500.
- [x] 6.2 Corrigir filtros de data para limites civis inclusivos no fuso do hotel e fim exclusivo no dia seguinte; verificar registros no começo, meio e fim da data final.
- [x] 6.3 Implementar paginação e busca estáveis de reservas e clientes com total e teto de página; verificar acesso a registro após a centésima posição e ordenação determinística entre páginas.
- [x] 6.4 Recalcular check-ins, check-outs, reservas ativas e pendências vencidas com status corretos; verificar que canceladas não entram e vencidas aparecem somente como exceção.
- [x] 6.5 Recalcular ocupação em quarto-noites civis com interseção do período; verificar o resultado contra conjunto manual contendo estadia cruzando mês e horários operacionais diferentes.
- [x] 6.6 Separar contratos de receita reservada e recebimentos por data de pagamento; verificar reserva sem pagamento, pagamento de reserva antiga e cancelamento.

## 7. Interface de reservas

- [x] 7.1 Atualizar tipos e cliente HTTP para versão, cancelamento, transições, idempotência, saldo, paginação e erros estruturados; verificar compilação TypeScript e testes de contrato mockado.
- [x] 7.2 Alterar o modal para falhar fechado na disponibilidade, revalidar seleção após mudança e preservar formulário em conflito; verificar testes de rede, autenticação, capacidade e quarto tomado concorrentemente.
- [x] 7.3 Substituir a lista fixa de clientes por busca remota paginada com loading, vazio, erro e sem permissão; verificar seleção de cliente além dos cem primeiros.
- [x] 7.4 Atualizar o drawer para manter-se aberto após pagamento, mostrar total/pago/saldo e renderizar erros financeiros específicos; verificar pagamento parcial, idempotente e acima do saldo.
- [x] 7.5 Impedir submissões simultâneas e manter a mesma chave idempotente nas retentativas da mesma intenção; verificar duplo clique e timeout simulado.
- [x] 7.6 Remover CPF completo de lista, agenda, busca e erros, restringindo detalhe por papel; verificar testes de renderização e busca estática por campos sensíveis nos componentes de coleção.
- [x] 7.7 Validar agenda e lista no fuso do hotel e no check-out exclusivo, sem zoom global ou overflow regressivo; verificar testes de timeline e inspeção responsiva desktop/mobile.

## 8. Segurança e confirmação dos agentes

- [x] 8.1 Adicionar gateway autenticado no backend para o chat e proteger endpoints operacionais do FastAPI com credencial interna; verificar 401 sem credencial, 403 sem permissão e fluxo autorizado ponta a ponta.
- [x] 8.2 Implementar identidade técnica `agents-service` com segredo obrigatório, comparação segura, allowlist e auditoria do usuário iniciador; verificar token ausente/inválido, operação fora do escopo e rotação de configuração.
- [x] 8.3 Modelar proposta de mutação com hash, validade e estado de confirmação; verificar que nenhuma escrita ocorre antes da confirmação e que mudança de quarto, data, hóspedes ou preço a invalida.
- [x] 8.4 Tornar mutações do agente idempotentes e propagar o resultado real do backend; verificar timeout/retry sem duplicação e falha do backend sem resposta falsa de sucesso.
- [x] 8.5 Corrigir o contrato de hóspedes e capacidade entre conversa, disponibilidade, preço e criação; verificar grupo acima da capacidade e dados adicionais incompletos.
- [x] 8.6 Migrar cancelamento do agente para o comando lógico e remover o uso de hard delete; verificar preservação integral do histórico via teste integrado.
- [x] 8.7 Sanitizar prompts, respostas e logs contra CPF completo, pagamentos, cookies e credenciais; verificar testes automatizados com sentinelas sensíveis e inspeção dos logs gerados.

## 9. Dependências e documentação

- [x] 9.1 Atualizar dependências vulneráveis do backend em lote compatível e regenerar o lockfile; verificar build, testes e auditoria sem vulnerabilidade crítica ou alta alcançável no runtime, documentando qualquer exceção.
- [x] 9.2 Atualizar Next.js, Axios e dependências vulneráveis do frontend em lote compatível e regenerar o lockfile; verificar build, lint, testes e auditoria sem vulnerabilidade crítica ou alta alcançável no runtime, documentando qualquer exceção.
- [x] 9.3 Atualizar `.mente/dominio/reservas-regras-negocio.md`, ADRs, inventário de bugs e estado do planejamento com o comportamento efetivamente entregue; verificar ausência de referências obsoletas a transação, status, campos ou overbooking.
- [x] 9.4 Documentar variáveis de ambiente e contratos novos sem valores secretos; verificar que exemplos contêm apenas nomes, formatos e instruções de geração segura.

## 10. Validação integrada e rollout

- [x] 10.1 Executar builds, lint e suítes de backend, frontend e agents em ambiente limpo; verificar saída verde e registrar versões/quantidades de testes.
- [x] 10.2 Executar matriz com PostgreSQL real para reservas adjacentes, corrida sobreposta, alteração concorrente, cancelamento com histórico, pagamento concorrente e reversão; verificar invariantes diretamente no banco após cada cenário.
- [x] 10.3 Validar no ambiente Compose local usado como staging-equivalente filtros do último dia, fuso do hotel, seis noites, ocupação, receita reservada, recebimentos e pendências vencidas; verificar resultados contra cálculo manual documentado. Staging externo continua sendo gate de promoção.
- [x] 10.4 Validar UI desktop/mobile e agente autenticado, incluindo estados de erro, busca acima de cem clientes e confirmação antes de mutação; verificar evidência funcional sem dados pessoais reais.
- [x] 10.5 Executar novamente o diagnóstico de dados legados e apresentar o dry-run para aprovação; verificar que nenhuma correção de timestamps, status ou excesso pago ocorreu sem decisão explícita.
- [x] 10.6 Preparar plano de rollback por imagem e feature flag das mutações do agente, sem rollback destrutivo de dados; verificar o procedimento no Compose local usado como staging-equivalente antes da promoção. Staging externo continua sendo gate de promoção.

## Evidências de fechamento local — 2026-09-14

- **3.4:** `DB_HOST=127.0.0.1 DB_PORT=5433 npm run test:integration:db`; `reservation-transition.test.ts` passou sucesso, `400`, `401` e `409`, com versão, evento e idempotência.
- **6.3:** a suíte `reservation-pagination.test.ts` passou com 105 clientes e 105 reservas filtrados, acesso à segunda página e duas leituras determinísticas.
- **6.5–6.6:** `reservation-reporting.test.ts` passou com estadia civil de seis noites cruzando mês, quarto-noites manuais (3 no mês atual e 4 no anterior incluindo a estadia antiga), reserva cancelada excluída da receita e pagamento antigo recebido no mês atual.
- **7.2–7.5:** `cd frontend && npm run build && npm run lint && npm run test:reservation`; build/lint verdes e 19 testes verdes. O teste de contrato cobre revalidação fail-closed, erro estruturado, seleção além de 100 e reuso/troca de chaves idempotentes; refs síncronas bloqueiam duplo clique e mantêm retry após timeout.
- **8.4/8.7:** `docker compose run --rm --no-deps agents-marazul sh -c 'python -m compileall -q app agents orchestration schemas tools tests && for file in tests/test_*.py; do python "$file" || exit 1; done'`; 5 scripts verdes. Sentinelas de CPF, pagamento, token, `Authorization` e `X-Api-Key` não aparecem em resposta/log sanitizado; falha do backend retorna ação bloqueada. A inspeção de `agents/logs/agents.log` encontrou 134 linhas JSON e 0 linhas arriscadas.
- **10.3:** os mesmos testes PostgreSQL passaram no Compose/host do banco e o relatório é comparado contra o conjunto manual acima; a limitação é não haver staging externo nesta sessão.
- **10.4:** smoke real no Chrome local sem dados pessoais: dashboard `admin` exibiu os dois indicadores financeiros e requisitou `revenue-summary`; `manager` não requisitou esse endpoint e não exibiu os valores; desktop e headless responsivo sem overflow horizontal. Gateway/agente autenticado já passou no Compose; confirmação e busca >100 têm cobertura automatizada.
- **10.6:** `.planning/ROLLBACK.md` documenta rollback por imagem, flag `AGENTS_MUTATIONS_ENABLED=false` e preservação de dados; `docker compose run --rm --no-deps agents-marazul sh -c 'python tests/test_rollback_flag.py'` retornou `test_rollback_flag: ok`. A verificação externa de staging permanece pendente antes de promoção.

