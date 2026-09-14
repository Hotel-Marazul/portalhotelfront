## Context

Consulte `proposal.md` para a motivação. O PortalHotel possui três serviços independentes: frontend Next.js, backend Express como única autoridade de negócio e serviço FastAPI de agentes. O PostgreSQL é a fonte de verdade. A proteção de sobreposição por intervalo `[)` e a transação com lock de quarto já existem e devem ser preservadas.

A mudança cruza contratos HTTP, schema SQL, autenticação, tempo, interface e migração de dados. O schema ainda é evoluído por inicialização idempotente, sem ferramenta dedicada de migrations. Existem dados reais de demonstração, incluindo reserva vencida em status ativo e pagamento acima do total; qualquer reparo retroativo precisa ser separado da evolução estrutural.

## Goals / Non-Goals

**Goals:**

- Centralizar invariantes de reserva e dinheiro no backend e no PostgreSQL.
- Manter compatibilidade temporária dos consumidores sem preservar comportamentos destrutivos.
- Fazer concorrência, retentativas e falhas de rede produzirem resultados determinísticos.
- Implantar a mudança em fases verificáveis, com diagnóstico antes de qualquer ajuste de dados legados.

**Non-Goals:**

- Criar política de multa, reembolso online, no-show, desconto manual ou integração com adquirente.
- Introduzir multi-tenancy, channel manager, novo PMS ou acesso direto dos agentes ao banco.
- Redesenhar toda a interface ou alterar a regra atual de preço além do necessário para consistência.
- Corrigir automaticamente timestamps, status vencidos ou excesso pago já existentes.

## Decisions

### 1. Um serviço de domínio sustentará todos os caminhos de mutação

Criação, atualização, transição, cancelamento e pagamento chamarão regras compartilhadas no backend, sempre dentro de uma transação obtida do pool. Rotas atuais, novas rotas kebab-case e chamadas de agentes não poderão implementar variantes próprias da mesma regra.

Alternativa considerada: corrigir cada rota isoladamente. Rejeitada porque manteria divergência entre rota legada, interface e agentes.

### 2. Concorrência combinará lock pessimista, versão otimista e constraint

Cada mutação bloqueará a reserva envolvida; alterações de quarto ou intervalo também bloquearão os quartos em ordem estável. A reserva receberá uma versão incremental exposta nos DTOs, e atualizações exigirão a versão observada. A exclusion constraint PostgreSQL continuará sendo a defesa final contra sobreposição ativa.

Alternativa considerada: confiar somente em `FOR UPDATE`. Rejeitada porque outro caminho de escrita ou uma regressão de aplicação poderia furar a proteção. Confiar somente na constraint também foi rejeitado porque não protege lost update nem produz todos os erros de domínio necessários.

### 3. Cancelamento será um comando explícito e nunca exclusão

Será criado `POST /api/reservations/:id/cancel`, recebendo motivo e versão. A rota legada `DELETE /api/Reservations/:id` será adaptada para o mesmo comando durante a compatibilidade e jamais executará `DELETE FROM reservations`. Uma tabela append-only de eventos registrará status anterior/novo, ator, motivo, instante e identificador de correlação.

Alternativa considerada: manter hard delete apenas para administradores. Rejeitada porque pagamentos e ocupação histórica precisam permanecer reconciliáveis; eventual eliminação por privacidade exige processo próprio e não faz parte desta mudança.

### 4. Transições de estado terão endpoint e tabela de regras únicos

Será criado `POST /api/reservations/:id/transitions`, com `targetStatus`, `version` e motivo quando exigido. Criação começará em `Pendente`; a exceção administrativa para `Confirmada` exigirá papel e justificativa. Pagamentos não chamarão transição internamente. Reservas vencidas serão consultadas como exceções, sem job que mude status sozinho.

Alternativa considerada: continuar aceitando qualquer status no `PUT` genérico. Rejeitada por permitir saltos, regressões e acoplamento indevido com pagamentos.

### 5. Pagamentos usarão saldo sob lock e chave de idempotência

O pagamento bloqueará a reserva, agregará os lançamentos válidos, comparará o valor ao saldo e inserirá o registro na mesma transação. A chave de idempotência será obrigatória e única por reserva. O DTO detalhado retornará `totalPrice`, `totalPaid` e `balanceDue` como valores decimais serializados de forma estável.

