# Fixtures da Evolution

Sondagem da instância de teste `Marazul` com a imagem `evoapicloud/evolution-api:v2.3.7`.
Os JSON desta pasta são cópias anonimizadas: números, nomes, textos, ids, URLs e
valores de mídia foram substituídos por valores fictícios. O payload bruto ficou
somente em `/tmp/whatsapp-evolution-capture` e não entra no Git.

## Webhook

- Endpoint temporário usado: túnel Quick Tunnel do `cloudflared`.
- Segredo: header customizado `x-webhook-secret`; o valor não é registrado neste
  arquivo. A Evolution aceitou o header na configuração da instância.
- Eventos configurados na Evolution: `MESSAGES_UPSERT`, `MESSAGES_UPDATE` e
  `CONNECTION_UPDATE`.
- Nomes recebidos no payload: `messages.upsert`, `messages.update` e
  `connection.update`.
- `webhook_by_events`: `false`.
- `webhook_base64`: `false`.

## Campos observados

| Dado | Caminho observado |
|---|---|
| evento | `event` |
| instância | `instance` |
| id da mensagem | `data.key.id` |
| remetente do hotel | `data.fromMe` e `data.key.fromMe` |
| nome enviado pelo WhatsApp | `data.pushName` |
| instante | `data.messageTimestamp` (Unix, segundos) |
| JID do contato | `data.key.remoteJid` |
| texto simples | `data.message.conversation` |
| legenda de imagem | `data.message.imageMessage.caption` |
| áudio | `data.message.audioMessage` (sem download/base64) |
| reação | `data.message.reactionMessage.text` e `data.message.reactionMessage.key.id` |
| status | `data.status` |
| estado da conexão | `data.state` |

No texto recebido houve também `data.message.messageContextInfo`. Mensagens de
mídia não trouxeram conteúdo base64 com a configuração usada.

## Valores observados

- `messages.upsert`: `SERVER_ACK` e `DELIVERY_ACK` em `data.status`.
- `messages.update`: `DELIVERY_ACK` e `READ` em `data.status`.
- `connection.update`: `connecting`, `close` e `open` em `data.state`.
- Foram capturados textos de entrada e saída, imagem com legenda, áudio e reação.
- Não foi capturada mensagem de grupo: não havia grupo de teste disponível.

## Fixtures

- `messages-upsert-inbound-text.json`
- `messages-upsert-outbound-text.json`
- `messages-upsert-image-caption.json`
- `messages-upsert-audio.json`
- `messages-upsert-inbound-reaction.json`
- `messages-upsert-outbound-reaction.json`
- `messages-update-delivery.json`
- `messages-update-read.json`
- `connection-update-connecting.json`
- `connection-update-close.json`
- `connection-update-open.json`

## Envio de texto pela API

Contrato da versão `v2.3.7`, mantido aqui com valores fictícios:

```http
POST /message/sendText/Marazul
apikey: <EVOLUTION_API_KEY>
Content-Type: application/json
```

```json
{
  "number": "5511000000000",
  "options": {
    "delay": 1200,
    "presence": "composing"
  },
  "textMessage": {
    "text": "mensagem fictícia"
  }
}
```

Resposta esperada pela API:

```json
{
  "key": {
    "remoteJid": "5511000000000@s.whatsapp.net",
    "fromMe": true,
    "id": "fixture-message-001"
  },
  "message": {
    "extendedTextMessage": {
      "text": "mensagem fictícia"
    }
  },
  "messageTimestamp": "1790000000",
  "status": "PENDING"
}
```

Esse endpoint não foi chamado automaticamente durante a sondagem, para manter a
regra de que nenhuma mensagem sai sem ação humana. A confirmação prática do
contrato ficará para a implementação do cliente da Evolution, quando houver o
clique de envio da recepção.

## Latência

Foram usados 10 `messages.upsert` de entrada com `messageTimestamp` e o instante
de recebimento gravado pelo capturador:

- mediana: **0,722 s**;
- máximo: **1,038 s**;
- mínimo: **0,193 s**.

## Limitação conhecida

A fixture de grupo permanece pendente porque não há grupo de teste disponível.
Não se deve criar um payload sintético para substituir uma captura real; o parser
deverá tratar JIDs `@g.us` como ignorados quando essa fixture estiver disponível.
