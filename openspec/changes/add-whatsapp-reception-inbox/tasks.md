## 1. Pré-requisitos

- [x] 1.1 Commitar a renomeação `manager` → `receptionist` (migração `migrateLegacyUserRoles` em `backend/src/db/init.ts`, tipos, seed, `.env.example`, dashboard, docs) e rodar `cd backend && npm run test:integration:db` com o banco de pé; verificar que todos os testes passam, inclusive `tests/integration/user-roles.test.ts`. **Verificado:** suíte de integração passou contra PostgreSQL 16 limpo em Docker, incluindo `tests/integration/user-roles.test.ts`; commit da renomeação: `e57cece`.
- [x] 1.2 Fazer login com o usuário da recepção criado pela seed e com o gerente; verificar que `GET /api/User/me` devolve `receptionist` e `admin` e que o dashboard da recepção não chama `/api/reservations/revenue-summary`. **Verificado manualmente:** login da recepção e do gerente concluído; `GET /api/User/me` devolveu os papéis esperados; o dashboard da recepção não chamou o resumo financeiro.

## 2. Sondagem da Evolution (sem código de produto)

- [x] 2.1 Acrescentar o serviço `evolution-marazul` ao `docker-compose.yaml`: imagem oficial da Evolution API v2 com tag fixa, banco `evolution` com usuário próprio no `db-marazul`, cache local sem Redis se a versão permitir, credenciais `${VAR:?}` e porta publicada só em desenvolvimento. Verificar que `docker compose up evolution-marazul` sobe e que o painel da Evolution abre localmente. **Verificado:** `DOCKER_CONTEXT=default docker compose up -d evolution-marazul` subiu `evoapicloud/evolution-api:v2.3.7`; `GET http://127.0.0.1:8080/` respondeu 200 com versão 2.3.7 e o container registrou cache local.
- [x] 2.2 Conectar o chip de teste dedicado pelo painel da Evolution; verificar que a consulta de estado da instância devolve conectado. **Verificado:** a instância `Marazul` respondeu 200 a `GET /instance/connectionState/Marazul` com `state: open`.
- [ ] 2.3 Configurar o webhook da instância para um endpoint temporário de captura (túnel `cloudflared` ou `ngrok`), só com os eventos de mensagem nova, atualização de mensagem e conexão, e com base64 de mídia desligado. Verificar que foram capturados: **Pendente:** não há grupo de teste disponível; não foi possível capturar o cenário de mensagem de grupo. Os demais eventos foram capturados, incluindo `connection.update` com `close` e `open`.
  - texto recebido;
  - texto enviado pelo celular;
  - imagem com legenda;
  - áudio;
  - reação;
  - mensagem de grupo;
  - atualizações de status enviada, entregue e lida;
  - queda e volta da conexão.
- [ ] 2.4 Salvar os payloads capturados em `backend/tests/fixtures/whatsapp/*.json`, trocando dígitos de telefone, nomes e textos por valores fictícios. Escrever `backend/tests/fixtures/whatsapp/README.md` com: **Pendente:** fixtures dos eventos disponíveis foram salvas; falta uma fixture real de grupo e a confirmação do envio de texto pela API.
  - a tag da imagem;
  - onde vai o segredo do webhook (header `x-webhook-secret` ou query `token`);
  - o nome exato de cada evento;
  - os caminhos dos campos de texto, legenda, id, `fromMe`, `pushName` e instante;
  - os valores de status;
  - o caminho, o corpo e a resposta do envio de texto.

  Verificar que buscar os números reais do chip nas fixtures não retorna nada.
- [x] 2.5 Medir o atraso entre enviar pelo celular e receber o webhook em 10 mensagens; verificar que a mediana e o máximo estão registrados no README das fixtures. **Verificado:** 10 `messages.upsert` de entrada; mediana de 0,722 s e máximo de 1,038 s.

## 3. Banco, configuração e esqueleto do módulo

