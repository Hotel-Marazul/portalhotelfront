# Backend Portal Hotel (Node.js + TypeScript)

API REST em Express, com autenticaÃ§Ã£o JWT, middlewares globais de seguranÃ§a, CORS configurÃ¡vel e rotas compatÃ­veis com o frontend atual.

## Stack

- Node.js + Express
- TypeScript
- JWT (`jsonwebtoken`)
- Hash de senha (`bcryptjs`)
- SeguranÃ§a HTTP (`helmet`)
- CORS (`cors`)
- Rate limit (`express-rate-limit`)
- ValidaÃ§Ã£o (`zod`)

## Rodando localmente

1. Copie variÃ¡veis de ambiente:

```bash
cp .env.example .env
```

2. Instale dependÃªncias:

```bash
npm install
```

3. Execute em desenvolvimento:

```bash
npm run dev
```

A API sobe em `http://localhost:5000` por padrÃ£o.

## Seed de desenvolvimento

Para popular o banco com dados de exemplo:

```bash
npm run seed
```

Se estiver usando Docker Compose:

```bash
docker compose exec backend-marazul npm run seed
```

## UsuÃ¡rio inicial

- Email: `admin@hotel.com`
- Senha: `admin`

## Endpoints principais

### PÃºblico

- `POST /api/User/login`
- `POST /api/User/logout`
- `GET /health`

### Privados (Bearer Token)

TambÃ©m aceitam cookie `httpOnly` (`auth_token`) definido no login.

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
  - `GET /api/Reservations`
  - `POST /api/Reservations`
  - `PUT /api/Reservations/:id`
  - `DELETE /api/Reservations/:id`
  - `GET /api/reservations/counter-summary`
  - `GET /api/reservations/revenue-summary`
- Regras de preÃ§o:
  - `GET /api/GuestPricingRule`
  - `GET /api/pricing-rules`

## IntegraÃ§Ã£o com frontend

No frontend, configure:

```bash
NEXT_PUBLIC_API_URL=http://localhost:5000
```

O arquivo `src/services/api.ts` jÃ¡ estÃ¡ preparado para enviar `Authorization: Bearer <token>` automaticamente.


