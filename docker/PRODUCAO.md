# Produção na VPS (Hostinger + Caddy)

Os endereços ficam assim:

- `hotelmarazul.com`: a landing.
- `app.hotelmarazul.com`: o portal, com a API em `/api`.

Só o Caddy abre portas (80 e 443) e emite os certificados HTTPS sozinho.

## 1. DNS (no painel onde o domínio foi comprado)

Crie três registros `A`, todos apontando para o IP da VPS:

| Nome  | Tipo | Valor       |
|-------|------|-------------|
| `@`   | A    | IP da VPS   |
| `www` | A    | IP da VPS   |
| `app` | A    | IP da VPS   |

## 2. Firewall da VPS

Deixe abertas só as portas 22 (SSH), 80 e 443:

```bash
ufw allow 22/tcp && ufw allow 80/tcp && ufw allow 443/tcp && ufw allow 443/udp && ufw enable
```

O Docker publica portas por fora do `ufw`. Por isso, o compose de produção não publica nada além do Caddy.

## 3. Variáveis

```bash
cp .env.production.example .env.production
openssl rand -hex 32   # rode uma vez para cada segredo: JWT_SECRET, AGENTS_API_KEY, senhas
```

Preencha `DOMAIN` (sem `https://` e sem `app.`) e `ACME_EMAIL`. Na primeira subida, preencha também `BOOTSTRAP_ADMIN_EMAIL` e `BOOTSTRAP_ADMIN_PASSWORD`. Depois que o gerente existir, apague a senha do arquivo.

## 4. Subir

```bash
docker compose -f docker-compose.prod.yaml --env-file .env.production up -d --build
# com WhatsApp:
docker compose -f docker-compose.prod.yaml --env-file .env.production --profile whatsapp up -d --build
```

O webhook da Evolution aponta para a rede interna (`http://backend:5000/api/whatsapp/webhook`) e manda o cabeçalho `x-webhook-secret`. O Caddy bloqueia essa rota por fora.

## 5. Conferir

```bash
curl -I https://app.$DOMAIN/health            # 200
curl -I https://app.$DOMAIN/api/reservations  # 401
```

O cookie `auth_token` precisa sair com `HttpOnly; Secure; SameSite=Lax`.

## Banco

O banco não fica exposto. Para usá-lo:

```bash
docker compose -f docker-compose.prod.yaml --env-file .env.production exec db psql -U "$DB_USER" portal_hotel
```

O pgAdmin não sobe em produção.

Faça backup diário com `pg_dump` e guarde a cópia fora da VPS.