- [x] 3.1 Acrescentar a `backend/src/db/init.ts`, de forma idempotente, as tabelas, índices, chaves circulares e o trigger append-only de `whatsapp_ai_rule_events` descritos na decisão 2 de `design.md`, além de `clients.fone_e164`. Verificar com o novo `backend/tests/integration/whatsapp-schema.test.ts`: `initializeDatabase()` roda duas vezes seguidas sem erro, as tabelas e os índices únicos existem e o trigger rejeita `UPDATE` e `DELETE`. **Verificado:** `tests/integration/whatsapp-schema.test.ts` passou (inclui as duas inicializações, índices e rejeição de `UPDATE`/`DELETE`).
- [x] 3.2 Acrescentar as variáveis da decisão 19 a `backend/src/config/env.ts`, com as regras de obrigatoriedade quando `WHATSAPP_ENABLED=true`, e documentá-las em `backend/.env.example` e no serviço `backend-marazul` do `docker-compose.yaml`. Verificar que o backend recusa subir com `WHATSAPP_ENABLED=true` sem `EVOLUTION_API_URL`, com uma mensagem clara, e que `npm run build` passa. **Verificado:** importação com a configuração incompleta falhou citando `EVOLUTION_API_URL`; `cd backend && npm run build` passou.
- [x] 3.3 Extrair a consulta de disponibilidade de `backend/src/modules/rooms/rooms.routes.ts` para `backend/src/modules/rooms/availability.service.ts`, sem mudar o contrato de `GET /api/rooms/availability`. Verificar que os testes de integração de reservas e disponibilidade continuam passando e que a resposta para a mesma consulta é idêntica antes e depois. **Verificado:** `reservation-contracts.test.ts` passou no banco isolado `portal_hotel_test`, cobrindo o contrato de disponibilidade e os limites de capacidade.
- [x] 3.4 Criar `backend/src/modules/whatsapp/` com os arquivos da decisão 1 ainda vazios. Registrar o roteador do webhook antes de `authMiddleware` e o roteador autenticado com `requireRole("admin", "receptionist")`. Fazer as rotas responderem `404` com o módulo desligado, exceto `GET /api/whatsapp/status`, que responde `{ enabled: false }`. Verificar com teste de integração. **Verificado:** `whatsapp-disabled.test.ts` passou no banco isolado, incluindo status 200 desligado, fila 404 e webhook 404.

## 4. Telefones e vínculo com clientes

- [x] 4.1 Implementar `phone.ts` (`normalizePhone`, `phoneFromJid`, `phoneVariants`) conforme a decisão 5, com `phone.test.ts`. Verificar com `npm test` pelo menos estes casos:
  - `(48) 99999-8888`, `48999998888`, `+55 48 99999-8888` e `005548999998888` resultam em `+5548999998888`;
  - `5551988412207` e `555188412207` são variantes um do outro;
  - fixo `+555133334444` não tem variante;
  - `12345` é inválido. **Verificado:** `npm test` e `node --import tsx --test src/modules/whatsapp/phone.test.ts` passaram.
- [x] 4.2 Gravar `fone_e164` na criação e na edição de clientes (`clients.routes.ts`) e disparar o vínculo automático da decisão 6. Verificar com teste de integração que cadastrar um cliente com o telefone de um contato sem vínculo vincula esse contato. **Verificado:** `whatsapp-client-link.test.ts` passou; o valor E.164 foi persistido e o contato único foi vinculado.
- [x] 4.3 Criar `backend/src/db/backfill-client-phones.ts` e o script `npm run whatsapp:backfill-phones`, que por padrão só relata e com `--apply` grava numa transação. Verificar que sem `--apply` nenhuma linha muda (compare `md5` de `SELECT id, fone_e164 FROM clients ORDER BY id` antes e depois) e que com `--apply` os válidos ficam preenchidos. **Verificado:** dry-run manteve `md5`, `--apply` preencheu o válido e deixou o inválido apenas no relatório.
- [x] 4.4 Implementar `GET /whatsapp/contacts/:id/link-candidates`, `PUT/DELETE /whatsapp/contacts/:id/link` e `PUT /whatsapp/contacts/:id/kind`. Verificar com testes de integração:
  - dois clientes com o mesmo telefone não geram vínculo automático e aparecem como candidatos;
  - o vínculo manual registra o autor;
  - desvincular impede o vínculo automático de voltar. **Verificado:** `whatsapp-link-routes.test.ts` passou com candidatos por telefone, autor, tipo fornecedor e bloqueio de religação.

## 5. Recebimento de eventos

- [ ] 5.1 Fazer `registerSecurityMiddlewares` pular o `express.json` global e o limitador global para `/api/whatsapp/webhook`. Montar na rota o parser de 2 MB, o limitador de 600/min e a verificação do segredo em tempo constante, no formato registrado na etapa 2. Verificar com testes:
  - `401` sem segredo;
  - `404` com o módulo desligado;
  - `200` com o segredo correto;
  - 300 requisições seguidas sem nenhum `429`;
  - corpo de 1,5 MB aceito;
  - as demais rotas continuam limitadas a 100 kb.
