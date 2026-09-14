# Conversas do WhatsApp no portal

**Análise de requisitos** · 2026-09-04 · Revisão 3
**Status:** proposta — não aprovada, não iniciada
**Base:** branch `master`

---

## 1. O que é

Uma tela nova no portal, em `/whatsapp`, que mostra as conversas de WhatsApp do hotel ao lado do cadastro do hóspede e das reservas dele.

Quem atende é a recepcionista. A IA fica de fora — nem respondendo, nem sugerindo texto. A camada `agents/`, que já existe e já sabe criar reserva por chat, não participa desta entrega.

A conexão com o WhatsApp é feita pela **Evolution API**, um serviço não-oficial que se conecta como se fosse o WhatsApp Web.

---

## 2. Como fica na prática

1. Um hóspede manda mensagem para o número do hotel.
2. Em segundos, a conversa sobe para o topo da lista em `/whatsapp`.
3. A recepcionista clica e vê a conversa inteira — o que o hóspede escreveu **e** o que o hotel já respondeu pelo celular.
4. Ao lado, o sistema mostra quem é: *Maria Silva, CPF, reserva #123, quarto 201, check-in amanhã*. Se o número não estiver cadastrado, mostra o número cru e um botão para cadastrar.
5. Ela responde pelo WhatsApp do celular, como já faz hoje.
6. A resposta dela aparece na linha do tempo do portal logo em seguida.

O passo 5 é o único que muda na **Etapa 5**, se você decidir construí-la: aí ela responderia direto da tela.

O passo 3 é o que faz esta entrega valer sozinha. Como o sistema registra também as mensagens que saem do celular do hotel, a tela mostra os dois lados da conversa mesmo sem nunca enviar nada. Não é meia ferramenta esperando a outra metade.

---

## 3. Vocabulário deste documento

Para não confundir com o planejamento que já existe:

