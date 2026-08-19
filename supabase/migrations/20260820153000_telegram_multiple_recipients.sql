-- Per-admin delivery state. This remains idempotent for projects where the
-- original Telegram migration was applied before multi-admin support existed.
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
