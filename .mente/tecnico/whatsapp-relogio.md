# Relógio do agente WhatsApp

## Contrato e objetivo

A triagem e cada nova sugestão recebem `hotelNow` (ISO 8601 com offset),
`hotelToday` e `timezone`, calculados uma única vez por chamada a partir do
relógio do servidor de agentes. Independem de usuário conectado e de mensagens
que aleguem outra data. A triagem conserva `hotelToday` na entrada para
compatibilidade, mas recalcula a referência antes de consultar o modelo e
validar datas passadas. Sugestões aceitam `timezone` opcional, com padrão
`America/Sao_Paulo`; o backend envia `HOTEL_TIMEZONE` explicitamente.

Datas com dia e mês, sem ano, indicam o próximo período futuro. Ano explícito
nunca é avançado automaticamente. Datas incompletas ou impossíveis continuam
pendentes. Isso orienta a extração pelo modelo; disponibilidade, preço e
confirmação de reserva continuam sob as regras existentes.

## Implementação e validação

1. Helper em `agents/whatsapp/clock.py` calcula instante, dia e fuso juntos.
2. Triagem e sugestão incorporam o contexto antes de chamar o modelo.
3. Testes pytest cobrem relógio atualizado, virada do dia e integração HTTP com
   modelo substituto; não comprovam extração pelo provedor real.

Comandos: `python3 -m pytest agents/tests`, `npm --prefix backend run build`,
`npm --prefix backend test` e `graphify update .`.
Seguir aliases camelCase nos payloads e snake_case no Python, sem dependências
novas, migrações ou alterações das escritas de reservas.
