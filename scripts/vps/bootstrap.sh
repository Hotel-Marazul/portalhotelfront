#!/usr/bin/env bash
# Prepara a VPS de produção uma vez. Pode rodar de novo sem estragar nada.
# Uso, do seu computador, com a chave já instalada no root:
#   ssh portalhotel-vps 'bash -s' < scripts/vps/bootstrap.sh
set -euo pipefail

APP_DIR=/opt/portalhotel
ENV_FILE=$APP_DIR/.env.production

echo "== 1. SSH só com chave"
# Sem chave instalada, desligar a senha trancaria o acesso.
if ! grep -q '^ssh-' /root/.ssh/authorized_keys 2>/dev/null; then
  echo "Nenhuma chave em /root/.ssh/authorized_keys. Instale a chave antes." >&2
  exit 1
fi
cp -n /etc/ssh/sshd_config /etc/ssh/sshd_config.bak-bootstrap
for file in /etc/ssh/sshd_config.d/*.conf; do
  [ -f "$file" ] && cp -n "$file" "$file.bak-bootstrap" && sed -i 's/^PasswordAuthentication yes/PasswordAuthentication no/' "$file"
done
sed -i 's/^PermitRootLogin yes/PermitRootLogin prohibit-password/' /etc/ssh/sshd_config
sshd -t
systemctl reload ssh
sshd -T | grep -Ei '^(permitrootlogin|passwordauthentication)'

echo "== 2. Firewall: só 22, 80 e 443"
command -v ufw >/dev/null || apt-get install -y ufw
ufw default deny incoming
ufw default allow outgoing
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 443/udp
ufw --force enable
ufw status verbose | head -12
# Atenção: porta publicada pelo Docker passa por fora do ufw. O compose de produção
# só publica 80 e 443 (Caddy); não publique outras.

echo "== 3. GitLab Runner"
if ! command -v gitlab-runner >/dev/null; then
  curl -fsSL https://packages.gitlab.com/install/repositories/runner/gitlab-runner/script.deb.sh | bash
  apt-get install -y gitlab-runner
fi
usermod -aG docker gitlab-runner
# No Ubuntu, o .bash_logout padrão limpa o console e derruba jobs do executor shell.
rm -f /home/gitlab-runner/.bash_logout
gitlab-runner --version | head -1

echo "== 4. Pasta do deploy e segredos"
install -d -o gitlab-runner -g gitlab-runner -m 700 "$APP_DIR"
if [ ! -f "$ENV_FILE" ]; then
  secret() { openssl rand -hex 32; }
  umask 077
  cat > "$ENV_FILE" <<EOF
# Gerado por scripts/vps/bootstrap.sh. Preencha os campos vazios antes do primeiro deploy.
# Domínio comprado, sem https:// e sem app. (o portal fica em app.\$DOMAIN)
DOMAIN=
ACME_EMAIL=

JWT_SECRET=$(secret)
JWT_EXPIRES_IN=8h
HOTEL_TIMEZONE=America/Sao_Paulo

DB_NAME=portal_hotel
DB_USER=portal
DB_PASSWORD=$(secret)

# Primeiro gerente: entre com este e-mail e esta senha, troque a senha no portal e apague a linha da senha.
BOOTSTRAP_ADMIN_NAME=Gerente
BOOTSTRAP_ADMIN_EMAIL=
BOOTSTRAP_ADMIN_PASSWORD=$(openssl rand -base64 18)

AGENTS_API_KEY=$(secret)
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o-mini
WHATSAPP_AI_MODEL=
WHATSAPP_AI_REASONING_EFFORT=

WHATSAPP_ENABLED=false
WHATSAPP_AI_ENABLED=false
WHATSAPP_AI_DAILY_LIMIT=400
WHATSAPP_RETENTION_MONTHS=12
WHATSAPP_WEBHOOK_SECRET=$(secret)
EVOLUTION_API_KEY=$(secret)
EVOLUTION_INSTANCE=marazul
EVOLUTION_DB_USER=evolution
EVOLUTION_DB_PASSWORD=$(secret)
EOF
  chown gitlab-runner:gitlab-runner "$ENV_FILE"
  echo "Criado $ENV_FILE (segredos gerados; faltam DOMAIN, ACME_EMAIL, BOOTSTRAP_ADMIN_EMAIL e OPENAI_API_KEY)."
else
  echo "$ENV_FILE já existe; não mexi."
fi
ls -l "$ENV_FILE"

echo "== Pronto. Falta registrar o runner com o token do projeto no GitLab:"
echo "   gitlab-runner register --url https://gitlab.com --token <glrt-...> --executor shell"
