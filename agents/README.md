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
  tests/
  logs/
```

## Regras Operacionais

- Nenhum agente escreve direto no banco.
- Toda leitura/escrita operacional passa por `tools/backend_api.py`.
- O módulo pode rodar como microserviço separado.

## Setup

1. Copie `.env.example` para `.env`.
2. Instale dependências:

```bash
pip install -r requirements.txt
```

3. Execute:

```bash
python -m app.server
```

## Agno + OpenAI

Se `OPENAI_API_KEY` estiver definida, o `Supervisor` usa Agno para reescrever a resposta final com linguagem mais natural, sem alterar os fatos validados pelos fluxos.

Variáveis:
- `AGNO_ENABLED=true|false`
- `OPENAI_API_KEY`
- `OPENAI_MODEL` (default: `gpt-4o-mini`)

## Docker Compose

O serviço `agents-marazul` foi adicionado no `docker-compose.yaml` com build em `agents/Dockerfile`.

- Porta externa: `5051`
- Porta interna do serviço: `5050`
- Backend interno usado pelos agentes: `http://backend-marazul:5000/api`

Subir tudo:

```bash
docker compose up --build
```
