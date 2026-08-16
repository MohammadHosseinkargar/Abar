-- Persistent Torob integration state. No credentials are stored in the database.
alter table public.products
  add column if not exists guarantee text,
  add column if not exists torob_product_group_id text;

alter table public.orders
  add column if not exists torob_clid text;

create index if not exists products_torob_created_active_idx on public.products (is_active, created_at desc, id desc);
create index if not exists products_torob_updated_active_idx on public.products (is_active, updated_at desc, id desc);
create index if not exists orders_torob_clid_updated_idx on public.orders (updated_at, id) where torob_clid is not null;

create table if not exists public.torob_webhook_queue (
  id bigint generated always as identity primary key,
  product_id uuid,
  page_unique text not null,
  page_url text not null,
  event_type text not null check (event_type in ('upsert','remove')),
  status text not null default 'pending' check (status in ('pending','processing','sent','failed')),
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  locked_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

-- A previous partial run may have created this index name with the obsolete
-- pending/processing predicate. IF NOT EXISTS would silently retain that
-- definition and ON CONFLICT inference would then fail with PostgreSQL 42P10.
-- Refuse to rewrite queue data if an unexpected duplicate already exists.
do $$
begin
  if exists (
    select 1
    from public.torob_webhook_queue
    where status in ('pending','failed')
    group by page_unique
    having count(*) > 1
  ) then
    raise exception 'Cannot create Torob queue deduplication index: duplicate pending/failed page_unique values exist';
  end if;
end $$;

drop index if exists public.torob_webhook_queue_pending_unique;
create unique index torob_webhook_queue_pending_unique
  on public.torob_webhook_queue (page_unique) where status in ('pending','failed');
create index if not exists torob_webhook_queue_ready_idx
  on public.torob_webhook_queue (status, next_attempt_at, id);

create table if not exists public.torob_sync_events (
  id bigint generated always as identity primary key,
  event_type text not null,
  success boolean not null,
  item_count integer not null default 0,
  message text,
  created_at timestamptz not null default now()
);
create index if not exists torob_sync_events_created_idx on public.torob_sync_events (created_at desc);

alter table public.torob_webhook_queue enable row level security;
alter table public.torob_sync_events enable row level security;
revoke all on public.torob_webhook_queue, public.torob_sync_events from anon, authenticated;

-- Serialize enqueue operations per product, then update-or-insert. This avoids
-- partial-index inference entirely while the unique index remains a final
-- database invariant against accidental duplicate pending/failed rows.
create or replace function public.enqueue_torob_webhook_event(
  product_id_value uuid,
  page_unique_value text,
  page_url_value text,
  event_value text
)
returns void language plpgsql security definer set search_path=public as $$
begin
  if page_unique_value is null or page_unique_value = '' then
    raise exception 'Torob page_unique must not be empty';
  end if;
  if event_value not in ('upsert','remove') then
    raise exception 'Invalid Torob event type: %', event_value;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(page_unique_value, 837621));

  update public.torob_webhook_queue
  set product_id = product_id_value,
      page_url = page_url_value,
      event_type = event_value,
      status = 'pending',
      next_attempt_at = now(),
      locked_at = null,
      last_error = null
  where page_unique = page_unique_value
    and status in ('pending','failed');

  if not found then
    insert into public.torob_webhook_queue(product_id,page_unique,page_url,event_type)
    values(product_id_value,page_unique_value,page_url_value,event_value);
  end if;
end $$;

revoke all on function public.enqueue_torob_webhook_event(uuid,text,text,text)
  from public, anon, authenticated;

create or replace function public.enqueue_torob_product_change()
returns trigger language plpgsql security definer set search_path=public as $$
declare
  product_id_value uuid;
  page_unique_value text;
  slug_value text;
  event_value text;
begin
  if tg_op = 'DELETE' then
    product_id_value := old.id; page_unique_value := old.id::text; slug_value := old.slug; event_value := 'remove';
  else
    product_id_value := new.id; page_unique_value := new.id::text; slug_value := new.slug;
    event_value := case when new.is_active then 'upsert' else 'remove' end;
  end if;

  perform public.enqueue_torob_webhook_event(
    product_id_value,
    page_unique_value,
    '/products/' || slug_value,
    event_value
  );
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;

drop trigger if exists enqueue_torob_product_change on public.products;
create trigger enqueue_torob_product_change
after insert or update of slug,name,category_slug,price,compare_at,stock,description,specs,material,color,size_mm,image_url,image_urls,is_active,guarantee,torob_product_group_id
or delete on public.products for each row execute function public.enqueue_torob_product_change();

-- Queue the existing catalog once. The partial unique index keeps this idempotent
-- and no request is sent until the separately authenticated worker is configured.
do $$
declare
  product record;
begin
  for product in select id,slug,is_active from public.products loop
    perform public.enqueue_torob_webhook_event(
      product.id,
      product.id::text,
      '/products/' || product.slug,
      case when product.is_active then 'upsert' else 'remove' end
    );
  end loop;
end $$;

create or replace function public.claim_torob_webhook_batch(batch_size integer default 100)
returns setof public.torob_webhook_queue language plpgsql security definer set search_path=public as $$
begin
  return query
  with claimed as (
    select id from public.torob_webhook_queue
    where (status in ('pending','failed') and next_attempt_at <= now())
       or (status='processing' and locked_at < now() - interval '10 minutes')
    order by id for update skip locked limit least(greatest(batch_size,1),100)
  )
  update public.torob_webhook_queue q set status='processing',locked_at=now(),attempts=q.attempts+1
  from claimed where q.id=claimed.id returning q.*;
end $$;

revoke all on function public.claim_torob_webhook_batch(integer) from public, anon, authenticated;
grant execute on function public.claim_torob_webhook_batch(integer) to service_role;
grant execute on function public.enqueue_torob_webhook_event(uuid,text,text,text) to service_role;
grant select, insert, update, delete on public.torob_webhook_queue, public.torob_sync_events to service_role;
grant usage, select on sequence public.torob_webhook_queue_id_seq, public.torob_sync_events_id_seq to service_role;
