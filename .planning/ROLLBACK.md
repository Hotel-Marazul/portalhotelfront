# Rollback — harden-reservation-operations

## Ordem segura

1. Registrar as tags das imagens atuais e confirmar backup verificável do PostgreSQL.
2. Definir `AGENTS_MUTATIONS_ENABLED=false` no ambiente de agentes e reiniciar somente `agents-marazul`. Consultas, políticas e saúde continuam disponíveis; criação, edição e cancelamento ficam bloqueados.
3. Repetir o smoke autenticado de saúde, política e autenticação do gateway.
4. Se a aplicação continuar instável, reverter `frontend-marazul`, `backend-marazul` e `agents-marazul` para as imagens anteriores. As migrations são aditivas; não remover colunas, tabelas ou rotas.
5. Não restaurar o banco de forma ampla nem apagar cancelamentos/pagamentos. Corrigir qualquer efeito financeiro ou operacional por evento compensatório auditado.
6. Reabilitar mutações somente após o smoke e a validação manual em staging.

## Verificação da chave de rollback

```bash
docker compose run --rm --no-deps \
  -e AGENTS_MUTATIONS_ENABLED=false agents-marazul \
  sh -c 'python tests/test_rollback_flag.py'
```

O teste deve retornar `test_rollback_flag: ok`. A flag é deliberadamente fail-closed para as mutações e não desliga disponibilidade, políticas ou autenticação.