- [ ] 5.2 Gravar o evento bruto num único `INSERT` e só então responder `200 { received: true }`, com `503` se o `INSERT` falhar. Verificar com teste que força a falha do repositório e com teste que mede a resposta abaixo de 2 s.
- [ ] 5.3 Implementar `evolution-parser.ts` como função pura sobre as fixtures da etapa 2. Verificar com `evolution-parser.test.ts`: cada fixture produz a estrutura esperada, e grupo, broadcast, reação e evento desconhecido saem como ignorados.
- [ ] 5.4 Implementar em `ingestion.service.ts` a mensagem recebida da decisão 4, numa transação com a conversa bloqueada. Ela cobre contato, conversa, atendimento, mensagem, `awaiting_since`, não lidas, triagem pendente, pontuação sem IA e sugestões substituídas. Verificar com testes de integração usando as fixtures:
  - a primeira mensagem cria tudo e entra na fila;
  - a segunda mantém `awaiting_since` e soma 2 não lidas;
  - a reentrega não duplica;
  - a mensagem fora de ordem não mexe na espera.
- [ ] 5.5 Implementar a mensagem enviada pelo celular e a reivindicação da linha `sending`/`failed` de mesmo corpo em até 2 minutos. Verificar com testes que a resposta pelo celular tira a conversa da fila e registra `first_response_at`, e que uma linha `sending` é reivindicada em vez de duplicada.
- [ ] 5.6 Implementar status que só avança (`messages.update`), estado da conexão (`connection.update`) e a consulta periódica de estado a cada 60 s. Verificar com testes: leitura antes de entrega termina em `read`, e a conexão fechada muda `whatsapp_instances.connection_state`.
- [ ] 5.7 Implementar o worker de eventos (10 s, `FOR UPDATE SKIP LOCKED`, até 5 tentativas, `process_error` com código curto) e o comando `npm run whatsapp:reprocess`. Verificar com testes: um evento com erro de parsing não impede o seguinte, e o reprocessamento depois da correção não duplica mensagens.
- [ ] 5.8 Implementar o fechamento de atendimentos após 7 dias sem mensagens (job de hora em hora). Verificar com teste que a próxima mensagem abre um atendimento novo e preserva o desfecho do anterior.
- [ ] 5.9 Verificar por busca estática e por teste de log que nenhum log do módulo inclui corpo de mensagem, telefone, `push_name` ou texto de sugestão.

## 6. API de leitura da tela

- [ ] 6.1 Implementar `GET /whatsapp/queue` com a pontuação na consulta (base + espera limitada a 30, teto de 39 para fornecedor), a ordem `score DESC, awaiting_since ASC, id`, os grupos, as contagens por filtro e as respondidas nas últimas 48 h. Verificar com testes de integração: desempate pela espera mais antiga, filtro de leads e fornecedor nunca acima de 39.
- [ ] 6.2 Implementar `GET /whatsapp/conversations?search=` por nome ou dígitos do telefone, em todas as conversas. Verificar com teste que a busca "98841" encontra uma conversa fora da fila.
- [ ] 6.3 Implementar `GET /whatsapp/queue/count` e `GET /whatsapp/status` (conexão, e IA disponível com o motivo da decisão 13). Verificar com testes cada motivo: desligada, sem configuração e limite atingido.
- [ ] 6.4 Implementar `GET /whatsapp/conversations/:id` com a forma `ConversationDetail` da decisão 14: posição, motivos com o texto de espera, leitura com disponibilidade e preços, hóspede com CPF mascarado, atendimento, `myFeedback`, `isFirstOutbound` e `privacyNotice`. Verificar com teste que o CPF vem mascarado também para `admin` e que a resposta não tem nenhum agregado financeiro.
- [ ] 6.5 Implementar `GET /whatsapp/conversations/:id/messages` com cursores `before` e `after` e `limit` de até 50, separadores de dia no fuso do hotel e marcadores das leituras com `model <> 'fallback'` logo depois de `last_message_id`. Verificar com uma conversa de 200 mensagens que a paginação não repete nem pula itens.
- [ ] 6.6 Implementar `POST /whatsapp/conversations/:id/read` e `POST /whatsapp/conversations/:id/dismiss`. Verificar com testes que as não lidas zeram e que a conversa dispensada volta à fila com mensagem nova.
- [ ] 6.7 Criar um teste de papéis, em tabela, que percorre todas as rotas do módulo. Verificar `401` sem sessão, `403` para a identidade técnica do serviço de IA e acesso para `receptionist` e `admin`, exceto as rotas só de `admin`, que devem dar `403` para `receptionist`.