Pagamentos existentes receberão tipo padrão `payment`. Correções futuras usarão lançamento `reversal`, com valor negativo no banco, referência ao pagamento corrigido, ator e motivo; o agregado soma os lançamentos. Um pagamento original nunca será atualizado ou apagado.

Alternativa considerada: aceitar excesso e exibir troco. Rejeitada porque o sistema não possui conceito de caixa/troco nem contrato para destinar o excedente. Também foi rejeitada a deduplicação apenas no botão, pois não cobre timeout e retentativa de rede.

### 6. A evolução do banco será aditiva e observável

O schema ganhará, de forma idempotente, versão da reserva, metadados de idempotência e tipo/referência de pagamento, além da tabela de eventos de reserva e respectivos índices/constraints. Primeiro serão aplicadas colunas anuláveis ou com defaults compatíveis; validações estritas serão promovidas apenas depois da análise dos dados existentes.

Alternativa considerada: recriar tabelas ou usar seed para normalizar dados. Rejeitada pelo risco de perda e por violar o papel operacional do banco.

### 7. Datas civis serão convertidas em uma única fronteira

O backend definirá `HOTEL_TIMEZONE=America/Sao_Paulo` e será o único responsável por converter data civil + horário operacional em instante UTC. Consultas SQL que delimitam dia ou mês receberão limites UTC já calculados para o fuso do hotel ou usarão expressão explícita equivalente. Noites serão calculadas por diferença de datas civis, não por duração em segundos.

O frontend continuará enviando datas civis no contrato definido, sem construir instantes usando o fuso do navegador. O serviço de agentes enviará o mesmo formato.

Alternativa considerada: configurar apenas `TZ` nos containers. Rejeitada porque fica implícita, não corrige consultas SQL e é vulnerável a diferenças de ambiente.

### 8. Consultas terão schemas próprios e paginação por contrato

Filtros de reservas, disponibilidade e clientes serão validados antes do SQL. Limites superiores de data serão exclusivos no começo do dia seguinte. Paginação usará `page`, `pageSize` com teto, ordenação estável e metadados de total. O endpoint de disponibilidade receberá `guestCount` e aplicará simultaneamente capacidade, manutenção e conflito de datas.

Alternativa considerada: filtrar a lista completa no frontend. Rejeitada porque já exclui clientes além do limite e não escala.

### 9. Indicadores operacionais e financeiros serão separados

Um módulo de consultas agregadas compartilhará as regras temporais e de status. Ocupação será calculada em quarto-noites civis. Check-ins/check-outs excluirão canceladas. Pendências vencidas serão um indicador de exceção. Receita reservada e recebimentos terão campos e rótulos diferentes, evitando tratar preço prometido como dinheiro recebido.

Alternativa considerada: manter um único campo `revenue`. Rejeitada porque mistura competência de reserva e fluxo de caixa.

### 10. O backend será o gateway autenticado do chat

O navegador chamará uma rota autenticada do backend para conversar com o agente. O backend encaminhará a solicitação ao FastAPI usando credencial interna e contexto assinado do usuário. O FastAPI rejeitará acesso direto sem credencial interna. Para retornar ao backend, os agentes usarão `BACKEND_BEARER_TOKEN` de alta entropia, reconhecido como identidade técnica com allowlist de operações; a auditoria registrará serviço e usuário iniciador.

Alternativa considerada: compartilhar o segredo JWT de usuários com o FastAPI. Rejeitada por ampliar o impacto de vazamento e duplicar a lógica de autenticação. Manter `/chat` público também foi rejeitado porque uma simples correção do token do backend tornaria as mutações publicamente acionáveis.

### 11. A confirmação do agente será um artefato de estado, não uma frase livre

O orquestrador armazenará uma proposta normalizada com hash dos campos críticos, preço e validade da disponibilidade. Apenas uma resposta afirmativa ligada à proposta atual libera uma mutação idempotente. Qualquer mudança relevante ou expiração invalida a confirmação. Erros do backend são propagados em linguagem segura, sem o agente declarar sucesso por inferência.

Alternativa considerada: detectar palavras como “sim” sem vincular ao resumo. Rejeitada por permitir confirmação ambígua ou reutilizada após mudança de dados.

