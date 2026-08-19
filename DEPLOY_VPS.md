# Deploy Abar 3D on Ubuntu 22.04

This application uses your hosted Supabase project. It does not need a local PostgreSQL container.

## 1. Prepare Supabase

In the Supabase dashboard, open **Project Settings > API** and copy:

- Project URL (`https://<project-ref>.supabase.co`)
- Publishable key (or the legacy `anon` key)
- Secret key (or the legacy `service_role` key)

Never expose the secret/service-role key in a `VITE_` variable or commit it to Git. If you previously used the credential that was present in this repository's old `.env.example`, rotate it in Supabase.

In **Authentication > URL Configuration**, set the Site URL to your public `APP_URL` and add the same origin to Redirect URLs, for example `https://abar3d.ir/**`.

## 2. Configure the VPS

Install Docker:

```bash
sudo apt update
sudo apt install -y docker.io docker-compose-v2
sudo systemctl enable --now docker
```

Copy this project to the VPS, enter its directory, and create the environment file:

```bash
cp .env.example .env
nano .env
```

Fill every placeholder in `.env`. `SUPABASE_URL` and `VITE_SUPABASE_URL` must be identical. `SUPABASE_PUBLISHABLE_KEY` and `VITE_SUPABASE_PUBLISHABLE_KEY` must also be identical. The storefront can start without `SUPABASE_SERVICE_ROLE_KEY`, but admin and other privileged operations require it. Ensure the DNS records for `abar3d.ir` point to the VPS.

Before deploying a revision that adds a file under `supabase/migrations`, apply
that SQL to the hosted Supabase project (SQL Editor or your normal migration
pipeline). Docker Compose does not apply database migrations automatically.

## 3. Deploy

```bash
docker compose config
docker compose up -d --build
docker compose ps
sudo bash scripts/setup-nginx-ssl.sh YOUR_EMAIL
curl -fsS https://abar3d.ir/api/public/health
```

Confirm server-only Telegram values reached the running container without
printing the secrets:

```bash
docker compose exec app sh -lc 'test -n "$TELEGRAM_BOT_TOKEN" && test -n "$TELEGRAM_ADMIN_CHAT_ID" && echo "Telegram env: OK"'
```

If Torob reports a network timeout, explicitly allow its crawler networks in
the VPS firewall (the command is idempotent):

```bash
sudo bash scripts/allow-torob-ips.sh
curl -fsS https://abar3d.ir/api/torob/health
```

If the VPS provider has a separate cloud firewall/security group, add the same
source networks shown in that script there for inbound TCP ports 80 and 443.

The setup script installs Nginx and Certbot, configures the reverse proxy, obtains the certificate, enables HTTPS redirects, and tests renewal. Ports 80 and 443 must be reachable and DNS must already point to the VPS.

When any public Supabase value changes, rebuild the image because `VITE_` values are embedded during the frontend build:

```bash
docker compose up -d --build
```

## Troubleshooting

```bash
docker compose logs --tail=200 app
docker compose ps
sudo nginx -t
sudo journalctl -u nginx --no-pager -n 100
```

- `Missing Supabase environment variable`: check `.env`, then rebuild.
- `Invalid API key` or `JWT` errors: ensure all keys belong to the same project as `SUPABASE_URL`.
- Health endpoint returns 503: verify the Supabase URL/key and that the `categories` table exists and is readable with the project's RLS policies.
- Login redirects incorrectly: update Supabase Authentication URL Configuration.
- TLS certificate fails: correct DNS and ensure ports 80/443 are open.
