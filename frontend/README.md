# **Frontend – (Next.js)**

Este projeto foi criado com **Next.js** 

---

## **Como iniciar o projeto**

### **1. Instale as dependências**

```bash
npm install
```

(Se preferir, também funciona com `yarn`, `pnpm` ou `bun`.)

---

### **2. Execute o servidor de desenvolvimento**

```bash
npm run dev
```

Após iniciar, acesse:

```
http://localhost:3000
```

## **Configuração importante (API Backend)**

Configure a URL pública do backend pela variável de ambiente:

```bash
NEXT_PUBLIC_API_URL=http://localhost:5000
```

O cliente compartilhado fica em `src/services/api.ts` e usa o cookie de sessão
HttpOnly enviado pelo backend.

---

## **Build de produção**

Para gerar o build:

```bash
npm run build
```

Para rodar o servidor de produção:

```bash
npm start
```

---

## **Requisitos**

* Node.js 18+
* NPM (ou Yarn, PNPM, Bun)

---

## **Backend Node.js (novo)**

Foi adicionada uma API backend em `backend/` com:

* Autenticação JWT
* Middlewares de segurança (`helmet`, rate limit, validação)
* CORS configurável por ambiente
* Rotas compatíveis com o frontend atual

Documentação completa em:

```
backend/README.md
```
