# Torob integration

This application implements Torob Product API v3, the Product Webhook producer, and the optional Order Tracking API entirely on the TanStack Start server. No Torob credential is included in the browser bundle.

## Endpoints

- Product API v3: `POST https://abar3d.ir/api/torob/products`
- Product sitemap: `GET https://abar3d.ir/product-sitemap.xml`
- Non-secret health check: `GET https://abar3d.ir/api/torob/health`
- Order Tracking: `GET https://abar3d.ir/api/torob/v1/orders`
- Internal queue worker: `POST https://abar3d.ir/api/torob/webhooks/process`
- Admin monitoring: `/admin/torob`

Product and Order APIs require `X-Torob-Token` and `X-Torob-Token-Version: 1`. The server verifies the Ed25519 signature, `alg`, token version, `exp`, `nbf`, and an `aud` exactly matching the request host.

## Environment

Set these only in the runtime secret store or server `.env`:

```dotenv
APP_URL=https://abar3d.ir
TOROB_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----\n...value supplied by Torob...\n-----END PUBLIC KEY-----"
TOROB_TOKEN_VERSION=1
TOROB_WEBHOOK_TOKEN=
TOROB_WEBHOOK_URL=https://api.torob.com/update/webhook/v1/
TOROB_QUEUE_SECRET=
TOROB_ORDER_TRACKING_ENABLED=false
```

`TOROB_PUBLIC_KEY` and `TOROB_WEBHOOK_TOKEN` must be obtained/confirmed with Torob support. Generate `TOROB_QUEUE_SECRET` as a high-entropy internal secret; it is not supplied by Torob. Keep Order Tracking disabled until Torob has enabled it for the shop and the migration is deployed.

## Database migration

Apply `supabase/migrations/20260816090000_torob_integration.sql` before deploying the application. It adds product warranty/group fields, order attribution, optimized indexes, a durable deduplicating webhook queue, audit events, and an atomic `SKIP LOCKED` batch claimant. It contains no credentials.

The product UUID is the stable `page_unique`. The canonical URL is `/products/{slug}`. Prices are already stored in Toman in this project. An unavailable product uses `availability: false` and `current_price: 0`. `old_price` and `guarantee` are omitted when real values do not exist.

## Product API examples

```bash
curl -X POST https://abar3d.ir/api/torob/products \
  -H 'Content-Type: application/json' \
  -H 'X-Torob-Token: <JWT_FROM_TOROB>' \
  -H 'X-Torob-Token-Version: 1' \
  --data '{"page":1,"sort":"date_added_desc"}'
```

The other request shapes are:

```json
{ "page_urls": ["https://abar3d.ir/products/light-piston"] }
```

```json
{ "page_uniques": ["PRODUCT_UUID"] }
```

Example response shape:

```json
{
  "api_version": "torob_api_v3",
  "current_page": 1,
  "total": 1,
  "max_pages": 1,
  "products": [
    {
      "page_unique": "PRODUCT_UUID",
      "page_url": "https://abar3d.ir/products/light-piston",
      "title": "PRODUCT_TITLE",
      "current_price": 1510000,
      "availability": true,
      "image_links": [],
      "spec": {},
      "date_added": "2026-01-01T00:00:00.000Z",
      "date_updated": "2026-01-01T00:00:00.000Z"
    }
  ]
}
```

Placeholders above are documentation only; the live response is read directly from Supabase.

## Webhook queue and retries

Every relevant insert/update/delete on `products` is deduplicated into PostgreSQL. This includes stock changes made during checkout. Run the worker once per minute using the host scheduler:

```bash
curl -X POST https://abar3d.ir/api/torob/webhooks/process \
  -H 'Authorization: Bearer <TOROB_QUEUE_SECRET>'
```

Each request sends at most 100 products. Failures are persisted and retried with exponential backoff capped at one hour. A removed/hidden product is announced with its last URL; Torob then receives an empty product result when it refreshes it. Logs never include JWTs, webhook tokens, keys, or database credentials.

## Order Tracking

When a Torob landing URL contains a valid `torob_clid`, the SSR server stores it in a Secure, HttpOnly, SameSite=Lax cookie for 30 days. Checkout copies it to `orders.torob_clid`. The tracking endpoint returns only attributed orders, sorted by purchase timestamp, and supports required `purchase_timestamp_gt` and `limit` parameters. Monetary values are integers in Toman. Set `TOROB_ORDER_TRACKING_ENABLED=true` only after activation; otherwise it intentionally returns HTTP 403.

## Deployment and verification

1. Apply the Supabase migration.
2. Set runtime secrets in Docker/hosting; do not use `VITE_` prefixes for Torob values.
3. Deploy the Node/Nitro image.
4. Schedule the internal queue worker every minute.
5. Verify `/api/torob/health` reports `configuration: ready`.
6. Ask Torob to call Product API with a real signed JWT and register the webhook token/domain.
7. Run `npm test`, `npm run build`, and inspect `/admin/torob`.

For a pre-deploy read-only audit against the real Supabase catalog, provide the public project values and run:

```bash
SUPABASE_URL=... SUPABASE_PUBLISHABLE_KEY=... npm run test:torob:integration
```

This starts the production Nitro build locally, generates a temporary Ed25519 test key/JWT, calls all three Product API request modes, compares every active product with Supabase, and verifies the selected real image URLs. It never requires or logs the service-role key.

Server logs are available in the container logs (`docker compose logs app`). Search for `[Torob Product API]`, `[Torob Webhook]`, or `[Torob Order API]`. These records contain only request type/count/timing and sanitized errors.
