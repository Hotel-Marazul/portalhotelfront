# Backend Portal Hotel (Node.js + TypeScript)

API REST em Express, com autenticação JWT, middlewares globais de segurança, CORS configurável e rotas compatíveis com o frontend atual.

## Stack

- Node.js + Express
- TypeScript
- JWT (`jsonwebtoken`)
- Hash de senha (`bcryptjs`)
- Segurança HTTP (`helmet`)
- CORS (`cors`)
- Rate limit (`express-rate-limit`)
- Validação (`zod`)

## Rodando localmente

1. Copie variáveis de ambiente:

```bash
cp .env.example .env
```

2. Instale dependências:

```bash
npm install
```

3. Execute em desenvolvimento:

```bash
npm run dev
```

A API sobe em `http://localhost:5000` por padrão.

## Seed de desenvolvimento

Para popular o banco com dados de exemplo:

```bash
npm run seed
```

Se estiver usando Docker Compose:

```bash
docker compose exec backend-marazul npm run seed
```

## Bootstrap de acesso

O servidor não cria credenciais padrão. Para criar automaticamente o primeiro
administrador, preencha `BOOTSTRAP_ADMIN_EMAIL` e `BOOTSTRAP_ADMIN_PASSWORD` no
arquivo de ambiente. A senha deve ter pelo menos 12 caracteres.

O comando `npm run seed` exige também `SEED_RECEPTIONIST_EMAIL` e
`SEED_RECEPTIONIST_PASSWORD`, usados para o usuário da recepção. A seed substitui
os dados de demonstração do banco;
execute-a somente em ambiente apropriado.

## Endpoints principais

### Público

- `POST /api/User/login`
- `POST /api/User/logout`
- `GET /health`

### Privados (cookie de sessão)

O login define o cookie `httpOnly` (`auth_token`). `GET /api/User/me` expõe
somente `id`, `email` e `role` para o frontend. Clientes de serviço também
podem usar `Authorization: Bearer <token>` quando necessário.

- Categorias:
  - `GET /api/Categories`
  - `GET /api/categories`
  - `POST /api/Categories/create`
  - `PUT /api/Categories/update/:id`
  - `DELETE /api/Categories/delete/:id`
- Quartos:
  - `GET /api/rooms`
  - `GET /api/Rooms`
  - `GET /api/rooms/summary`
  - `POST /api/Rooms`
  - `PUT /api/Rooms/update/:id`
  - `DELETE /api/Rooms/delete/:id`
- Clientes:
  - `GET /api/client`
  - `GET /api/client/:id`
  - `POST /api/client/create`
  - `PUT /api/client/:id`
- Reservas:
  - `GET /api/reservations` (paginação, filtros e CPF mascarado)
  - `GET /api/Reservations` (compatibilidade)
  - `POST /api/reservations` ou `/api/Reservations` (idempotência e preço autoritativo)
  - `POST /api/reservations/quote`
  - `PUT /api/reservations/:id`
  - `POST /api/reservations/:id/cancel`
  - `POST /api/reservations/:id/transitions`
  - `GET/POST /api/reservations/:id/payments`
  - `POST /api/reservations/:id/payments/:paymentId/reverse`
  - `DELETE /api/Reservations/:id` (cancelamento lógico legado)
  - `GET /api/reservations/counter-summary`
  - `GET /api/reservations/revenue-summary` (somente `admin`)
- Regras de preço:
  - `GET /api/GuestPricingRule`
  - `GET /api/pricing-rules`
- WhatsApp (recepção e gerente; webhook separado):
  - `GET /api/whatsapp/status`, `/queue`, `/conversations` e `/messages`
  - `POST /api/whatsapp/conversations/:id/messages` e `/suggestion`
  - `PUT /api/whatsapp/conversations/:id/outcome`
  - `/api/whatsapp/learning/*` para métricas e decisões administrativas
  - `POST /api/whatsapp/webhook` recebe eventos da Evolution com segredo próprio

Variáveis WhatsApp principais: `WHATSAPP_ENABLED`, `EVOLUTION_API_URL`,
`EVOLUTION_API_KEY`, `EVOLUTION_INSTANCE`, `WHATSAPP_WEBHOOK_SECRET`,
`WHATSAPP_AI_ENABLED`, `AGENTS_API_URL`, `AGENTS_API_KEY` e
`WHATSAPP_AI_DAILY_LIMIT`. O agente nunca acessa o banco; fatos enviados para
IA não incluem CPF, telefone, e-mail ou pagamentos.

## Integração com frontend

No frontend, configure:

```bash
NEXT_PUBLIC_API_URL=http://localhost:5000
```

O frontend usa `NEXT_PUBLIC_API_URL` e envia o cookie `auth_token` HttpOnly
automaticamente nas requisições autenticadas.

São dois perfis: `receptionist` (recepção) e `admin` (gerente). A recepção pode
operar clientes, reservas e finanças de uma reserva, incluindo pagamentos. O
resumo financeiro consolidado exige `admin`; categorias e quartos também exigem
`admin` e são
validados no backend. O serviço de agentes usa um gateway autenticado; o
navegador nunca recebe seus segredos nem acessa o PostgreSQL diretamente.
