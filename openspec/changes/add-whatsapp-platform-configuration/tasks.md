## 1. Contrato e cliente Evolution

- [x] 1.1 Escrever testes que cubram QR direto, QR aninhado, instância ausente,
  criação, estado já aberto, resposta inválida e logout.
- [x] 1.2 Implementar no `EvolutionClient` listagem sanitizada, criação/reuso,
  conexão por QR e logout, mantendo os testes existentes verdes.
- [x] 1.3 Verificar com `cd backend && npm test`.

## 2. API administrativa e métricas

- [x] 2.1 Escrever testes para agregação sem PII e autorização exclusiva de
  `admin` nas novas rotas.
- [x] 2.2 Implementar `GET /configuration`, `POST /connection/qr` e
  `DELETE /connection`, inclusive com `no-store` e logs estruturados seguros.
- [x] 2.3 Verificar build, unitários e integração PostgreSQL aplicável.

## 3. Interface dentro da plataforma

- [x] 3.1 Criar tipos e página `/whatsapp/configuracoes` com estados de rede,
  configuração, métricas, QR temporário e confirmação de desconexão.
- [x] 3.2 Acrescentar navegação administrativa a partir da Central do WhatsApp
  e título da rota, sem expor o link como ação operacional para recepcionistas.
- [x] 3.3 Verificar `npm run lint`, `npm run build` e a suíte do frontend.

## 4. Verificação real e documentação

- [x] 4.1 Subir os serviços sem recriar volumes e validar a página no navegador
  em desktop e mobile, incluindo console, rede e acessibilidade.
- [ ] 4.2 Validar conexão/QR contra a Evolution v2.3.7 local quando houver uma
  instância de teste disponível; não escanear nem desconectar número real sem
  decisão explícita.
- [x] 4.3 Atualizar ADR/estado e registrar limitações de runtime restantes.
