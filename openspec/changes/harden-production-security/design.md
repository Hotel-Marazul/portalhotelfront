## Decisões

1. **Mesma origem.** A API mora em `app.hotelmarazul.com/api`, roteada pelo Caddy. O navegador não faz chamadas entre origens. O cookie fica preso ao `app.` (sem atributo `Domain`), e a landing nunca o recebe. Não há subdomínio por papel: quem separa admin de recepção é o RBAC do backend.
2. **`TRUST_PROXY_HOPS`.** O valor padrão é 0. Em produção é 1, que é o Caddy. Nunca usamos `true`, porque com ele o cliente pode forjar o `X-Forwarded-For` e escapar do limite de login.
3. **CSRF por origem.** O cookie `SameSite=Lax` não protege contra origens do mesmo site, como um subdomínio irmão. Por isso, toda requisição que não seja GET, HEAD ou OPTIONS e traga `Origin` fora de `CORS_ORIGINS` recebe 403. Requisição sem `Origin` (curl, servidor) passa, porque não carrega cookie de navegador alheio. O webhook do WhatsApp fica de fora, porque tem segredo próprio.
4. **Login.** Com e-mail inexistente, o backend ainda roda um `bcrypt.compare` contra um hash fixo, para o tempo de resposta não revelar quais e-mails existem. O limite de login passa a ignorar os acertos (`skipSuccessfulRequests`), porque a recepção inteira sai pelo mesmo IP.
5. **Zod 4 adiado.** A troca de versão maior quebra os schemas. Os limites de 100 kB e 2 MB no corpo das requisições já seguram o abuso de memória do alerta. Revisar até 2027-01-31.
6. **Testes.** Usam `node:test` com `tsx`, que é o que o repositório já usa, e não Vitest como diz o CLAUDE.md.
