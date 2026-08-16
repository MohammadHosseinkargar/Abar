# Torob production checklist

## Current status

- [x] Product API v3 implemented on the TanStack Start/Nitro server.
- [x] JWT Ed25519 signature, version, `exp`, `nbf`, and audience validation implemented.
- [x] Real Supabase catalog integration test covers pagination, `page_urls`, and `page_uniques`.
- [x] Product sitemap and robots declaration implemented.
- [x] Durable webhook queue, retry, deduplication, monitoring, and worker implemented in migration/code.
- [x] Order attribution code implemented but deliberately disabled.
- [ ] Remote Torob migration applied and verified.
- [ ] Real Torob public key configured in production.
- [ ] Webhook token configured when Torob webhook delivery is ready (optional for Product API).
- [ ] Queue worker cron configured.
- [ ] Final smoke tests executed against the deployed `https://abar3d.ir` endpoints.

## Required access before migration

One of the following is required; do not put either value in Git:

1. `SUPABASE_ACCESS_TOKEN` with access to the actual Abar3D project, followed by `supabase link --project-ref <ACTUAL_PROJECT_REF>`; or
2. a direct production `DATABASE_URL`/database password for `psql`.

The repository is currently not linked (`supabase migration list` reports `Cannot find project ref`). Confirm the actual project ref from the runtime `SUPABASE_URL`; do not rely on the unrelated `project_id` currently present in `supabase/config.toml` without verification.

## Pre-migration backup and safety

- [ ] Take a Supabase database backup/snapshot.
- [ ] Confirm `products`, `orders`, their row counts, and current policies.
- [ ] Review `supabase/migrations/20260816090000_torob_integration.sql` again.
- [ ] Confirm it contains no `DROP TABLE`, `DROP COLUMN`, `TRUNCATE`, or business-data `DELETE`.
- [ ] Apply only through the normal Supabase migration workflow.

The migration only adds nullable columns, indexes, two Torob tables, RLS, functions, a trigger, grants, and initial queue rows. It does not rewrite existing product/order values.

## Apply migration

After linking to the confirmed production project:

```bash
supabase migration list
supabase db push --dry-run
supabase db push
```

Do not proceed if the dry run proposes unrelated migrations or destructive statements.

## Post-migration SQL verification

Run in Supabase SQL Editor or through an authorized read-only SQL session:

```sql
select table_name, column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and ((table_name = 'products' and column_name in ('guarantee','torob_product_group_id'))
    or (table_name = 'orders' and column_name = 'torob_clid'))
order by table_name, column_name;

select table_name, row_security
from information_schema.tables
where table_schema = 'public'
  and table_name in ('torob_webhook_queue','torob_sync_events');

select trigger_name, event_manipulation, event_object_table, action_timing
from information_schema.triggers
where trigger_schema = 'public'
  and event_object_table = 'products'
  and trigger_name = 'enqueue_torob_product_change';

select routine_name, security_type
from information_schema.routines
where routine_schema = 'public'
  and routine_name in ('enqueue_torob_product_change','claim_torob_webhook_batch');

select status, count(*)
from public.torob_webhook_queue
group by status
order by status;
```

Expected results:

- both new product columns and `orders.torob_clid` exist;
- both Torob tables have `row_security = YES`;
- the product trigger has INSERT, UPDATE, and DELETE events;
- existing products are represented once in pending/failed queue state;
- anon/authenticated cannot select either Torob internal table;
- `service_role` can execute `claim_torob_webhook_batch(integer)`.

## Non-destructive webhook queue verification

Do not create/delete a fake production product. Use one real product inside a transaction and roll it back:

```sql
begin;

select id, slug, name, price, stock, image_url, is_active
from public.products
where is_active = true
order by created_at desc
limit 1
for update;

-- Replace PRODUCT_UUID with the selected product id and preserve the original values.
update public.products set price = price + 1 where id = 'PRODUCT_UUID';
update public.products set stock = stock + 1 where id = 'PRODUCT_UUID';
update public.products set image_url = image_url where id = 'PRODUCT_UUID';
update public.products set name = name || ' ' where id = 'PRODUCT_UUID';
update public.products set is_active = false where id = 'PRODUCT_UUID';

select page_unique, event_type, status, count(*)
from public.torob_webhook_queue
where page_unique = 'PRODUCT_UUID'
group by page_unique, event_type, status;

rollback;
```

Because the test is rolled back, neither product data nor queue state is persisted. The unique partial index must show at most one pending/failed row for the product. A true delete test should be performed only on a disposable staging copy; do not delete a real production product for verification. A production delete is already covered by the trigger definition and automated migration review.

## Production environment variables

Server-only secrets:

```dotenv
SUPABASE_URL=
SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=
APP_URL=https://abar3d.ir
TOROB_PUBLIC_KEY=
TOROB_TOKEN_VERSION=1
TOROB_WEBHOOK_TOKEN=
TOROB_WEBHOOK_URL=https://api.torob.com/update/webhook/v1/
TOROB_QUEUE_SECRET=
TOROB_ORDER_TRACKING_ENABLED=false
ZIBAL_MERCHANT=
```

Public browser build variables:

```dotenv
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
```

Never create `VITE_TOROB_*` variables. Torob keys/tokens must remain server-only.

`TOROB_WEBHOOK_TOKEN` is optional. When it is empty, Product API remains ready,
database triggers continue to enqueue changes, and the worker returns `status: disabled`
without claiming or sending queue rows. Adding the token later enables delivery without a code change.

## Build and pre-deploy tests

```bash
npm ci
npm test
npm run build
SUPABASE_URL=... SUPABASE_PUBLISHABLE_KEY=... npm run test:torob:integration
```

The integration test starts the production Nitro server locally and smoke-tests:

- `GET /api/torob/health`
- Product API pagination
- Product API `page_urls`
- Product API `page_uniques`
- `GET /product-sitemap.xml`
- `GET /robots.txt`

## Webhook worker

- [ ] Generate a high-entropy `TOROB_QUEUE_SECRET`.
- [ ] Configure a once-per-minute scheduler:

```bash
curl -X POST https://abar3d.ir/api/torob/webhooks/process \
  -H 'Authorization: Bearer <TOROB_QUEUE_SECRET>'
```

- [ ] Confirm successful events in `/admin/torob` and `torob_sync_events`.
- [ ] Confirm failed requests remain queued with exponential backoff.

## Order Tracking

Keep this setting until Torob formally approves and supplies the required activation details:

```dotenv
TOROB_ORDER_TRACKING_ENABLED=false
```

Do not register or expose order data to Torob before formal approval.

## Final deployed smoke test

- [ ] `GET https://abar3d.ir/api/torob/health` returns 200 and `configuration: ready`.
- [ ] Signed `POST https://abar3d.ir/api/torob/products` succeeds for all three request modes.
- [ ] Invalid/missing JWT returns 401.
- [ ] `GET https://abar3d.ir/product-sitemap.xml` returns valid XML with all active products.
- [ ] `GET https://abar3d.ir/robots.txt` declares the product sitemap.
- [ ] Product webhook returns success using the real Torob token.
- [ ] No JWT, Bearer token, private key, service-role key, or database password appears in logs.
