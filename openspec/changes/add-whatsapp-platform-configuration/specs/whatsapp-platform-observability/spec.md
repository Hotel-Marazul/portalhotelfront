## Purpose

Dar ao gerente uma visão operacional suficiente para saber se o canal e o
agente estão funcionando, sem inspecionar banco, logs ou painéis externos.

## ADDED Requirements

### Requirement: Estado consolidado do canal

A tela SHALL mostrar se o módulo está habilitado, se a Evolution e o webhook
estão configurados, o nome da instância, o estado da conexão e o instante da
última mudança conhecido.

#### Scenario: Credencial ausente
- **WHEN** uma variável obrigatória não está configurada
- **THEN** a tela identifica o item ausente sem revelar qualquer outro valor

### Requirement: Estado e consumo do agente

A tela SHALL mostrar que o modo é assistido, se a IA está habilitada e
disponível, o motivo curto da indisponibilidade e o consumo da cota diária.
Ela MUST NOT oferecer envio automático.

#### Scenario: Limite diário atingido
- **WHEN** o contador do dia alcança o limite configurado
- **THEN** a tela mostra o agente indisponível por limite diário e a fila
  continua operacional

### Requirement: Métricas operacionais sem PII

A tela SHALL mostrar quantidade total de conversas, conversas aguardando,
mensagens recebidas hoje, mensagens enviadas hoje e envios com falha hoje. As
métricas MUST ser agregadas e MUST NOT conter telefone, nome, conteúdo ou id de
hóspede.

#### Scenario: Dia sem mensagens
- **WHEN** não há mensagens no dia civil do hotel
- **THEN** todas as contagens diárias são zero e a tela não fica vazia

### Requirement: Estados de interface completos

A página MUST tratar carregamento, erro, permissão insuficiente, módulo
desativado, configuração incompleta, conectado, conectando e desconectado. As
mudanças de conexão e QR SHALL ser anunciadas por tecnologia assistiva.

#### Scenario: Backend temporariamente indisponível
- **WHEN** a consulta falha
- **THEN** a tela mostra uma mensagem acionável e um controle para tentar de
  novo, preservando a navegação da plataforma

