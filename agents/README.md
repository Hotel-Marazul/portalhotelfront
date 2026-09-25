# Agents Layer (Multiagentes + RAG)

Camada de IA desacoplada do backend principal, com foco em:
- atendimento conversacional;
- consulta de disponibilidade com prevenção de overbooking;
- consulta de políticas via RAG;
- orquestração de decisão e execução via API interna.

## Stack

- Python 3.11+
- FastAPI
- Pydantic
- HTTPX
- Agno + OpenAI (opcional para redação final da resposta)
- RAG lexical em memória (sem acesso direto ao banco)

## Estrutura

```text
agents/
  app/
  orchestration/
  agents/
  tools/
  rag/
  schemas/
  prompts/
  whatsapp/
  tests/
  logs/
```

## Regras Operacionais

- Nenhum agente escreve direto no banco.
- Toda leitura/escrita operacional passa por `tools/backend_api.py`.
- O módulo pode rodar como microserviço separado.
- `/chat`, `/health` e `/tools` exigem `X-API-Key`; `/chat` também exige contexto assinado (`X-Agent-Initiator`); o navegador nunca chama o FastAPI diretamente.
- A documentação automática do FastAPI (`/docs`, `/redoc`, `/openapi.json`) permanece desabilitada.
- Operações de reserva exigem proposta válida e a confirmação explícita `confirmo`; falhas não são convertidas em sucesso.
- Conversas e propostas ficam vinculadas ao usuário iniciador; uma confirmação de cancelamento também revalida a fotografia da reserva antes da escrita.
- O escopo técnico não expõe listagens gerais ao agente; detalhes retornados ao serviço contêm somente os campos necessários à operação, sem pagamentos ou CPF.
- `/whatsapp/triage`, `/whatsapp/suggest-reply` e `/whatsapp/reply-style-proposals` exigem `X-API-Key`, não usam `tools/backend_api.py` e recebem somente fatos/mensagens enviados pelo backend.
- Mensagens são dados não confiáveis para os prompts; a IA sugere e classifica, mas não envia mensagens nem decide a prioridade.

## Setup

1. Copie `.env.example` para `.env` e preencha `BACKEND_BEARER_TOKEN` e `AGENTS_API_KEY` com valores independentes gerados por `openssl rand -hex 32`.
2. Instale dependências:

```bash
pip install -r requirements.txt
```

3. Execute:

```bash
python -m app.server
```

Checks executáveis (não exigem framework adicional):

```bash
for file in tests/test_*.py; do python "$file"; done
```

## Agno + OpenAI

Se `OPENAI_API_KEY` estiver definida e `AGNO_ENABLED=true`, o Supervisor usa Agno apenas para mensagens sem mutação; fatos operacionais validados não passam por reescrita generativa.

Variáveis:
- `AGNO_ENABLED=true|false`
- `AGENTS_MUTATIONS_ENABLED=true|false` — desligue para rollback imediato de criação/edição/cancelamento sem interromper consultas; valores desconhecidos desabilitam as mutações.
- `OPENAI_API_KEY`
- `OPENAI_MODEL` (default: `gpt-4o-mini`)
- `WHATSAPP_AI_MODEL` (opcional; usa `OPENAI_MODEL` quando vazio)

## Docker Compose

O serviço `agents-marazul` foi adicionado no `docker-compose.yaml` com build em `agents/Dockerfile`.

- Porta externa: `5051`
- Porta interna do serviço: `5050`
- Backend interno usado pelos agentes: `http://backend-marazul:5000/api`

Subir tudo:

```bash
docker compose up --build
```
