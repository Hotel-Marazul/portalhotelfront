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

Caso aajeite a porta que a aplica;áo vai utilizar para se comunicar a api (a mesma na qual o swagger está funcionando):

```
src/services/api.ts
```

É nele que a URL base da API deve ser configurada, por exemplo:

```ts
export const api = axios.create({
  baseURL: "http://localhost:5000",
});
```

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