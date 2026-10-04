## Why

O PortalHotel já opera a fila, a triagem e o aprendizado do WhatsApp, mas a
conexão do número ainda depende do painel externo da Evolution. O gerente não
consegue saber, dentro do portal, se as credenciais foram configuradas, qual é
o estado da instância, quanto da cota diária de IA foi usado ou como parear o
número quando a sessão cai.

Esta mudança cria uma área administrativa nativa para observar e operar essa
integração sem levar segredos para o navegador.

## Capability map

| Capability | Responsabilidade | Depende de |
|---|---|---|
| `whatsapp-platform-connection` | Estado seguro da configuração, criação/reuso da instância, QR Code temporário e desconexão | Evolution API e autenticação admin |
| `whatsapp-platform-observability` | Indicadores do canal, disponibilidade e consumo do agente, retenção e diagnóstico seguro | tabelas WhatsApp e configuração por ambiente |

Ordem: `whatsapp-platform-connection` -> `whatsapp-platform-observability` ->
interface administrativa que reúne as duas capacidades.

## What Changes

- Criar `/whatsapp/configuracoes`, visível dentro da plataforma e voltado ao
  gerente (`admin`).
- Expor somente presença/ausência de credenciais e valores operacionais não
  sensíveis. Chaves, tokens e o segredo do webhook continuam exclusivamente
  nos arquivos `.env`/Secrets e nunca aparecem em respostas HTTP ou logs.
- Permitir criar ou reutilizar a instância configurada, solicitar um QR Code
  temporário e desconectar a sessão, sempre pelo backend.
- Mostrar estado da conexão, horário da última mudança, mensagens do dia,
  falhas de envio, fila, conversas, disponibilidade da IA e consumo diário.
- Manter o envio humano: esta change não cria respostas automáticas nem amplia
  os poderes do serviço de IA.

## Non-goals

- Editar chaves, tokens, URLs internas ou segredos pelo navegador.
- Persistir o QR Code no banco, em arquivo ou em log.
- Excluir a instância da Evolution ou apagar conversas ao desconectar.
- Suportar vários números, multi-tenancy ou outro provedor nesta entrega.
- Alterar prompts, tom de voz ou habilitar envio automático.

## Impact

- **Backend:** novos métodos no cliente Evolution e rotas administrativas em
  `/api/whatsapp/configuration` e `/api/whatsapp/connection`.
- **Frontend:** nova página e componentes de configuração responsivos.
- **Segurança:** QR Code tratado como credencial temporária, com resposta
  `no-store`, acesso apenas de `admin` e nenhuma persistência.
- **Documentação:** o pareamento pelo portal deixa de ser non-goal da change
  `add-whatsapp-reception-inbox` e passa a ser definido por esta change.