| Termo | Significa |
|---|---|
| **Etapa 0 … Etapa 5** | as etapas **desta feature** |
| **Fase 1 … Fase 6** | as fases do **roadmap do projeto** que já existem em `ROADMAP.md` — sempre escritas como "Fase N do roadmap" |
| **Evolution** | o serviço que conecta ao WhatsApp |
| **agents/** | o serviço de IA que já existe e que aqui fica desligado |

---

## 4. O que entra agora, o que fica para depois

| | Etapas 0–4 (agora) | Etapa 5 (planejada) | Não entra |
|---|---|---|---|
| Ler conversas no portal | sim | sim | |
| Responder | pelo celular | pelo portal, digitando | |
| IA respondendo ou sugerindo | | | fora |

### Entra agora

- Receber as mensagens da Evolution e guardar no banco
- Descobrir quem é o dono do número, cruzando com o cadastro de clientes
- A tela `/whatsapp`: lista de conversas, linha do tempo, painel do hóspede ao lado
- Mostrar os dois lados da conversa, incluindo o que saiu do celular
- Avisar quando o número do hotel cai da conexão

### Etapa 5 — requisitos escritos, decisão adiada

Enviar mensagem pela tela, com status de entrega, tratamento de falha e registro de quem enviou. Os requisitos estão escritos (`WA-18` a `WA-23`) para que a decisão seja informada — mas ela só faz sentido depois de ver a Etapa 3 rodando com conversas reais.

### Não entra

- **IA respondendo ou sugerindo texto.** Decisão sua, explícita.
- Baixar e exibir mídia — por ora o sistema registra que houve um anexo e de que tipo
- Grupos do WhatsApp
- Mais de um número
- Relatórios de atendimento: volume por hora, tempo de resposta, picos

> Relatórios ficam de fora por foco, não por dificuldade. Depois que as mensagens estiverem no banco, é `GROUP BY` sobre dados que já existem.

---

## 5. Três coisas do código que você precisa saber antes

### 5.1 O telefone do cliente não é normalizado — isto é pré-requisito

```sql
fone TEXT NOT NULL        -- db/init.ts
fone: z.string().min(8)   -- clients.schema.ts
```

Texto livre, sem máscara garantida, sem índice. Na base real convivem `(48) 99999-8888`, `48999998888` e `+55 48 99999-8888`.

O WhatsApp entrega `5548999998888@s.whatsapp.net`. Sem normalizar os dois lados para o mesmo formato, o painel do hóspede fica vazio e a tela vira uma lista de números — perde exatamente o que a torna melhor que o WhatsApp Web.

**O que fazer:** Etapa 2, com script de normalização da base atual.

### 5.2 O webhook precisa de endereço público — e hoje não existe um

A Evolution avisa o sistema chamando uma URL. Isso exige que o backend esteja acessível pela internet, com TLS. O projeto hoje roda em Docker Compose no `localhost`.

Some-se a isso: a **Fase 2 do roadmap do projeto** (Security Hardening) está com 0 de 3 planos concluídos. Abrir endpoint público com o hardening pendente inverte a ordem de risco que o próprio roadmap estabeleceu.

**O que fazer:** em desenvolvimento, túnel (`cloudflared`, `ngrok`). Em produção, decidir onde hospedar — ver pergunta 2 na seção 10. E fechar a Fase 2 do roadmap antes de `WA-02` ir ao ar.

### 5.3 `BACKEND_BEARER_TOKEN` está quebrado hoje — mas não bloqueia isto

O `docker-compose.yaml` manda gerar o token com `openssl rand -hex 32`. Mas `routes/index.ts` protege a API com `authMiddleware`, que chama `verifyAccessToken()` → `jwt.verify(token, JWT_SECRET)`. Um hexadecimal aleatório não é um JWT válido: toda chamada `agents → backend` retorna 401.

Como `agents/` está fora desta entrega, não bloqueia nada aqui. Mas é bug real hoje, e volta a bloquear no dia em que a IA entrar.

**O que fazer:** corrigir quando for mexer no serviço de agents. Um JWT de serviço assinado com `JWT_SECRET` e um `sub` dedicado é a correção menor.

---

## 6. Onde o código mora

**No backend Express.** `agents/` fica inteiramente fora.

Parece contraintuitivo — é uma integração de conversa, e existe um serviço de conversa. Mas `agents/plan.md` e `AGENTS.md` são explícitos: *"os agentes NÃO devem escrever direto no banco"*. Isto é, quase inteiro, escrita no banco. Colocar em `agents/` ou quebra essa regra, ou cria um vaivém HTTP para gravar cada mensagem que chega.

O backend já tem tudo que o webhook precisa: `pg` pool, transações, JWT, `requireRole` e a tabela `clients` para cruzar o telefone.

```text
WhatsApp
   ↓
Evolution API                       (container novo, com Postgres e Redis próprios)
   ↓  POST /api/whatsapp/webhook    (header apikey)
backend/
   ├─ valida o segredo
   ├─ grava o evento bruto
   ├─ vira contato / conversa / mensagem
   └─ cruza com clients.fone
   ↓
PostgreSQL (portal_hotel)
   ↓
frontend/ — tela /whatsapp
   lista · linha do tempo · painel do hóspede
```

Quando a IA entrar, um dia, o backend chama `POST /chat` com `channel: "whatsapp"` — contrato que **já existe** em `agents/schemas/messages.py`. Nada dessa fiação precisa ser construída agora.

---

## 7. Modelo de dados

Cinco tabelas novas no banco `portal_hotel`, no padrão de `init.ts`: UUID como chave, `created_at TIMESTAMPTZ`.

```sql
-- Log bruto: idempotência, reprocessamento e depuração
whatsapp_webhook_events (
  id UUID PK,
  event_type    TEXT NOT NULL,        -- messages.upsert, connection.update, ...
  instance      TEXT NOT NULL,
  payload       JSONB NOT NULL,
  processed_at  TIMESTAMPTZ NULL,
  process_error TEXT NULL,
  received_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
)

whatsapp_contacts (
  id UUID PK,
  remote_jid TEXT NOT NULL UNIQUE,   -- 5548999998888@s.whatsapp.net
  phone_e164 TEXT NOT NULL,          -- +5548999998888  (normalizado)
  push_name  TEXT NOT NULL DEFAULT '',
  client_id  UUID NULL REFERENCES clients(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
)

whatsapp_conversations (
  id UUID PK,
  contact_id      UUID NOT NULL REFERENCES whatsapp_contacts(id) ON DELETE CASCADE,
  status          TEXT NOT NULL CHECK (status IN ('Aberta','Arquivada')) DEFAULT 'Aberta',
  last_message_at TIMESTAMPTZ NULL,
  unread_count    INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
)

whatsapp_messages (
  id UUID PK,
  conversation_id     UUID NOT NULL REFERENCES whatsapp_conversations(id) ON DELETE CASCADE,
  provider_message_id TEXT NOT NULL,        -- key.id vindo da Evolution
  direction  TEXT NOT NULL CHECK (direction IN ('inbound','outbound')),
  media_type TEXT NOT NULL DEFAULT 'text',  -- text|image|audio|document|video|other
  body       TEXT NOT NULL DEFAULT '',
  status     TEXT NOT NULL DEFAULT 'received',
  sent_at    TIMESTAMPTZ NOT NULL,
  raw        JSONB NOT NULL,
  -- usados só na Etapa 5; existem desde já para não exigir migração depois
  sent_by_user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
  failure_reason  TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
)

whatsapp_instances (
  id UUID PK,
  name              TEXT NOT NULL UNIQUE,
  connection_status TEXT NOT NULL DEFAULT 'unknown',
  last_status_at    TIMESTAMPTZ NULL
)
```

Índices obrigatórios:

```sql
CREATE UNIQUE INDEX whatsapp_messages_provider_id_key
  ON whatsapp_messages (provider_message_id);            -- idempotência
CREATE INDEX idx_whatsapp_messages_conversation_sent
  ON whatsapp_messages (conversation_id, sent_at DESC);  -- linha do tempo
CREATE INDEX idx_whatsapp_conversations_last_message
  ON whatsapp_conversations (last_message_at DESC);      -- ordem da lista
CREATE INDEX idx_whatsapp_contacts_phone
  ON whatsapp_contacts (phone_e164);                     -- cruzamento com clients
```

**Quatro decisões que valem explicar:**

- **`provider_message_id UNIQUE`.** Webhooks são reentregues quando dá timeout. Sem essa restrição, a mesma mensagem aparece duas vezes na tela. Na Etapa 5 ela também impede que a mensagem enviada pelo portal duplique quando o evento volta pela Evolution.
- **`raw JSONB` em toda mensagem.** O formato do payload da Evolution muda entre versões. Guardar o original permite reprocessar quando o parser estiver errado, em vez de perder a mensagem.
- **`sent_by_user_id` e `failure_reason` nascem nulos.** Só ganham uso na Etapa 5. Custam duas colunas agora e economizam uma migração depois — é o retorno prático de escrever os requisitos da etapa seguinte antes de precisar deles.
- **Contato e cliente são coisas diferentes.** Um número pode não ter cadastro; um cliente pode nunca ter escrito. Por isso `client_id` é nulo até alguém cruzar.

Gravar contato, conversa e mensagem sempre na mesma transação — `pool.connect()` + `BEGIN/COMMIT`, conforme a ADR-004.

---

## 8. Requisitos

IDs na convenção de `REQUIREMENTS.md`, prefixo `WA`.

### Receber as mensagens

- [ ] **WA-01**: O ambiente sobe a Evolution API via Docker Compose, com credenciais obrigatórias (padrão `${VAR:?}` já usado no projeto), e o número de teste conecta por QR code.
- [ ] **WA-02**: `POST /api/whatsapp/webhook` valida um segredo no header e responde `200` em menos de 2 s — **antes** de qualquer processamento pesado.
- [ ] **WA-03**: Todo evento é gravado bruto em `whatsapp_webhook_events` antes de ser interpretado.
- [ ] **WA-04**: Eventos `messages.upsert` viram contato + conversa + mensagem numa transação. Reentrega do mesmo `key.id` não duplica a linha.
- [ ] **WA-05**: Telefones normalizados para E.164 nos dois lados — nas mensagens e no `clients.fone` já cadastrado — com vínculo automático quando baterem.
- [ ] **WA-06**: Mensagens saídas do celular do hotel (`fromMe: true`) são gravadas como `outbound`. É o que faz a tela mostrar a conversa inteira, e não só o que chega.
- [ ] **WA-07**: Eventos `connection.update` atualizam `whatsapp_instances`, e o portal avisa quando o número cai.

### A tela

- [ ] **WA-08**: `GET /api/whatsapp/conversations` devolve a lista paginada por `last_message_at DESC`, com nome do contato, prévia da última mensagem e não lidas. Mesmo padrão de paginação da Fase 4 do roadmap.
- [ ] **WA-09**: `GET /api/whatsapp/conversations/:id/messages` devolve a linha do tempo paginada.
- [ ] **WA-10**: A rota `/whatsapp` mostra a lista à esquerda e a linha do tempo à direita.
- [ ] **WA-11**: Conversa vinculada a um cliente mostra, no painel lateral, nome, CPF e as reservas ativas e futuras com quarto, check-in e check-out — sem sair da tela.
- [ ] **WA-12**: Número sem cadastro mostra o telefone cru e uma ação para cadastrar como cliente novo.
- [ ] **WA-13**: A tela e as rotas exigem login e são restritas a `admin` e `manager`, via `requireRole`.
- [ ] **WA-14**: A lista atualiza sozinha, sem recarregar a página. Polling de 15 a 30 s basta para o volume de uma pousada; WebSocket não se justifica agora.
- [ ] **WA-15**: Não há campo de digitação. A tela explica que se responde pelo celular, em vez de exibir um input desabilitado sem motivo.

### Manter de pé

- [ ] **WA-16**: Erro ao processar um evento não derruba o webhook: o erro vai para `process_error` e a resposta continua `200` — senão a Evolution reenvia em loop.
- [ ] **WA-17**: Existe um comando que relê os eventos não processados e reaplica a normalização.

### Etapa 5 — enviar pelo portal

- [ ] **WA-18**: `POST /api/whatsapp/conversations/:id/messages` envia texto pela Evolution, restrito a `admin` e `manager`, e grava como `outbound` com status `sending`.
- [ ] **WA-19**: A mensagem enviada pelo portal e o evento `fromMe` que volta são reconciliados pelo `provider_message_id` — aparecem uma vez só.
- [ ] **WA-20**: Falha no envio grava `failure_reason`, marca `status = 'failed'`, mostra o motivo na linha do tempo e oferece reenviar.
- [ ] **WA-21**: Eventos `messages.update` atualizam o status para entregue e lido.
- [ ] **WA-22**: Com o número desconectado, o envio fica bloqueado com aviso explicando o motivo — não um erro genérico depois de digitar.
- [ ] **WA-23**: Toda mensagem enviada pelo portal registra quem enviou em `sent_by_user_id`, e a linha do tempo mostra o nome.

---

## 9. Etapas, riscos e cuidados

### As etapas

| Etapa | O que entrega | Requisitos | Tamanho |
|---|---|---|---|
| **0 — Sondagem** | Evolution no ar, número de teste conectado, payloads reais capturados em arquivo. Nada de produto. | — | P |
| **1 — Receber** | Tabelas, webhook, idempotência, log bruto, normalização | WA-01 a WA-04, WA-06, WA-16 | M |
| **2 — Cruzar** | Normalização E.164 dos dois lados + script para a base atual | WA-05 | P |
| **3 — A tela** | Rotas de leitura, `/whatsapp`, painel do hóspede | WA-08 a WA-15 | G |
| **4 — Manter** | Status de conexão, reprocessamento, retenção | WA-07, WA-17 | P |
| **5 — Enviar** | Envio pelo portal, status de entrega, auditoria | WA-18 a WA-23 | M |

**A Etapa 0 vem antes de tudo, sem exceção.** Escrever o parser antes de ver o payload real é a forma mais garantida de refazer o trabalho.

**A Etapa 5 só começa depois da Etapa 3 rodando com conversas reais.** É o ponto de decisão: se a recepcionista ficar confortável lendo no portal e respondendo pelo celular, talvez a Etapa 5 não valha o custo — status de entrega, falha de envio e concorrência com o aparelho são mais trabalho do que parecem.

### Riscos

| Risco | Impacto | O que fazer |
|---|---|---|
| **Banimento do número.** A Evolution é não-oficial; o WhatsApp pode bloquear. | Alto — perder o número é perder o canal | Chip dedicado, nunca o número principal, até o comportamento estar validado. Avaliar a Cloud API oficial se o canal virar crítico. |
| Sem endereço público para o webhook | Trava o desenvolvimento | Túnel em dev; decidir hospedagem para produção (seção 5.2) |
| O payload da Evolution muda entre versões | Parser quebra em silêncio | Etapa 0 com captura real antes de escrever parser; `raw JSONB` permite corrigir depois |
| `clients.fone` sujo | Painel do hóspede vazio; tela vira lista de números | WA-05 como pré-requisito |
| A Evolution precisa de Postgres e Redis próprios | Compose vai de 5 para 7 ou 8 serviços; RAM sobe | Banco separado no mesmo container, ou instância dedicada. Medir antes de decidir. |
| A recepcionista responde pelo celular e o portal demora a mostrar | Ela deixa de confiar na tela | WA-06 + WA-14. Medir o atraso real na Etapa 0. |

### LGPD

Conversa de WhatsApp é dado pessoal, e muitas vezes sensível: o hóspede explicando por que cancelou, dados de acompanhantes, comprovante de pagamento. Isso não é papelada — é a diferença entre a feature ser um ativo e ser um passivo.

- Retenção definida antes do primeiro deploy. Sugestão: 12 meses, com expurgo automático.
- Acesso restrito a `admin` e `manager` (WA-13), sem exceção.
- Avisar o hóspede de que a conversa fica registrada. Uma mensagem automática no primeiro contato resolve, e é barato.
- O `raw JSONB` guarda mais do que a tela mostra. O expurgo precisa alcançar ele também.

### Segurança

- Segredo do webhook em variável obrigatória, comparado em tempo constante.
- Nenhuma credencial da Evolution em `docker-compose.yaml` ou `.env.example` — usar `${VAR:?mensagem}`, como já se faz.
- O webhook fica fora do `authMiddleware` — a Evolution não tem sessão — mas com rate limit próprio.
- A API da Evolution não deve ser exposta ao host em produção. Só na rede interna do Compose.

---

## 10. O que eu preciso que você decida

**Duas decisões travam o começo:**

1. **O número.** Chip dedicado novo, ou o número que o hotel já usa? Recomendação forte: dedicado, por causa do risco de banimento.
2. **Onde roda em produção.** O webhook precisa de endereço público com TLS. Existe VPS e domínio, ou isso entra no escopo do trabalho?

**Uma decisão de sequenciamento:**

3. O `ROADMAP.md` diz que nenhuma feature nova entra antes das fases pendentes, e as Fases 2, 3, 5 e 6 do roadmap estão abertas. Isto é feature nova. Você quer (a) esperar, ou (b) começar agora com a Fase 2 do roadmap como dependência dura? Minha recomendação é (b) — e a Etapa 0 pode rodar em paralelo de qualquer jeito, porque não toca no produto.

**Quatro perguntas que a Etapa 0 responde sozinha** — não precisa decidir antes:

4. Volume esperado de mensagens por dia
5. Importar o histórico antigo que a Evolution sincroniza ao conectar, ou começar do zero
6. Ignorar grupos (recomendado) ou registrar
7. Guardar só o tipo da mídia, ou baixar os arquivos

---

## 11. Próximo passo

**Rodar a Etapa 0.** Subir a Evolution, conectar um número de teste, capturar os payloads reais num arquivo. Custa pouco, não toca no produto, e responde as perguntas 4 a 7 sozinha — além de validar o formato real do payload, que é a maior fonte de retrabalho nesse tipo de integração.

Em paralelo, fechar a **Fase 2 do roadmap do projeto** (Security Hardening), que é dependência dura de expor qualquer endpoint público.

---
*Revisão 3 — 2026-09-04. Substitui `ANALISE-WHATSAPP-OBSERVABILIDADE.md`. Escopo confirmado: ler primeiro, enviar como Etapa 5 planejada, IA fora desta iteração. Não constitui aprovação de escopo.*
