# add-whatsapp-reception-inbox

Central de WhatsApp da recepção. Tem fila priorizada pela IA, sugestões de resposta que só uma pessoa envia e aprendizado que só vale depois que o gerente aprova. A tela `/agente` sai.

## Ordem de leitura

1. `proposal.md`: o porquê, o passo a passo e o **vocabulário**. Use só os termos dessa tabela.
2. `specs/*/spec.md`: o comportamento exigido. Cada cenário é um caso de teste.
3. `design.md`: como construir, com modelo de dados, contratos, pesos, algoritmos e telas.
4. `tasks.md`: a ordem de execução. Cada tarefa diz como verificar que terminou.

Referência visual: canvas "WhatsApp — Central da Recepção" (https://claude.ai/artifact/LB8HmNGpWSFZaRk5PBeUsa). Quando o canvas e esta change divergirem, vale esta change. O canvas tem dados fictícios e um botão de anexo que **não** entra.

## Regras que não podem ser quebradas

- **Nada é enviado ao hóspede sem o clique de uma pessoa.** O serviço de IA não tem rota, ferramenta nem credencial para enviar.
- **A IA não decide a prioridade.** Ela extrai fatos, e o backend pontua com a tabela da decisão 9 de `design.md` mais as regras aprovadas.
- **Regra aprendida só vale depois que o gerente (`admin`) aceita**, e pode ser desfeita.
- **O serviço de IA não acessa o banco nem o backend** nos endpoints `/whatsapp/*`: recebe tudo pronto e devolve JSON.
- **Nenhum log leva** corpo de mensagem, telefone, nome do contato, CPF ou texto de sugestão.
- **Transações.** Toda escrita em mais de uma tabela usa `pool.connect()` com `BEGIN`/`COMMIT`/`ROLLBACK`.
- **Imports locais do backend** terminam em `.js` (ESM).
- **Interruptores.** `WHATSAPP_ENABLED` e `WHATSAPP_AI_ENABLED` começam desligados.
- **Ordem das etapas.** A etapa 2 (sondagem da Evolution) vem antes de qualquer parser, porque o formato real do payload decide os detalhes marcados como "registrado na etapa 2".

## Dependência

A etapa 1 exige a renomeação do papel da recepção de `manager` para `receptionist`, já feita no branch `claude/whatsapp-ai-agent-observability-4829cc`, commitada e com os testes de integração passando.