### 12. A interface reutilizará os estados autoritativos da API

Falha de disponibilidade esvaziará opções selecionáveis e manterá um estado explícito de erro com retry. Busca de cliente será remota e paginada. Mutações terão estado `submitting`, chave idempotente estável e tratamento específico para 400, 401, 403, 409 e falha de rede. O drawer permanecerá aberto após pagamento para mostrar os agregados atualizados. Coleções receberão DTO resumido com CPF ausente ou mascarado.

Alternativa considerada: manter fallback para todos os quartos. Rejeitada por induzir o operador a preencher uma reserva sabidamente não validada; falhas de disponibilidade deixam a seleção vazia e exibem erro com retry.

### 13. Dependências serão atualizadas como gate de entrega, não como alteração de domínio

Backend e frontend serão atualizados dentro de linhas compatíveis, priorizando Next.js, Axios e transitivas apontadas pela auditoria. Lockfiles serão regenerados pelos gerenciadores dos próprios projetos. A entrega exige builds, testes e auditoria sem vulnerabilidade crítica ou alta alcançável no runtime; exceções precisam ser documentadas com pacote, exposição e prazo.

Alternativa considerada: misturar atualização major e redesign. Rejeitada para limitar regressão e manter o foco na reserva.

## Risks / Trade-offs

- **[Consumidores dependem de DELETE físico]** → adaptar a rota legada para cancelamento lógico, monitorar uso e documentar a resposta antes de removê-la em mudança futura.
- **[Locks aumentam contenção]** → bloquear apenas registros necessários, em ordem determinística, manter transações curtas e testar concorrência.
- **[Versões antigas do frontend não enviam `version`]** → período de compatibilidade controlado; DTO passa a expor versão antes de torná-la obrigatória para todos os clientes.
- **[Dados antigos violam novas constraints]** → executar relatórios de pré-checagem e aplicar `NOT VALID`/validação posterior quando cabível; não reparar automaticamente.
- **[Conversão de fuso desloca reservas existentes]** → separar contrato novo do script de reparo; gerar dry-run e exigir aprovação/backup antes de atualizar linhas.
- **[Pagamentos acima do total já existem]** → manter histórico, bloquear novos excessos e tratar casos legados por lançamento compensatório autorizado.
- **[Gateway do agente altera o caminho de rede]** → preservar endpoint de saúde separado, testar streaming/timeouts e impedir fallback para acesso público.
- **[Upgrade de dependência muda comportamento]** → atualizar em lote pequeno, executar regressão por serviço e comparar contratos HTTP antes do deploy.

## Migration Plan

1. Capturar backup e executar diagnósticos somente leitura: sobreposições, timestamps, status vencidos, excesso pago, duplicidades potenciais e uso da rota legada.
2. Aplicar evolução aditiva de schema e índices; validar que a constraint de sobreposição continua ativa e que os dados existentes permanecem legíveis.
3. Publicar backend com DTOs ampliados, validação de queries, serviço de domínio, cancelamento lógico, transições, saldo e idempotência, mantendo adaptadores legados.
4. Atualizar frontend para contratos autoritativos, falha fechada, busca paginada, versionamento e novos estados financeiros.
5. Publicar gateway autenticado e serviço de agentes protegido; manter mutações do agente desabilitadas até autenticação, confirmação e testes ponta a ponta passarem.
6. Atualizar dependências e executar a matriz completa de build, lint, testes unitários, integração com PostgreSQL e cenários concorrentes.
7. Em staging, validar reservas adjacentes, conflito simultâneo, cancelamento com histórico, pagamento concorrente, filtros de último dia, ocupação e ações do agente.
8. Somente após aprovação separada, aplicar eventual correção de timestamps ou dados financeiros legados a partir do relatório de dry-run.

**Rollback:** manter migrations aditivas compatíveis e não remover colunas/rotas antigas nesta mudança. Em falha, primeiro definir `AGENTS_MUTATIONS_ENABLED=false` e reiniciar o serviço de agentes para bloquear criação/edição/cancelamento sem interromper consultas; depois, se necessário, reverter os containers para a imagem anterior. Manter as novas colunas/tabelas sem uso. Não reverter dados financeiros ou cancelamentos por restauração ampla; corrigir por eventos compensatórios auditados.

