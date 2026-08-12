#!/usr/bin/env bash
set -Eeuo pipefail

DOMAIN="abar3d.ir"
APP_UPSTREAM="127.0.0.1:3000"
SITE_FILE="/etc/nginx/sites-available/abar3d.ir"
SITE_LINK="/etc/nginx/sites-enabled/abar3d.ir"

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run as root: sudo bash scripts/setup-nginx-ssl.sh EMAIL" >&2
  exit 1
fi

EMAIL="${1:-}"
if [[ ! "${EMAIL}" =~ ^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$ ]]; then
  echo "Usage: sudo bash scripts/setup-nginx-ssl.sh your-email@example.com" >&2
  exit 1
fi

apt-get update
DEBIAN_FRONTEND=noninteractive apt-get install -y nginx certbot python3-certbot-nginx curl

cat >"${SITE_FILE}" <<NGINX
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN};
    client_max_body_size 250M;

    location / {
        proxy_pass http://${APP_UPSTREAM};
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 300s;
        proxy_send_timeout 300s;
    }
}
NGINX

ln -sfn "${SITE_FILE}" "${SITE_LINK}"
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl enable --now nginx
systemctl reload nginx

if command -v ufw >/dev/null 2>&1; then
  ufw allow 'Nginx Full'
fi

if ! curl --fail --silent --show-error --max-time 10 "http://${APP_UPSTREAM}/api/public/health" >/dev/null; then
  echo "Warning: app health check failed on ${APP_UPSTREAM}; continuing with SSL setup." >&2
fi

certbot --nginx --domain "${DOMAIN}" --email "${EMAIL}" \
  --agree-tos --no-eff-email --redirect --non-interactive

nginx -t
systemctl reload nginx
systemctl enable --now certbot.timer
certbot renew --dry-run

echo "Ready: https://${DOMAIN}"