## 7. Envio pelo portal

- [ ] 7.1 Implementar `evolution-client.ts` (envio de texto e estado da conexão) com timeout de 15 s e erros convertidos em motivos curtos sem dados pessoais. Verificar com testes unitários usando `fetch` simulado: sucesso, 400, 500 e timeout.
- [ ] 7.2 Implementar `POST /whatsapp/conversations/:id/messages` seguindo os passos da decisão 12. Verificar com testes de integração contra uma Evolution simulada (servidor HTTP local):
  - duplo envio idempotente;
  - `clientRequestId` de outra conversa → `409`;
  - trecho a completar → `422`;
  - desconectado → `409 whatsapp_disconnected`, sem chamada à Evolution;
  - `conversation_changed` e `force`;
  - origem manual, sugestão e sugestão editada.
- [ ] 7.3 Implementar a reconciliação nas duas ordens: resposta da Evolution primeiro e evento `fromMe` primeiro. Verificar com teste determinístico que as duas ordens terminam com uma única mensagem com autor e origem do portal.
- [ ] 7.4 Implementar a falha com `failure_reason`, `POST /whatsapp/messages/:id/retry` e a confirmação posterior de uma mensagem que estourou o tempo. Verificar com testes: falha seguida de reenvio com sucesso, e timeout seguido de evento `fromMe` igual em até 2 minutos termina em `sent`, sem duplicata.
- [ ] 7.5 Implementar `isFirstOutbound` e `WHATSAPP_PRIVACY_NOTICE`. Verificar com teste que `isFirstOutbound` é verdadeiro só antes da primeira mensagem de saída ao contato, venha ela do celular ou do portal.

## 8. Serviço de IA (`agents/`)

- [ ] 8.1 Criar `agents/schemas/whatsapp.py` com os modelos de requisição e resposta da decisão 11 e os limites de tamanho. Verificar com `pytest` que respostas fora dos limites são rejeitadas.
- [ ] 8.2 Criar `agents/whatsapp/model_client.py`: chamada ao modelo com saída estruturada pelo pacote `openai`, `WHATSAPP_AI_MODEL` com `OPENAI_MODEL` como padrão, e `503` sem `OPENAI_API_KEY`. Incluir uma interface que os testes trocam por um cliente falso. Verificar com testes do `503` e do cliente falso.
- [ ] 8.3 Criar `agents/app/whatsapp_router.py` com `X-API-Key` obrigatório e incluí-lo em `create_app()`. Verificar com testes: `401` sem chave, e o pacote `agents/whatsapp/` não importa `tools/backend_api.py` (teste que inspeciona os imports).
- [ ] 8.4 Implementar `/whatsapp/triage` (`agents/whatsapp/triage.py` e `agents/prompts/whatsapp_triage.md`) com as regras de datas relativas, pessoas, limites de texto e mensagens como dados não confiáveis. Verificar com testes com cliente falso: a saída é validada e cortada, e uma conversa com "ignore suas regras…" produz leitura dentro do schema.
- [ ] 8.5 Implementar `/whatsapp/suggest-reply` (`suggest.py` e `whatsapp_suggest.md`) com políticas do RAG existente (`tools/retrieval.py`), trechos `gap` e `basis` de 2 a 4 itens. Verificar com testes que as `replyRules` e os `facts` chegam ao prompt e que falta de informação vira `gap`.
- [ ] 8.6 Implementar `/whatsapp/reply-style-proposals` (`style.py` e `whatsapp_style.md`), com até 3 propostas e até 3 `topEdits`. Verificar com testes os limites e o formato.
- [ ] 8.7 Atualizar `agents/README.md` e `agents/.env.example` (`WHATSAPP_AI_MODEL`). Verificar que `pytest` passa inteiro.

## 9. Triagem e fila no backend

