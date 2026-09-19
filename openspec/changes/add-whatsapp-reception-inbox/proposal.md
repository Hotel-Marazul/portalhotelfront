## Why

Hoje a recepção atende o WhatsApp do hotel só pelo celular: não vê o cadastro e as reservas do hóspede ao lado da conversa, não sabe o que responder primeiro e perde pedidos de reserva no meio de agradecimentos e mensagens de fornecedor. Esta mudança traz o WhatsApp para dentro do portal, com uma IA que lê todas as conversas, monta a fila por prioridade e sugere respostas. Quem envia é sempre uma pessoa, e o que a IA aprende só vale depois que o gerente aprova.

## Como funciona na prática

1. Um hóspede manda mensagem para o número do hotel.
2. Em segundos a conversa aparece em `/whatsapp`, na fila da recepção.
3. A IA lê a conversa e extrai o que ela pede: intenção, datas, pessoas e pedidos especiais. O backend cruza isso com o cadastro, as reservas e a disponibilidade, calcula a prioridade e mostra o motivo, por exemplo "Reserva 9–12 out · 2 adultos + 1 criança".
4. A recepcionista clica em **Atender próximo** ou escolhe uma conversa. Vê a conversa inteira, o que a IA entendeu, por que a conversa está naquela posição e quem é o hóspede.
5. A IA sugere um texto de resposta. A recepcionista usa, edita ou descarta, e só a mensagem que ela enviar vai para o hóspede.
6. Ela marca o desfecho (virou reserva, não fechou, não era lead) e, se quiser, diz se a posição na fila estava certa.
7. Com esses sinais, e com o que a recepção muda nas sugestões antes de enviar, o sistema propõe regras novas. O gerente aceita ou ignora cada uma em **Aprendizado da IA** e pode desfazer qualquer regra que já esteja valendo.

A tela antiga `/agente` sai do menu e do frontend. O WhatsApp passa a ser o lugar onde a IA trabalha no portal.

