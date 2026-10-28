## Why

O portal vai para produção numa VPS da Hostinger, atrás do Caddy. A landing fica em `hotelmarazul.com`; o portal e a API ficam em `app.hotelmarazul.com`, com a API em `/api`. A revisão de segurança de 2026-10-28 encontrou:

- dependências com alerta crítico, entre elas uma RCE no otimizador de imagens do Next;
- um compose que só serve para desenvolvimento;
- duas permissões largas demais;
- uma rota de chat de IA que ninguém usa mais, mas que ainda consegue criar e cancelar reservas.

## What Changes

- Atualizar as dependências com alerta, sem trocar de versão maior. O zod 3→4 fica registrado como adiado.
- Remover o chat do agente de ponta a ponta: `/api/agent/*` no backend, o token de serviço `AGENTS_SERVICE_TOKEN`, `/chat` e a orquestração de reservas no FastAPI, e `BACKEND_BEARER_TOKEN`. O agente continua só no WhatsApp, onde lê, prioriza e sugere texto.
- Restringir ao `admin` o estorno de pagamento e a exclusão de cliente.
- Endurecer os middlewares do backend:
  - `trust proxy` por número de saltos;
  - JWT só aceita `HS256`, e em produção o segredo precisa ter 32 caracteres ou mais;
  - o login leva o mesmo tempo quando o e-mail não existe;
  - origem recusada pelo CORS devolve 403;
  - mutações vindas de outra origem são recusadas;
  - erros 500 vão para o log.
- Enviar cabeçalhos de segurança no frontend.
- Criar o compose de produção com Caddy. Só o Caddy publica portas.
- Criar a matriz de testes de RBAC: sem token, recepção, token falso e webhook.

## Capabilities

### New Capabilities

- `production-security`: autenticação, autorização e configuração de produção.

## Impact

- **Backend:** `middlewares/`, `routes/index.ts`, `config/env.ts`, `utils/jwt.ts`, `modules/auth`, `modules/agents` (removido), `modules/clients`, `modules/reservations`.
- **Agents:** `/chat`, `orchestration/`, `agents/` e `tools/backend_api.py` saem.
- **Frontend:** `next.config.ts` e a exclusão de cliente e o estorno passam a ficar escondidos para a recepção.
- **Infra:** `docker-compose.prod.yaml`, `Caddyfile`, `.env.production.example`.