- [ ] 9.1 Implementar `agents-client.ts` com os timeouts da decisão 11, o contador em `whatsapp_ai_daily_usage` e a regra de disponibilidade da decisão 13. Verificar com testes que o limite atingido impede novas chamadas no mesmo dia civil do hotel e libera no dia seguinte.
- [ ] 9.2 Implementar `signals.ts` e `facts.service.ts` (decisões 8 e 10), com a disponibilidade pelo `availability.service.ts` e os preços por `calculateReservationPricing`. Verificar com testes de integração:
  - os fatos não contêm CPF, telefone, e-mail, sobrenome nem pagamentos;
  - o total de uma categoria é igual ao de `POST /api/reservations/quote` para a mesma entrada.
- [ ] 9.3 Implementar `scoring.ts` como função pura, com a tabela de pesos, o limite das regras, os níveis, até 4 motivos e o texto da espera. Verificar com `scoring.test.ts` os cenários da spec `whatsapp-ai-triage`:
  - pedido completo esperando 14 min → 69, Hoje;
  - problema na estadia esperando 4 min → 74, Agora;
  - fornecedor ≤ 39;
  - preço + 10 min → 40, Hoje;
  - quatro regras de +10 contribuem +25.
- [ ] 9.4 Implementar `triage.worker.ts` seguindo a decisão 7: reivindicação com `SKIP LOCKED`, espera de 20 s, validação Zod, gravação transacional, nova triagem por snapshot, 3 tentativas com espera crescente, recuperação de travadas e leitura sem IA. Verificar com testes de integração contra um serviço de IA falso:
  - três mensagens em 15 s geram uma chamada;
  - mensagem durante a chamada gera segunda leitura;
  - três falhas terminam em `failed` com leitura sem IA;
  - `running` antigo volta a `pending`.
- [ ] 9.5 Garantir a pontuação sem IA na primeira mensagem, antes da triagem. Verificar com teste que a conversa aparece na fila já ordenada com a IA desligada.
- [ ] 9.6 Implementar o recálculo de `base_score` e `score_reasons` das conversas na fila quando uma regra de fila for aceita ou desfeita. Verificar com teste que termina em até 10 s e não chama o serviço de IA.
- [ ] 9.7 Implementar `jobs.ts` (`startWhatsappJobs` / `stopWhatsappJobs`) e ligar em `server.ts` só com `WHATSAPP_ENABLED=true`. Parar os timers no `SIGTERM`. Verificar que o servidor sobe sem timers com o módulo desligado e que os testes não disparam timers.

## 10. Sugestões no backend

- [ ] 10.1 Implementar `POST /whatsapp/conversations/:id/suggestion` com as pré-condições, o reaproveitamento da sugestão viva, a geração com os fatos e as regras de resposta ativas, e `204` sem IA ou sem conversa aguardando. Verificar com testes: dois usuários recebem a mesma sugestão com uma chamada ao modelo, e conversa respondida dá `204`.
- [ ] 10.2 Implementar a validação da decisão 18 (partes, tamanhos, colchetes, preços iguais a `facts.prices[].total`). Verificar com testes unitários:
  - preço correto aceito;
  - "R$ 1.500" com fato de R$ 1.890,00 descartado, com log só do motivo;
  - trecho a completar acima de 60 caracteres descartado.
- [ ] 10.3 Implementar `POST /whatsapp/suggestions/:id/dismiss` e a substituição na nova mensagem do hóspede. Verificar com testes: descartada não volta para a mesma mensagem, e mensagem nova gera sugestão nova.
- [ ] 10.4 Ligar o envio à sugestão: origem por comparação normalizada e `status = 'used'`. Verificar com testes: remover um espaço duplo continua sendo "sugestão sem mudanças", e acrescentar uma frase vira "sugestão editada".

## 11. Aprendizado no backend

