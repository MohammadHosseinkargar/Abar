-- Zibal payment audit trail and atomic finalization.
create table if not exists public.payment_attempts (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider in ('zibal')),
  track_id text not null,
  order_id uuid not null references public.orders(id) on delete cascade,
  state text not null check (state in ('requested','verifying','paid','failed','verify_error')),
  gateway_result integer,
  last_checked_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique(provider, track_id)
);

alter table public.payment_attempts enable row level security;
revoke all on public.payment_attempts from anon, authenticated;
grant all on public.payment_attempts to service_role;

create unique index if not exists orders_payment_authority_unique
  on public.orders(payment_authority)
  where payment_authority is not null;

create or replace function public.finalize_zibal_payment(
  _order_id uuid,
  _track_id text,
  _amount_rial bigint,
  _ref_number text,
  _paid_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  target public.orders%rowtype;
begin
  select * into target from public.orders where id = _order_id for update;
  if not found then raise exception 'payment order not found' using errcode = 'P0002'; end if;
  if target.payment_authority is distinct from _track_id then
    raise exception 'payment track mismatch' using errcode = '22023';
  end if;

  if target.payment_status = 'paid' then
    return jsonb_build_object('paid', true, 'code', target.code, 'ref_id', target.payment_ref_id, 'already_paid', true);
  end if;
  if target.payment_status <> 'unpaid' then
    raise exception 'invalid payment state' using errcode = '22023';
  end if;
  if _amount_rial is null or _amount_rial <> target.total * 10 then
    raise exception 'payment amount mismatch' using errcode = '22023';
  end if;

  update public.orders
  set payment_status = 'paid',
      status = 'processing',
      payment_method = 'zibal',
      payment_ref_id = coalesce(_ref_number, payment_ref_id),
      paid_at = coalesce(_paid_at, now())
  where id = _order_id;

  return jsonb_build_object('paid', true, 'code', target.code, 'ref_id', _ref_number, 'already_paid', false);
end;
$$;

revoke all on function public.finalize_zibal_payment(uuid,text,bigint,text,timestamptz) from public, anon, authenticated;
grant execute on function public.finalize_zibal_payment(uuid,text,bigint,text,timestamptz) to service_role;

-- Serialize stock reservation for an order and use guarded stock updates.
create or replace function public.apply_order_stock(_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target public.orders%rowtype;
begin
  select * into target from public.orders where id = _order_id for update;
  if not found or (target.user_id <> auth.uid() and not public.has_role(auth.uid(),'admin')) then
    raise exception 'not allowed';
  end if;
  if target.stock_applied then return; end if;

  perform 1
  from public.products p
  join public.order_items i on i.product_id = p.id
  where i.order_id = _order_id
  order by p.id
  for update of p;

  if exists (
    select 1 from public.order_items i
    join public.products p on p.id = i.product_id
    where i.order_id = _order_id and (not p.is_active or p.stock < i.qty)
  ) then
    raise exception 'insufficient stock';
  end if;

  update public.products p
  set stock = p.stock - i.qty
  from public.order_items i
  where i.order_id = _order_id and p.id = i.product_id;

  update public.orders set stock_applied = true where id = _order_id;
end;
$$;

-- Preserve the immutable order item snapshot even if a product is ever hard-deleted.
alter table public.order_items drop constraint if exists order_items_product_id_fkey;
alter table public.order_items alter column product_id drop not null;
alter table public.order_items
  add constraint order_items_product_id_fkey
  foreign key (product_id) references public.products(id) on delete set null;