Referência visual: canvas "WhatsApp — Central da Recepção" (https://claude.ai/artifact/LB8HmNGpWSFZaRk5PBeUsa), com três telas: fila e conversa, aprendizado da IA e fila no celular. Os dados do canvas são fictícios. Quando o canvas e esta change divergirem, vale esta change.

## Vocabulário

Estes termos têm um significado só em todos os artefatos desta change:

| Termo | Significa |
|---|---|
| **Recepção** | usuário com papel `receptionist` |
| **Gerente** | usuário com papel `admin` |
| **Conversa** | a troca de mensagens com um número de WhatsApp. Existe uma conversa por contato |
| **Contato** | um número de WhatsApp. Pode estar vinculado a um cliente do cadastro ou não |
| **Atendimento** | um ciclo dentro da conversa. Começa na primeira mensagem do hóspede e termina quando a recepção marca o desfecho ou quando a conversa passa 7 dias sem mensagem. Desfecho, correção e métricas contam por atendimento |
| **Fila** | as conversas aguardando resposta da recepção, ordenadas pela prioridade |
| **Nível** | a faixa de prioridade: **Agora**, **Hoje** ou **Pode esperar** |
| **Pontuação** | o número de 0 a 100 que ordena a fila e define o nível |
| **Leitura** | o que a IA extraiu de uma conversa num dado momento |
| **Motivo** | cada frase curta que explica a pontuação ("Chega hoje", "Esperando resposta há 14 min") |
| **Sugestão** | o texto de resposta proposto pela IA. Nunca é enviado sem ação humana |
| **Desfecho** | o resultado marcado pela recepção: virou reserva, não fechou ou não era lead |
| **Correção** | a indicação da recepção de que a posição na fila estava certa, devia subir ou devia descer |
| **Regra** | um ajuste aprendido. **Regra de fila** mexe na pontuação; **regra de resposta** muda como a IA escreve as sugestões |
| **Proposta de regra** | uma regra que o sistema encontrou e que ainda espera a decisão do gerente |
| **Etapa N** | a seção N de `tasks.md` |
| **Evolution** | a Evolution API, serviço não oficial que conecta o número ao WhatsApp |
| **Serviço de IA** | o serviço FastAPI em `agents/` |

## What Changes

- Integrar o número do hotel via Evolution: webhook autenticado, gravação idempotente das mensagens recebidas e das enviadas pelo celular, status de entrega e estado da conexão.
- Normalizar telefones para E.164, incluindo a variação do nono dígito dos celulares brasileiros, e vincular contato a cliente de forma automática quando houver um único candidato e manual nos outros casos.
- Criar a tela `/whatsapp`: fila com filtros e busca, conversa com a linha do tempo completa, painel com a leitura da IA e o cadastro do hóspede, e envio de mensagens digitadas pela recepção.
- Criar a triagem pela IA: leitura estruturada de cada conversa, pontuação determinística no backend a partir de sinais fixos, níveis, motivos e **Atender próximo**.
- Criar sugestões de resposta com os fatos verificados pelo backend (disponibilidade, preço, reserva), trechos que a IA não sabe marcados para completar e registro de como cada sugestão foi usada.
- Criar o aprendizado supervisionado: desfechos, correções e edições viram propostas de regra, que o gerente aceita, ignora ou desfaz, com a página **Aprendizado da IA** e a trilha de auditoria.
- Acrescentar ao serviço de IA três endpoints sem ferramentas e sem acesso ao backend: triagem, sugestão de resposta e proposta de regras de resposta.
- **BREAKING (frontend):** remover a página `/agente`, a rota `frontend/src/app/api/agents/chat` e o item "Agente IA" do menu. O endpoint `/api/agent/chat` do backend e o `/chat` do serviço de IA continuam existindo, sem consumidor no frontend.
- Trocar o item "Hóspedes" da navegação inferior do celular por "WhatsApp". "Hóspedes" continua no menu lateral.
- Retenção configurável (padrão de 12 meses) com expurgo das mensagens, eventos brutos, leituras e sugestões.

## Capabilities

### New Capabilities

- `whatsapp-channel-ingestion`: conexão com a Evolution, webhook, eventos brutos, contatos, conversas, atendimentos, mensagens, status de entrega, telefones E.164, vínculo com clientes, reprocessamento e retenção.
- `whatsapp-inbox`: a tela da recepção, com fila, filtros, busca, conversa, painéis, ações sobre o contato, atalho para criar reserva, atualização automática, acesso por papel e navegação (inclui a remoção de `/agente`).
- `whatsapp-outbound-messages`: envio pelo portal, idempotência, reconciliação com o evento do celular, falhas, reenvio, bloqueio sem conexão, autoria e aviso de privacidade.
- `whatsapp-ai-triage`: leitura da IA, sinais, pontuação, níveis, motivos, ordem da fila, marcas na linha do tempo, comportamento sem IA e limites de uso.
- `whatsapp-reply-suggestions`: geração, fatos permitidos, trechos a completar, uso, edição, descarte e registro da origem de cada mensagem enviada.
- `whatsapp-ai-learning`: desfechos, correções, propostas de regra, decisões do gerente, regras valendo, métricas da página de aprendizado e auditoria.

### Modified Capabilities

Nenhuma. `openspec/specs/` ainda está vazio: as changes `harden-reservation-operations` e `admin-financial-access` não foram arquivadas.

## Impact

- **Pré-requisito:** a renomeação do papel da recepção de `manager` para `receptionist` (migração `migrateLegacyUserRoles` em `backend/src/db/init.ts`). Ela foi feita no branch `claude/whatsapp-ai-agent-observability-4829cc` e precisa estar commitada, com os testes de integração passando, antes da etapa 2.
- **Backend:** novo módulo `backend/src/modules/whatsapp/`, tabelas novas com prefixo `whatsapp_` (lista em `design.md`), rota pública de webhook fora do `authMiddleware` e do limitador global, worker em processo para triagem e jobs periódicos, cliente HTTP da Evolution e do serviço de IA, novas variáveis de ambiente.
- **Serviço de IA:** endpoints `/whatsapp/triage`, `/whatsapp/suggest-reply` e `/whatsapp/reply-style-proposals` com schemas Pydantic, prompts novos e testes. Nenhuma ferramenta de escrita é usada.
- **Frontend:** páginas `/whatsapp` e `/whatsapp/aprendizado`, componentes em `frontend/src/components/whatsapp/`, `ModalNovaReserva` aceitando valores iniciais, navegação, remoção de `/agente`.
- **Infra:** novo serviço `evolution-marazul` no Docker Compose; o webhook precisa de URL pública com TLS em produção.
- **Dados pessoais:** o conteúdo das conversas passa a ser guardado no banco e enviado ao provedor do modelo de IA (hoje OpenAI, via `agents/`). A seção de riscos de `design.md` trata retenção, minimização e aviso ao hóspede.
- **Documentação:** esta change substitui `.planning/ANALISE-WHATSAPP-CONVERSAS.md`, que passa a apontar para cá.