- [ ] 11.1 Implementar `PUT /whatsapp/conversations/:id/outcome`: fecha o atendimento com autor e horário, o mais recente continua editável e `null` volta para Em andamento. Verificar com testes os cenários da spec `whatsapp-ai-learning`.
- [ ] 11.2 Implementar `POST` e `DELETE /whatsapp/conversations/:id/priority-feedback`, com uma correção por pessoa por leitura, o nível e a posição do momento, e sem mudar a pontuação. Verificar com testes.
- [ ] 11.3 Implementar o catálogo de condições e a `condition_key` canônica (decisão 15). Verificar com testes unitários: chaves iguais para objetos com ordem diferente, e condição casa só quando todos os pares batem.
- [ ] 11.4 Implementar a parte "desfechos" de `proposals.job.ts`. Verificar com teste de integração do cenário da spec: 30 atendimentos, 12 reservas, 8 de preço sem datas com 1 reserva geram −10 com a evidência exata. Uma condição com 7 atendimentos não gera nada.
- [ ] 11.5 Implementar a parte "correções". Verificar com teste: 3 "Descer" de Carla sem nenhum "Subir" geram −10 com "Corrigido para baixo 3 vezes por Carla".
- [ ] 11.6 Implementar a parte "edições" pelo serviço de IA (mínimo de 5 pares, apoio de pelo menos 5, filtro de nomes e telefones, `topEdits` em `last_result`). Verificar com teste com serviço de IA falso: instrução com nome de hóspede é descartada, e instrução válida vira proposta.
- [ ] 11.7 Garantir que não haja duplicata viva e que ignorar ou desfazer imponha 30 dias de espera. Verificar com teste que rodar o job duas vezes com os mesmos dados cria uma só proposta e que uma chave ignorada não volta no dia seguinte.
- [ ] 11.8 Implementar `accept`, `ignore` e `revert` só para `admin`, com `409` para estado errado e evento em `whatsapp_ai_rule_events`. Verificar com testes: `403` para `receptionist`, `409` ao aceitar uma regra ativa, histórico com três eventos em ordem e recálculo disparado.
- [ ] 11.9 Implementar `POST /whatsapp/learning/recompute`, só para `admin` e no máximo 1 a cada 10 min. Verificar com teste que o segundo pedido em 2 min é recusado com o horário da próxima possibilidade.
- [ ] 11.10 Implementar `GET /whatsapp/learning/summary` e `GET /whatsapp/learning/corrections` (decisão 16). Verificar com teste de integração sobre um conjunto de dados montado no teste, comparando com números calculados à mão e com o período vazio devolvendo zeros.
- [ ] 11.11 Implementar `retention.job.ts` (decisão 20). Verificar com teste de integração que mensagens e atendimentos além da retenção e eventos brutos processados com mais de 30 dias são apagados, e que regras e seus eventos permanecem.

## 12. Frontend: base

- [ ] 12.1 Criar `frontend/src/types/whatsapp.ts` e `frontend/src/utils/whatsapp.ts` (rótulo e classe do nível, "há N min"/"há N h", prévia, iniciais, trechos a completar, origem esperada) com `frontend/tests/whatsapp-utils.test.mjs`, e incluir o arquivo no script de testes do `package.json`. Verificar com `node --experimental-strip-types --test tests/whatsapp-utils.test.mjs`.
- [ ] 12.2 Criar `frontend/src/hooks/useVisiblePolling.ts`, que pausa com a aba oculta e lê na hora ao voltar. Verificar no painel de rede do navegador que não há requisições com a aba oculta.
- [ ] 12.3 Acrescentar os tokens da decisão 17 a `globals.css` e criar `components/whatsapp/whatsapp.module.css`. Verificar que `npm run lint` passa e que cada par texto/fundo dos níveis e bolhas tem contraste de pelo menos 4,5:1 (registrar os valores).

## 13. Frontend: tela `/whatsapp`

- [ ] 13.1 Criar `src/app/whatsapp/page.tsx` e `WhatsappWorkspace` com três, duas ou uma coluna conforme a largura e a conversa aberta em `?c=`. Verificar em 1440, 1024, 390 e 320 px que não há rolagem horizontal e que o voltar do navegador fecha a conversa no celular.
- [ ] 13.2 Implementar a fila: título com contagem, busca com debounce, filtros com `aria-pressed`, grupos Aguardando e Respondidas, `QueueItem` como `<button>` com `aria-current` e Atender próximo (ignora filtro, pula a aberta, desabilitado com fila vazia). Verificar com a fila de exemplo do canvas.
- [ ] 13.3 Implementar `ConversationHeader`, `OutcomeSelect` e "Não precisa resposta". Verificar que trocar o desfecho persiste e sobrevive a recarregar a página.
- [ ] 13.4 Implementar `Timeline`, `MessageBubble` e `AiMarker`: separadores de dia, lados, autor e origem, status, falha com Reenviar, Carregar anteriores, rolagem acompanhando o fim e a região `aria-live`. Verificar com uma conversa de 200 mensagens e com uma mensagem nova chegando pelo polling.
- [ ] 13.5 Implementar `ReplyComposer`, `SuggestionCard` e `PrivacyNoticeHint` conforme a decisão 18, com Ctrl+Enter e os erros do envio:
  - `409 whatsapp_disconnected`, mantendo o texto;
  - `409 conversation_changed`, com Revisar e Enviar mesmo assim;
  - `422`;
  - `502`, com bolha "falhou" e Reenviar;
  - aviso de timeout.

  Verificar cada caminho contra a Evolution simulada.
