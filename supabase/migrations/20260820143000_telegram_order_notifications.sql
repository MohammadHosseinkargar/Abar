-- Transactional outbox for paid-order Telegram notifications.
create table if not exists public.telegram_order_notifications (
  order_id uuid primary key references public.orders(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','sending','sent','failed')),
  attempt_count integer not null default 0,
  claimed_at timestamptz,
  sent_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.telegram_order_notifications enable row level security;
revoke all on public.telegram_order_notifications from anon, authenticated;
grant all on public.telegram_order_notifications to service_role;

create or replace function public.claim_telegram_order_notification(_order_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  claimed boolean;
begin
  update public.telegram_order_notifications n
  set status = 'sending',
      attempt_count = attempt_count + 1,
      claimed_at = now(),
      last_error = null,
      updated_at = now()
  from public.orders o
  where n.order_id = _order_id
    and o.id = n.order_id
    and o.payment_status = 'paid'
    and n.status in ('pending','failed')
  returning true into claimed;
  return coalesce(claimed, false);
end;
$$;

revoke all on function public.claim_telegram_order_notification(uuid) from public, anon, authenticated;
grant execute on function public.claim_telegram_order_notification(uuid) to service_role;

create table if not exists public.telegram_order_notification_recipients (
  order_id uuid not null references public.telegram_order_notifications(order_id) on delete cascade,
  chat_id text not null,
  status text not null default 'pending' check (status in ('pending','sending','sent','failed')),
  attempt_count integer not null default 0,
  claimed_at timestamptz,
  sent_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key(order_id, chat_id)
);

alter table public.telegram_order_notification_recipients enable row level security;
revoke all on public.telegram_order_notification_recipients from anon, authenticated;
grant all on public.telegram_order_notification_recipients to service_role;

create or replace function public.claim_telegram_order_notification_recipient(
  _order_id uuid,
  _chat_id text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  claimed boolean;
begin
  update public.telegram_order_notification_recipients r
  set status = 'sending',
      attempt_count = attempt_count + 1,
      claimed_at = now(),
      last_error = null,
      updated_at = now()
  from public.orders o
  where r.order_id = _order_id
    and r.chat_id = _chat_id
    and o.id = r.order_id
    and o.payment_status = 'paid'
    and r.status in ('pending','failed')
  returning true into claimed;
  return coalesce(claimed, false);
end;
$$;

revoke all on function public.claim_telegram_order_notification_recipient(uuid,text) from public, anon, authenticated;
grant execute on function public.claim_telegram_order_notification_recipient(uuid,text) to service_role;

-- Replace payment finalization so creation of the notification outbox record
-- commits atomically with the paid order. Existing paid orders are not backfilled.
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

  insert into public.telegram_order_notifications(order_id, status)
  values (_order_id, 'pending')
  on conflict (order_id) do nothing;

  return jsonb_build_object('paid', true, 'code', target.code, 'ref_id', _ref_number, 'already_paid', false);
end;
$$;

revoke all on function public.finalize_zibal_payment(uuid,text,bigint,text,timestamptz) from public, anon, authenticated;
grant execute on function public.finalize_zibal_payment(uuid,text,bigint,text,timestamptz) to service_role;
