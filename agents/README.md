# Agents Layer (IA do WhatsApp)

Serviço de IA desacoplado do backend. Ele só atende a central do WhatsApp:
- classifica e prioriza conversas (triagem);
- sugere o texto da resposta, consultando as políticas por RAG;
- propõe ajustes de estilo das respostas.

Quem envia a mensagem é a recepção. O serviço não chama o backend e não cria, altera nem cancela reservas. O chat que fazia isso foi removido em `openspec/changes/harden-production-security`.

## Stack

- Python 3.12
- FastAPI
- Pydantic
- OpenAI
- RAG lexical em memória (sem acesso ao banco)

## Estrutura

```text
agents/
  app/        server, router (/health), whatsapp_router, settings, logger
  whatsapp/   triagem, sugestão, estilo e cliente do modelo
  tools/      retrieval, rag_store, prompt_loader
  rag/        base de conhecimento das políticas
  schemas/    contratos Pydantic
  prompts/    prompts do WhatsApp
  tests/
  logs/
```

## Regras operacionais

- Nenhum código daqui acessa o banco nem o backend.
- `/health` e `/whatsapp/*` exigem `X-API-Key` (`AGENTS_API_KEY`). Só o backend chama este serviço; o navegador nunca chama.
- A documentação automática do FastAPI (`/docs`, `/redoc`, `/openapi.json`) fica desabilitada.
- `/whatsapp/triage`, `/whatsapp/suggest-reply` e `/whatsapp/reply-style-proposals` recebem só os fatos e mensagens que o backend envia.
- As mensagens são dados não confiáveis para os prompts. A IA sugere e classifica, mas não envia mensagens nem decide a prioridade.

## Setup

1. Copie `.env.example` para `.env` e preencha `AGENTS_API_KEY` com `openssl rand -hex 32`. Use o mesmo valor no backend.
2. Instale as dependências:

```bash
pip install -r requirements.txt
```

3. Execute:

```bash
python -m app.server
```

Testes:

```bash
python -m pytest -q
```

## Variáveis

- `AGENTS_API_KEY`: obrigatória, com 32 caracteres ou mais
- `OPENAI_API_KEY`
- `OPENAI_MODEL` (padrão: `gpt-4o-mini`)
- `WHATSAPP_AI_MODEL` (opcional; quando vazio, usa `OPENAI_MODEL`)
- `WHATSAPP_AI_REASONING_EFFORT` (opcional)

## Docker Compose

O serviço `agents-marazul` é construído a partir de `agents/Dockerfile`. A porta interna é `5050`. No compose de desenvolvimento, ela aparece no host como `5051`.
