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

# Write the rate-limit zones into nginx.conf (http block) before the site config.
# We use a separate snippet so certbot never overwrites our zones.
NGINX_CONF="/etc/nginx/nginx.conf"
ZONES_MARKER="# abar3d rate-limit zones"
if ! grep -qF "${ZONES_MARKER}" "${NGINX_CONF}"; then
  # Insert the zones right after the `http {` opening line
  sed -i "/^http {/a\\
\\
    ${ZONES_MARKER}\\
    # Strict zone for auth / payment / order endpoints (10 req/s per IP)\\
    limit_req_zone \$binary_remote_addr zone=api_strict:10m rate=10r/s;\\
    # Looser zone for general pages (30 req/s per IP)\\
    limit_req_zone \$binary_remote_addr zone=general:20m rate=30r/s;\\
    # Gzip compression\\
    gzip on;\\
    gzip_vary on;\\
    gzip_proxied any;\\
    gzip_comp_level 5;\\
    gzip_types text/plain text/css application/javascript application/json image/svg+xml font/woff2;\\
    gzip_min_length 1024;\\
" "${NGINX_CONF}"
fi

cat >"${SITE_FILE}" <<NGINX
# ── Proxy cache for immutable JS/CSS assets (10 min in-memory) ──────────────
proxy_cache_path /var/cache/nginx/abar3d levels=1:2 keys_zone=assets_cache:8m
                 max_size=256m inactive=60m use_temp_path=off;

server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN};

    # Hard cap on upload size (admin image uploads go via Supabase Storage,
    # so 20 MB is generous for any body that hits the Node app directly).
    client_max_body_size 20M;

    # ── Rate limiting ───────────────────────────────────────────────────────
    # Applied per-location below; burst absorbs short spikes without 429.

    # ── Static / immutable assets — served from proxy cache ─────────────────
    location ~* ^/assets/ {
        proxy_pass http://${APP_UPSTREAM};
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_cache assets_cache;
        proxy_cache_valid 200 10m;
        proxy_cache_use_stale error timeout updating http_500 http_502 http_503 http_504;
        add_header X-Cache-Status \$upstream_cache_status;
        # Immutable assets have content-hashed names — safe to cache long in browser
        add_header Cache-Control "public, max-age=2592000, immutable";
        # No rate limit for static assets
    }

    # ── Payment / order / auth API (strict rate limit) ──────────────────────
    location ~* ^/(api/payment|_server/fn/startPayment|_server/fn/verifyPayment|_server/fn/placeOrder|_server/fn/accountingSaveInvoice) {
        limit_req zone=api_strict burst=5 nodelay;
        limit_req_status 429;

        proxy_pass http://${APP_UPSTREAM};
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 60s;
        proxy_send_timeout 60s;
    }

    # ── Everything else ──────────────────────────────────────────────────────
    location / {
        limit_req zone=general burst=20 nodelay;
        limit_req_status 429;

        proxy_pass http://${APP_UPSTREAM};
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 60s;
        proxy_send_timeout 60s;
    }
}
NGINX

# Ensure the proxy cache directory exists
mkdir -p /var/cache/nginx/abar3d

ln -sfn "${SITE_FILE}" "${SITE_LINK}"
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl enable --now nginx
systemctl reload nginx

if command -v ufw >/dev/null 2>&1; then
  ufw allow 'Nginx Full'

  # Keep Torob's documented crawlers explicitly allowed even if this VPS is
  # later switched to a restrictive/default-deny firewall policy. The first
  # range is split so only 81.12.31.192 through 81.12.31.254 is admitted.
  TOROB_NETWORKS=(
    "81.12.31.192/27"
    "81.12.31.224/28"
    "81.12.31.240/29"
    "81.12.31.248/30"
    "81.12.31.252/31"
    "81.12.31.254/32"
    "91.107.165.81/32"
    "188.121.119.29/32"
    "195.201.30.135/32"
  )
  for network in "${TOROB_NETWORKS[@]}"; do
    ufw allow proto tcp from "${network}" to any port 80 comment 'Torob API'
    ufw allow proto tcp from "${network}" to any port 443 comment 'Torob API'
  done
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
