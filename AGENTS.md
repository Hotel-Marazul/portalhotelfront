# AGENTS.md — Guia de continuidade do PortalHotel

Este arquivo é o ponto de entrada para qualquer agente de IA que vá entender,
construir, corrigir ou evoluir o PortalHotel. Leia-o antes de alterar código.

Atue como um programador fullstack sênior, preservando boas práticas de
segurança, escalabilidade e manutenção.

## Índice

- [1. Como trabalhar neste projeto](#secao-1)
- [2. Navegação, skills e Graphify](#secao-2)
- [3. Produto e limites de escopo](#secao-3)
- [4. Arquitetura e estrutura](#secao-4)
- [5. Backend — API e domínio](#secao-5)
- [6. Frontend — interface](#secao-6)
- [7. Serviço de IA — `agents/`](#secao-7)
- [8. Documentação de domínio e planejamento](#secao-8)
- [9. Estado conhecido e prioridades](#secao-9)
- [10. Variáveis de ambiente e Docker](#secao-10)
- [11. Comandos de trabalho](#secao-11)

<a id="secao-1"></a>

## 1. Como trabalhar neste projeto

O PortalHotel é um projeto brownfield. Preserve as alterações que já existem
no working tree antes de iniciar qualquer mudança.

1. Ler este arquivo e a documentação do domínio afetada.
2. Inspecionar `git status` e o diff existente, preservando o trabalho local.
3. Consultar o Graphify antes de explorar o código e ler as skills relevantes.
4. Traçar a mudança de ponta a ponta: UI → API → persistência → runtime.
5. Definir o contrato antes de duplicar tipos ou alterar payloads.
6. Implementar a menor mudança coerente, mantendo compatibilidade quando
   houver consumidores existentes.
7. Adicionar ou atualizar teste para regra crítica, segurança ou integração.
8. Rodar build, lint e testes aplicáveis.
9. Verificar logs e comportamento real; build verde sozinho não prova runtime.
10. Atualizar `.mente/`, `.planning/` ou este arquivo quando a decisão mudar.
11. Relatar arquivos alterados, validações executadas e riscos restantes.

Nunca use `git reset --hard`, `git checkout --` ou remoções amplas para
“limpar” o projeto. `backend/dist/`, `frontend/.next/` e `node_modules/` são
artefatos gerados; não os trate como fonte de código.

<a id="secao-2"></a>

## 2. Navegação, skills e Graphify

### Consulta ao grafo

O projeto possui um grafo em `graphify-out/`, com comunidades e relações entre
arquivos. Quando o usuário digitar `/graphify`, use a skill instalada ou suas
instruções antes de qualquer outra ação.

- Quando `graphify-out/graph.json` existir, execute `graphify query "<pergunta>"`
  antes da primeira busca, grep ou leitura de código sobre o projeto. Inclua
  essa regra nos prompts de subagentes que forem explorar o código.
- Leia arquivos brutos apenas nos trechos localizados pelo grafo ou por uma
  leitura anterior. Use `graphify path "<A>" "<B>"` para relações e
  `graphify explain "<conceito>"` para conceitos específicos.
- Se `graphify-out/wiki/index.md` existir, use-o para navegação ampla antes de
  explorar os fontes diretamente.
- Leia `graphify-out/GRAPH_REPORT.md` apenas em revisões amplas de arquitetura
  ou quando `query`, `path` e `explain` não trouxerem contexto suficiente.
- Alterações locais em `graphify-out/` são esperadas após hooks e atualizações
  incrementais; não justificam ignorar o grafo. Só pule o Graphify se a tarefa
  tratar de saída incorreta ou desatualizada do próprio grafo, ou se o usuário
  pedir explicitamente.

### Escolha e leitura das skills

As skills reutilizáveis ficam em `.agents/skills/`. Consulte apenas as que
correspondam à tarefa e leia seu `SKILL.md` completo antes de aplicá-las.
As skills complementam estas instruções do projeto; não as substituem.
Comece pela [descoberta de skills](.agents/skills/using-agent-skills/SKILL.md)
quando precisar escolher um fluxo.

O grafo inclui os `SKILL.md`, documentos de apoio e scripts suportados de
`.agents/skills/`. Essa pasta orienta os assistentes de desenvolvimento;
`agents/` (sem ponto) é o serviço de IA do produto. O grafo auxilia a
navegação e não substitui a leitura das instruções.

```bash
graphify query "frontend-ui-engineering"
graphify query "git-workflow-and-versioning" --seed ".agents/skills/git-workflow-and-versioning/SKILL.md"
```

### Atualização do mapa

- Após modificar código, execute `graphify update .`.
- Ao adicionar, alterar ou remover skills em `.agents/`, execute o mesmo
  comando e confirme os caminhos afetados no grafo.
- A atualização é estrutural: títulos, links e código suportado, sem chamadas
  a modelos ou custo de API. Não equivale à extração semântica completa dos textos.
- Mantenha `.agents` fora de `excludes` em `graphify-out/.graphify_build.json`.
- `graphify-out/graph.json` é reescrito por inteiro em cada geração. Um diff
  grande é esperado; não o trate como ruído nem sugira pular a atualização
  ou seus hooks.

<a id="secao-3"></a>

## 3. Produto e limites de escopo

O PortalHotel é um sistema interno de gestão para um hotel ou pousada. O
produto cobre:

- autenticação de usuários com papéis `admin` (gerente) e `receptionist`
  (recepção);
- cadastro de categorias, quartos e hóspedes;
- disponibilidade e ciclo de vida de reservas;
- hóspedes adicionais e regras de preço;
- pagamentos registrados na reserva;
- dashboard operacional de ocupação, receita e status dos quartos;
- um serviço de agentes de IA para atendimento, consulta e operações de
  reserva;
- uma base RAG local para políticas do hotel.

O PostgreSQL é a fonte de verdade operacional. O frontend não acessa o banco.
O serviço de IA também não acessa o banco: ele chama a API do backend.

### Limites de evolução

O sistema atual é para um único hotel. Não introduza multi-tenancy, channel
manager, pagamentos online, app mobile ou uma migração para outro PMS sem uma
decisão explícita de produto e um plano de dados. A IA pode apoiar operação e
inteligência de negócio, mas o backend continua responsável por autorização,
regras de reserva, dinheiro e consistência do banco.

<a id="secao-4"></a>

## 4. Arquitetura e estrutura

```text
Navegador
   ↓
frontend/ — Next.js 15, React 19, MUI (porta 3000 no container; 3002 no Compose)
   ↓ HTTP + cookie httpOnly
backend/ — Express 4 + TypeScript ESM (porta 5000)
   ↓ pg
PostgreSQL 16 — banco portal_hotel

agents/ — FastAPI + Python (porta 5050 no container; 5051 no host)
   └── recebe chamadas do backend (X-API-Key); não chama o backend
```

Os três serviços são independentes e se comunicam por HTTP na rede do Docker.
Não há pacote compartilhado entre TypeScript e Python; contratos precisam ser
mantidos nos dois lados.

### Mapa da raiz

```text
frontend/              Interface web e experiência do usuário
backend/               API, autenticação, regras e persistência
agents/                Serviço de IA, orquestração e RAG
.mente/                Base de conhecimento do domínio e decisões técnicas
.planning/             Projeto, requisitos, roadmap e estado do planejamento
.github/workflows/     CI
docker-compose.yaml    Ambiente local containerizado
.env.compose.example   Modelo de variáveis do Compose, sem segredos
.claude/CLAUDE.md      Instruções adicionais para agentes de código
.agents/skills/         Skills reutilizáveis para agentes de código
```

<a id="secao-5"></a>

## 5. Backend — API e domínio

Caminhos relativos abaixo partem de `backend/src/`, salvo indicação contrária.

### Arquivos de entrada e infraestrutura

- `backend/src/server.ts`: inicia o servidor HTTP e a inicialização do banco.
- `backend/src/app.ts`: monta Express, middlewares e rotas.
- `backend/src/routes/index.ts`: registro das rotas dos módulos.
- `backend/src/config/env.ts`: lê e valida variáveis de ambiente.
- `backend/src/config/cors.ts`: origens permitidas para o frontend.
- `backend/src/db/client.ts`: pool PostgreSQL e helper de queries.
- `backend/src/db/init.ts`: criação do schema, índices, constraints e defaults.
- `backend/src/db/seed.ts`: dados de desenvolvimento; nunca usar para apagar
  dados reais sem uma decisão explícita.
- `backend/src/domain/models.ts`: tipos e DTOs usados pelo domínio.

### Middlewares e utilitários

- `middlewares/auth.middleware.ts`: autentica cookie `auth_token` ou Bearer.
- `middlewares/require-role.ts`: restringe rotas a papéis autorizados.
- `middlewares/validate.ts`: executa schemas Zod.
- `middlewares/security.ts`: Helmet, CORS/rate limit e proteções HTTP.
- `middlewares/error-handler.ts` e `not-found.ts`: erros HTTP consistentes.
- `utils/reservation.ts`: datas, noites e cálculo central do preço.
- `utils/jwt.ts`: criação e leitura de JWT.
- `utils/http-error.ts` e `utils/async-handler.ts`: suporte às rotas.

### Módulos de negócio

- `modules/auth/`: login, logout, bootstrap e autenticação.
- `modules/categories/`: categorias de quarto e preço base.
- `modules/rooms/`: quartos, capacidade, status e disponibilidade.
- `modules/clients/`: hóspedes/clientes e histórico de reservas.
- `modules/pricing-rules/`: regras de preço por faixa/tipo de hóspede.
- `modules/reservations/`: criação, edição, cancelamento, hóspedes,
  disponibilidade, resumo de ocupação, receita e pagamentos.

Cada módulo normalmente possui `*.routes.ts` e `*.schema.ts`. Validação de
entrada deve ficar no schema; regras de negócio e transações devem ficar na
rota ou em um serviço claramente testável.

### Modelo operacional atual

As tabelas principais são `users`, `categories`, `rooms`, `clients`,
`pricing_rules`, `reservations`, `reservation_guests` e
`reservation_payments`.

Status de reserva aceitos: `Pendente`, `Confirmada`, `EmAndamento`,
`Concluída` e `Cancelada`. Status ativos bloqueiam disponibilidade;
`Cancelada` não bloqueia.

O intervalo da reserva é `[check_in_date, check_out_date)`. O primeiro hóspede
é incluído no preço base; hóspedes adicionais usam `pricing_rules`.

### Contratos de API principais

Rotas legadas PascalCase ainda existem para compatibilidade, mas rotas novas
devem usar kebab-case minúsculo:

```text
POST /api/User/login
POST /api/User/logout
GET  /health

GET/POST          /api/rooms
GET               /api/rooms/summary
PUT/DELETE        /api/rooms/:id

GET/POST          /api/client
GET/PUT           /api/client/:id

GET/POST          /api/reservations
PUT/DELETE        /api/reservations/:id
GET               /api/reservations/counter-summary
GET               /api/reservations/revenue-summary

GET/POST/PUT/DELETE /api/categories ou /api/pricing-rules
```

Confira o arquivo de rota antes de assumir payload ou status. O frontend usa
os DTOs retornados pela API, não deve duplicar cálculo de preço ou disponibilidade.

<a id="secao-6"></a>

## 6. Frontend — interface

Caminhos relativos abaixo partem de `frontend/src/`.

### Páginas em `frontend/src/app/`

- `login/page.tsx`: entrada e autenticação.
- `dashboard/page.tsx`: KPIs, ocupação, receita e status dos quartos.
- `reservas/page.tsx`: listagem, filtros, status e detalhes de reservas.
- `cliente/page.tsx`: cadastro e histórico de hóspedes.
- `quarto/page.tsx`: cadastro, edição e resumo de quartos.
- `categoria/page.tsx`: categorias e seus preços.
- `agente/page.tsx`: chat com o serviço de IA.
- `layout.tsx`, `loading.tsx` e `page.tsx`: shell e rotas iniciais.

### Componentes e suporte

- `components/dashboard/`: cartões, gráfico de ocupação e status.
- `components/reservations/`: tabela, filtros, drawer, hóspedes e badges.
- `components/clientes/`: modais de hóspede e nova reserva.
- `components/quartos/` e `components/categorias/`: CRUD visual.
- `components/layout/`, `header.tsx`, `sidenav.tsx`: layout comum.
- `services/api.ts`: cliente HTTP compartilhado; respeita `NEXT_PUBLIC_API_URL`
  e envia credenciais de cookie.
- `services/apiService.ts`: wrapper legado; não criar novas integrações nele
  sem verificar os métodos disponíveis.
- `types/`, `utils/` e `hooks/`: tipos, formatação, CPF, cache e fetch.
- `theme/` e `styles/`: identidade visual e estilos globais.

Alterações de UI devem preservar os estados de carregamento, erro, vazio e
permissão. O browser nunca recebe segredo do banco, token interno dos agentes
ou credencial de provedor de IA.

<a id="secao-7"></a>

## 7. Serviço de IA — `agents/`

`agents/` é um microserviço separado. Ele interpreta linguagem natural, mas não
é a fonte de verdade. Os caminhos abaixo partem de `agents/`.

### Arquivos e responsabilidades

- `app/server.py`: inicializa FastAPI.
- `app/router.py`: `/health` e autenticação do serviço.
- `app/whatsapp_router.py`: triagem, sugestão e estilo do WhatsApp.
- `app/settings.py`: configuração e variáveis de ambiente.
- `app/logger.py`: logs estruturados sem conteúdo sensível.
- `tools/rag_store.py`, `retrieval.py`, `prompt_loader.py`: recuperação e prompts.
- `schemas/`: contratos Pydantic do WhatsApp e da evidência do RAG.
- `prompts/`: prompts do WhatsApp.
- `rag/knowledge/`: documentos que podem ser usados pelo RAG.
- `whatsapp/`: schemas, cliente estruturado da OpenAI e endpoints de
  triagem/sugestão; o serviço recebe fatos sanitizados do backend.
- `rag/ingest.py` e `rag/schema.md`: indexação e formato dos documentos.
- `tests/`: testes de autenticação e do WhatsApp.
- `logs/`: somente saída de runtime; não colocar dados de hóspedes em logs.

### Regras obrigatórias para IA

1. Nunca acessar PostgreSQL diretamente a partir de `agents/`.
2. O serviço não chama o backend e não cria, altera nem cancela reservas.
3. Nunca inventar disponibilidade, preço, política, status ou ID.
4. Exibir os detalhes e obter confirmação antes de criar ou alterar reserva.
5. Preço, datas, capacidade e prevenção de overbooking são determinísticos.
6. Não enviar CPF, dados de pagamento, cookies ou credenciais ao modelo.
7. Usar `OPENAI_API_KEY`, `OPENAI_MODEL` e `WHATSAPP_AI_MODEL` somente por
   ambiente; nunca commitar nem imprimir valores. `WHATSAPP_AI_MODEL` usa
   `OPENAI_MODEL` quando vazio.

<a id="secao-8"></a>

## 8. Documentação de domínio e planejamento

`AGENTS.md`, [.claude/CLAUDE.md](.claude/CLAUDE.md) e a documentação em
`.mente/` devem ser lidos em conjunto. Em caso de divergência, confirme o
comportamento no código e atualize a documentação correspondente.

Leia antes de mudar uma regra de negócio:

- `.mente/dominio/hotelaria-conceitos.md`: conceitos e métricas hoteleiras.
- `.mente/dominio/reservas-regras-negocio.md`: ciclo, preço e disponibilidade.
- `.mente/tecnico/arquitetura-decisoes.md`: ADRs e padrões adotados.
- `.mente/tecnico/stack-e-bibliotecas.md`: stack e convenções.
- `.mente/bugs/bugs-conhecidos.md`: falhas conhecidas e severidade.

Use `.planning/PROJECT.md`, `REQUIREMENTS.md`, `ROADMAP.md` e `STATE.md` para
entender o milestone atual. Se o código e o planejamento divergirem, registre a
diferença e atualize o documento apropriado depois da decisão.

<a id="secao-9"></a>

## 9. Estado conhecido e prioridades

Antes de adicionar funcionalidades, priorize integridade e segurança:

- garantir transação atômica em criação/edição de reserva;
- manter a proteção contra overbooking no banco e na transação;
- substituir ocupação mensal fictícia por agregação real;
- exigir autenticação do serviço de agentes;
- remover credenciais padrão e não expor segredos;
- validar CPF no backend;
- paginar listagens grandes;
- cobrir regras críticas com testes;
- padronizar novas rotas em kebab-case.

O inventário detalhado está em `.mente/bugs/bugs-conhecidos.md`.

Essa lista de prioridades vem do inventário do projeto e pode ficar defasada.
Confirme cada item no código, nos testes e no `git diff` antes de reaplicar uma
correção; uma alteração local já pode ter resolvido parte dele.

<a id="secao-10"></a>

## 10. Variáveis de ambiente e Docker

Arquivos locais esperados, todos fora do Git:

- `backend/.env`: banco, JWT, CORS e bootstrap administrativo;
- `agents/.env`: URL do backend, Bearer token, RAG e IA;
- `frontend/.env.local`: URL pública da API;
- `.env`: valores usados pelo Compose, conforme `.env.compose.example`.

O Compose sobe frontend, backend, agents, PostgreSQL e pgAdmin. Use os nomes
dos serviços (`backend-marazul`, `agents-marazul`, `db-marazul`) dentro da rede
Docker; use `localhost` somente a partir do host.

<a id="secao-11"></a>

## 11. Comandos de trabalho

```bash
# Backend
cd backend && npm install
cd backend && npm run dev
cd backend && npm run build
cd backend && npm run seed

# Frontend
cd frontend && npm install
cd frontend && npm run dev
cd frontend && npm run build
cd frontend && npm run lint

# Agents
cd agents && pip install -r requirements.txt
cd agents && python -m app.server

# Ambiente completo
docker compose up --build
```

Não execute `seed` contra um banco real sem verificar o ambiente e sem uma
decisão explícita para usar dados de desenvolvimento.
