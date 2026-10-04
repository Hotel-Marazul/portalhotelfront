## Context

O Compose fixa `evoapicloud/evolution-api:v2.3.7`. A implementação oficial
dessa versão oferece `POST /instance/create`, `GET /instance/connect/:name`,
`GET /instance/connectionState/:name`, `GET /instance/fetchInstances` e
`DELETE /instance/logout/:name`. O backend já possui `EvolutionClient` para
envio e leitura de estado e é a única camada autorizada a usar
`EVOLUTION_API_KEY`.

## API contract

### `GET /api/whatsapp/configuration`

Somente `admin`. Funciona mesmo quando `WHATSAPP_ENABLED=false`, para que a
tela explique o que falta. Resposta estável:

```json
{
  "connection": {
    "enabled": true,
    "instance": "marazul",
    "state": "open",
    "stateChangedAt": "2026-09-27T12:00:00.000Z",
    "apiConfigured": true,
    "webhookConfigured": true
  },
  "agent": {
    "enabled": true,
    "available": true,
    "reason": null,
    "dailyCalls": 27,
    "dailyLimit": 400,
    "mode": "assistido"
  },
  "data": { "retentionMonths": 12 },
  "metrics": {
    "conversations": 84,
    "waiting": 3,
    "inboundToday": 41,
    "outboundToday": 38,
    "failedToday": 1
  }
}
```

O endpoint nunca devolve URL, chave da Evolution, segredo do webhook, token do
backend, conteúdo de mensagem, telefone ou nome de hóspede.

### `POST /api/whatsapp/connection/qr`

Somente `admin`. Exige módulo e Evolution configurados. Reutiliza a instância
se ela existir; caso contrário cria `EVOLUTION_INSTANCE` com integração
`WHATSAPP-BAILEYS` e `qrcode=true`. Responde:

```json
{
  "state": "connecting",
  "qrCode": "data:image/png;base64,...",
  "expiresInSeconds": 45,
  "operationId": "uuid"
}
```

Se já estiver conectada, responde com `state=open`, `qrCode=null`. A resposta
usa `Cache-Control: no-store`. Formatos inesperados da Evolution viram erro
genérico; o payload bruto não é repassado.

### `DELETE /api/whatsapp/connection`

Somente `admin`. Faz logout da instância, sem excluí-la e sem apagar dados.
Retorna `204` e registra apenas evento estruturado com `operationId`, ação,
resultado e id do usuário.

## Security and privacy

- O navegador nunca chama a Evolution diretamente.
- QR Code é segredo temporário: fica apenas no estado React, é limpo ao sair da
  tela ou após o prazo e não entra em banco, storage, analytics ou logs.
- `fetchInstances` é tratado como resposta não confiável e reduzido a nome e
  estado; tokens retornados pela Evolution são descartados na borda.
- Rotas mutáveis usam `requireRole("admin")` e falham fechadas se o módulo ou as
  credenciais não estiverem configurados.
- Métricas têm somente contagens agregadas e não incluem PII.

## Observability questions

1. A integração está configurada e conectada?
2. O QR foi solicitado, criado ou falhou, e com qual código curto?
3. A IA está disponível e quanto da cota diária já foi consumido?
4. Há fila crescendo ou mensagens falhando hoje?

Cada operação de conexão gera JSON estruturado. A tela responde às perguntas
1, 3 e 4 com dados agregados. Nenhum segredo ou corpo de mensagem é logado.

## UI contract

- Cabeçalho: título, descrição e retorno à central.
- Bloco de conexão com estado textual e ícone, instância, indicadores de
  configuração, ação principal e QR com instruções de leitura.
- Bloco do agente com modo assistido, disponibilidade e consumo diário.
- Bloco de métricas com cinco valores agregados e horário da atualização.
- Estados obrigatórios: carregando, erro com tentar novamente, sem permissão,
  módulo desativado, credenciais ausentes, conectando, conectado e desconectado.
- Responsivo em 320, 768, 1024 e 1440 px; todos os controles acessíveis por
  teclado e mudanças anunciadas por região `aria-live`.

## Risks and mitigations

| Risco | Mitigação |
|---|---|
| Evolution altera o formato do QR | parser tolera os formatos documentados e falha fechado nos demais |
| `fetchInstances` devolve token | resposta é validada/reduzida e o objeto bruto nunca sai do cliente |
| QR capturado por cache | `no-store`, admin-only, TTL visual e sem persistência |
| logout acidental | diálogo de confirmação e operação que não exclui a instância |
| instância criada sem webhook | configurar webhook por instância na Evolution apontando ao backend interno; manter o webhook global do Compose desativado; a interface distingue a presença do segredo de uma mensagem efetivamente recebida |
