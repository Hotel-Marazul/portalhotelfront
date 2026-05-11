# Agents (Multiagentes + RAG) — Guia de Estrutura do Projeto

Este diretório contém **apenas** a camada de IA (multiagentes), responsável por:
- Atendimento conversacional (Recepcionista IA)
- Consulta de disponibilidade e prevenção de overbooking
- Consulta de políticas do hotel via RAG
- Orquestração e decisão final (com explicabilidade)
- Integração com o backend existente via API interna

> IMPORTANTE:
> - O frontend e o backend já existem.
> - A lógica determinística (CRUD, regras duras) continua no backend.
> - Os agentes **NÃO** devem escrever direto no banco: toda ação deve ocorrer via endpoints do backend.
> - A camada IA deve ser modular, testável e com logs.

---

## Objetivo do módulo de agentes

Implementar um sistema multiagente usando **Agno** com um fluxo confiável para:
1. Identificar intenção do usuário (reserva, preço, dúvida, cancelamento)
2. Consultar disponibilidade em tempo real (via API do backend)
3. Consultar políticas e regras (RAG: base interna do hotel)
4. Propor ação (confirmar, sugerir alternativa, pedir dados faltantes)
5. Executar ação no backend (criar reserva / atualizar / cancelar) apenas quando permitido
6. Retornar resposta natural + justificativa resumida (explicável)

---

## Estrutura de pastas sugerida

agents/
├─ README.md
├─ app/
│  ├─ server.py (ou server.ts)            # microserviço opcional, se for separado do backend
│  ├─ router.py                           # rotas: /chat, /tools, /health, etc.
│  └─ settings.py                         # env vars, configs, modelos
├─ orchestration/
│  ├─ supervisor.py                       # agente orquestrador (meta-agente)
│  ├─ flows.py                            # fluxos (reserva, dúvida, cancelamento)
│  └─ state.py                            # estado da conversa, memória curta e longa (se houver)
├─ agents/
│  ├─ receptionist_agent.py               # agente conversacional principal (interface)
│  ├─ availability_agent.py               # consulta disponibilidade + conflitos
│  ├─ policy_agent.py                     # RAG: políticas e regras
│  ├─ pricing_agent.py                    # preços e regras de diária (opcional)
│  ├─ booking_agent.py                    # executa ações: criar/alterar/cancelar reserva via API
│  └─ decision_agent.py                   # consolida evidências e define resposta final
├─ tools/
│  ├─ backend_api.py                      # cliente HTTP para backend (única porta de ações/dados)
│  ├─ rag_store.py                        # interface do vector store
│  ├─ retrieval.py                        # pipeline RAG: query -> retrieve -> rerank -> context
│  └─ validators.py                       # validação de entrada, datas, regras básicas
├─ rag/
│  ├─ knowledge/                          # documentos do hotel (md/pdf/txt) ou dumps
│  ├─ ingest.py                           # indexação/embeddings
│  └─ schema.md                           # como formatar docs para RAG (fontes e metadados)
├─ schemas/
│  ├─ messages.py                         # schemas de mensagens e respostas
│  ├─ booking.py                          # schemas de reserva
│  └─ tool_contracts.py                   # contratos das tools (inputs/outputs)
├─ prompts/
│  ├─ system.md                           # prompt base (tom, regras, segurança)
│  ├─ receptionist.md
│  ├─ decision.md
│  └─ policy.md
├─ tests/
│  ├─ test_booking_flow.py
│  ├─ test_policy_rag.py
│  ├─ test_overbooking_guard.py
│  └─ fixtures/
│     ├─ sample_conversations.json
│     └─ sample_policies.md
└─ logs/
   └─ (gerado em runtime)                 # logs estruturados

> Observação: use Python conforme sua stack.  
> A organização acima funciona para ambos.

---

## Integração com Backend (Obrigatória)

Toda leitura/escrita operacional deve passar pelo cliente em `tools/backend_api.*`.

### Endpoints mínimos esperados (exemplos)
- GET /rooms
- GET /availability?checkin=YYYY-MM-DD&checkout=YYYY-MM-DD&guests=2
- GET /bookings?from=...&to=...
- POST /bookings
- PATCH /bookings/:id
- POST /bookings/:id/cancel
- GET /policies (opcional, se políticas vierem do backend)

> Se os endpoints reais forem diferentes, adaptar apenas o `backend_api.*` e manter os agentes agnósticos.

---

## Contrato de Mensagem (entrada/saída)

### Entrada do endpoint de chat (exemplo)
```json
{
  "conversation_id": "uuid",
  "user_message": "Quero reservar de 12 a 15 de abril para 2 pessoas",
  "channel": "web|whatsapp|internal",
  "locale": "pt-BR",
  "metadata": {
    "customer_name": "opcional",
    "phone": "opcional"
  }
}