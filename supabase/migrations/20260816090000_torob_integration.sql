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

create unique index if not exists torob_webhook_queue_pending_unique
  on public.torob_webhook_queue (page_unique) where status in ('pending','processing');
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

  insert into public.torob_webhook_queue(product_id,page_unique,page_url,event_type)
  values(product_id_value,page_unique_value,'/products/' || slug_value,event_value)
  on conflict (page_unique) where status in ('pending','processing')
  do update set product_id=excluded.product_id,page_url=excluded.page_url,event_type=excluded.event_type,
    status='pending',next_attempt_at=now(),locked_at=null,last_error=null;
  return coalesce(new,old);
end $$;

drop trigger if exists enqueue_torob_product_change on public.products;
create trigger enqueue_torob_product_change
after insert or update of slug,name,price,compare_at,stock,description,specs,image_url,image_urls,is_active,guarantee,torob_product_group_id
or delete on public.products for each row execute function public.enqueue_torob_product_change();

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