- [ ] 13.6 Implementar `AiReadingPanel` e `PriorityFeedback` (Sim, Subir e Descer, confirmação com Desfazer, "Por que está em Nº", "Fora da fila", "Sem leitura da IA"). Verificar com uma conversa com leitura e outra sem.
- [ ] 13.7 Implementar `GuestPanel` e `LinkContactDialog`. Em `ModalHospede`, acrescentar `initialValues` e `onSuccess(client)`. Em `/cliente`, passar a ler `?busca=`. Verificar que o cadastro a partir da conversa vincula o contato e que as telas de hóspedes existentes continuam iguais sem os parâmetros novos.
- [ ] 13.8 Acrescentar `initialValues` ao `ModalNovaReserva` e o snackbar "Marcar este atendimento como 'Virou reserva'?". Verificar que a reserva a partir da conversa chega preenchida e que o modal sem `initialValues` se comporta como antes.
- [ ] 13.9 Implementar `ConnectionBanner` e a faixa de IA. Verificar com o número desconectado (envio bloqueado com o texto preservado) e com `WHATSAPP_AI_ENABLED=false` (sem sugestões, fila ordenada).
- [ ] 13.10 Fazer a revisão de acessibilidade: percorrer só com teclado (filtrar, abrir, usar sugestão, completar trecho, enviar), conferir nomes acessíveis dos botões de ícone, foco visível e áreas de toque. Verificar registrando o resultado no fim deste arquivo.

## 14. Frontend: aprendizado e navegação

- [ ] 14.1 Criar `src/app/whatsapp/aprendizado/page.tsx` com os blocos da decisão 17 e os controles só para `admin`. Verificar entrando como gerente (aceita, ignora e desfaz) e como recepção (sem botões, com a nota).
- [ ] 14.2 Atualizar `src/config/navigation.ts` e `MobileNavigation.tsx`:
  - WhatsApp com badge no grupo Operação;
  - sem o grupo Assistência;
  - títulos e rotas;
  - navegação inferior com WhatsApp;
  - tudo escondido com o módulo desligado.

  Verificar com o módulo ligado e desligado.
- [ ] 14.3 Remover `src/app/agente/` e `src/app/api/agents/`. Verificar que `grep -rn "/agente\|api/agents" frontend/src` não encontra nada, que `npm run build` passa e que `/agente` mostra página inexistente.

## 15. Documentação e verificação final

- [ ] 15.1 Atualizar a documentação:
  - `.mente/tecnico/arquitetura-decisoes.md` com a decisão de Evolution, IA só leitura e pontuação determinística;
  - `.mente/dominio/` com atendimento, desfecho e níveis;
  - `AGENTS.md`, `backend/README.md` e `agents/README.md` com variáveis e comandos.

  Verificar que a busca por "manager" nos documentos novos não aparece como papel.
- [ ] 15.2 Rodar a suíte completa:
  - backend: `npm test`, `npm run test:integration:db` e `npm run build`;
  - frontend: `npm run lint`, os testes e `npm run build`;
  - `agents/`: `pytest`.

  Verificar que tudo passa.
- [ ] 15.3 Com o chip de teste e os dois interruptores ligados, percorrer de ponta a ponta:
  - receber mensagem;
  - ver a leitura e a posição;
  - usar, editar e enviar a sugestão;
  - ver entregue e lida;
  - responder pelo celular;
  - marcar desfecho;
  - corrigir a posição;
  - rodar o recálculo;
  - aceitar e desfazer uma regra, vendo a fila mudar;
  - desconectar o número (aviso e bloqueio);
  - desligar a IA (leitura sem IA).

  Verificar registrando cada passo, sem dados pessoais, numa seção "Evidências" no fim deste arquivo.
- [ ] 15.4 Rodar `openspec validate add-whatsapp-reception-inbox --strict` e verificar que passa sem avisos.
