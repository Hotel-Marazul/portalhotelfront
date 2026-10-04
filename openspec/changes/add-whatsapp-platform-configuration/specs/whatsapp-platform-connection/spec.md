## Purpose

Permitir que o gerente configure e opere a conexão do único número de WhatsApp
do hotel dentro do PortalHotel, sem expor credenciais da Evolution.

## ADDED Requirements

### Requirement: Configuração sensível permanece no servidor

O sistema MUST ler URL, chave, instância e segredo do webhook do ambiente do
backend e MUST NOT devolver seus valores ao navegador. A tela SHALL mostrar
somente se cada item necessário está configurado e o nome não sensível da
instância.

#### Scenario: Gerente abre a configuração
- **WHEN** um gerente consulta a configuração
- **THEN** recebe indicadores booleanos e valores operacionais seguros, sem
  chave, token, segredo ou URL interna

### Requirement: Acesso exclusivo do gerente

As rotas de configuração e conexão MUST exigir usuário humano com papel
`admin`. Recepção e identidade técnica MUST receber 403.

#### Scenario: Recepção solicita QR Code
- **WHEN** um usuário `receptionist` solicita o QR Code
- **THEN** o backend responde 403 sem chamar a Evolution

### Requirement: Pareamento por QR Code temporário

O gerente SHALL poder solicitar um QR Code dentro do portal. O backend SHALL
reutilizar a instância configurada quando existir e SHALL criá-la quando não
existir. O QR MUST permanecer apenas na resposta e no estado efêmero da tela,
com cache HTTP desabilitado.

#### Scenario: Instância ainda não existe
- **WHEN** o gerente solicita conexão e a instância configurada não existe
- **THEN** o backend cria uma instância `WHATSAPP-BAILEYS`, devolve seu QR Code
  temporário e não persiste o QR

#### Scenario: Instância já está conectada
- **WHEN** o gerente solicita conexão e o estado é `open`
- **THEN** o sistema informa que o número já está conectado e não devolve QR

### Requirement: Desconexão preserva dados

O gerente SHALL poder desconectar a sessão depois de uma confirmação na tela.
A operação MUST fazer logout, MUST NOT excluir a instância e MUST NOT apagar
conversas, mensagens, vínculos ou métricas.

#### Scenario: Gerente confirma desconexão
- **WHEN** o gerente confirma a ação
- **THEN** a sessão é encerrada e todos os dados operacionais são preservados

### Requirement: Respostas da Evolution são não confiáveis

O backend MUST validar e reduzir toda resposta da Evolution antes de usá-la. O
resultado de `fetchInstances` MUST descartar tokens, hashes, chaves e campos
desconhecidos.

#### Scenario: Evolution devolve token de instância
- **WHEN** a listagem inclui um token ou hash
- **THEN** esse campo é ignorado e nunca aparece na API do PortalHotel

