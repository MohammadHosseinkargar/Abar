-- Standalone accounting ledger.  It deliberately has no trigger on products
-- or orders: accounting invoices never reserve stock nor alter catalog prices.
alter table public.products add column if not exists cost_price bigint not null default 0 check (cost_price >= 0);

create table if not exists public.financial_settings (
  id boolean primary key default true check (id), business_name text not null default '', logo_url text,
  phone text, address text, postal_code text, currency text not null default 'تومان',
  invoice_prefix text not null default 'INV-', invoice_next_number bigint not null default 1000 check (invoice_next_number > 0),
  footer_text text, invoice_accent text not null default '#2457d6', updated_at timestamptz not null default now()
);
insert into public.financial_settings(id) values (true) on conflict do nothing;

create table if not exists public.expense_categories (
  id uuid primary key default gen_random_uuid(), name text not null unique, is_refund boolean not null default false,
  created_at timestamptz not null default now()
);
insert into public.expense_categories(name,is_refund) values
 ('خرید کالا',false),('بسته‌بندی',false),('کارتن',false),('پست و ارسال',false),('تبلیغات',false),('حقوق',false),('اجاره',false),('تجهیزات',false),('کارمزد درگاه',false),('کارمزد بانکی',false),('مرجوعی / برگشت وجه',true),('قبوض',false),('سایر',false)
on conflict(name) do nothing;

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(), invoice_number text not null unique,
  issued_at timestamptz not null default now(), customer_name text not null, customer_phone text, customer_address text, customer_postal_code text,
  notes text, subtotal bigint not null default 0 check (subtotal >= 0), discount_amount bigint not null default 0 check (discount_amount >= 0),
  shipping_amount bigint not null default 0 check (shipping_amount >= 0), total_amount bigint not null default 0 check (total_amount >= 0),
  paid_amount bigint not null default 0 check (paid_amount >= 0), payment_status text not null default 'unpaid' check (payment_status in ('unpaid','partial','paid','cancelled')),
  payment_method text check (payment_method in ('cash','pos','card_transfer','gateway','other')), created_by uuid references auth.users(id),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check (paid_amount <= total_amount)
);
create table if not exists public.invoice_items (
  id uuid primary key default gen_random_uuid(), invoice_id uuid not null references public.invoices(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null, product_name text not null, quantity integer not null check (quantity > 0),
  catalog_unit_price bigint not null check (catalog_unit_price >= 0), final_unit_price bigint not null check (final_unit_price >= 0),
  unit_cost bigint not null default 0 check (unit_cost >= 0), discount_amount bigint not null default 0 check (discount_amount >= 0),
  line_total bigint not null check (line_total >= 0), notes text, created_at timestamptz not null default now()
);
create table if not exists public.manual_incomes (
  id uuid primary key default gen_random_uuid(), title text not null, category text not null default 'سایر', amount bigint not null check(amount > 0),
  occurred_at timestamptz not null default now(), payment_method text check (payment_method in ('cash','pos','card_transfer','gateway','other')),
  notes text, created_by uuid references auth.users(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(), title text not null, category_id uuid references public.expense_categories(id) on delete set null,
  quantity integer check(quantity > 0), unit text, unit_price bigint check(unit_price >= 0), total_amount bigint not null check(total_amount > 0),
  occurred_at timestamptz not null default now(), payment_method text check (payment_method in ('cash','pos','card_transfer','gateway','other')),
  notes text, receipt_url text, created_by uuid references auth.users(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.financial_transactions (
  id uuid primary key default gen_random_uuid(), transaction_type text not null check(transaction_type in ('income','expense')),
  amount bigint not null check(amount > 0), occurred_at timestamptz not null, category text, payment_method text, description text,
  source_type text not null, source_id uuid not null, created_at timestamptz not null default now(), unique(source_type,source_id)
);
create index if not exists invoices_issued_at_idx on public.invoices(issued_at);
create index if not exists invoice_items_invoice_idx on public.invoice_items(invoice_id);
create index if not exists expenses_occurred_at_idx on public.expenses(occurred_at);
create index if not exists financial_transactions_occurred_at_idx on public.financial_transactions(occurred_at);

create or replace function public.sync_financial_transaction() returns trigger language plpgsql security definer set search_path=public as $$
declare cat text; refund boolean;
begin
 if tg_table_name='invoices' then
   if new.paid_amount = 0 or new.payment_status='cancelled' then delete from financial_transactions where source_type='invoice_payment' and source_id=new.id;
   else insert into financial_transactions(transaction_type,amount,occurred_at,category,payment_method,description,source_type,source_id)
     values('income',new.paid_amount,new.issued_at,'فروش فاکتور',new.payment_method,'دریافت فاکتور '||new.invoice_number,'invoice_payment',new.id)
     on conflict(source_type,source_id) do update set amount=excluded.amount,occurred_at=excluded.occurred_at,payment_method=excluded.payment_method,description=excluded.description; end if;
 elsif tg_table_name='manual_incomes' then
   insert into financial_transactions(transaction_type,amount,occurred_at,category,payment_method,description,source_type,source_id)
   values('income',new.amount,new.occurred_at,new.category,new.payment_method,new.title,'manual_income',new.id)
   on conflict(source_type,source_id) do update set amount=excluded.amount,occurred_at=excluded.occurred_at,category=excluded.category,payment_method=excluded.payment_method,description=excluded.description;
 else
   select name,is_refund into cat,refund from expense_categories where id=new.category_id;
   insert into financial_transactions(transaction_type,amount,occurred_at,category,payment_method,description,source_type,source_id)
   values('expense',new.total_amount,new.occurred_at,coalesce(cat,'سایر'),new.payment_method,new.title,'expense',new.id)
   on conflict(source_type,source_id) do update set amount=excluded.amount,occurred_at=excluded.occurred_at,category=excluded.category,payment_method=excluded.payment_method,description=excluded.description;
 end if; return new;
end $$;
create or replace function public.delete_financial_transaction() returns trigger language plpgsql security definer set search_path=public as $$ begin
 delete from financial_transactions where source_type=case tg_table_name when 'invoices' then 'invoice_payment' when 'manual_incomes' then 'manual_income' else 'expense' end and source_id=old.id; return old; end $$;
do $$ declare t text; begin foreach t in array array['invoices','manual_incomes','expenses'] loop
 execute format('drop trigger if exists sync_financial_transaction on public.%I',t); execute format('create trigger sync_financial_transaction after insert or update on public.%I for each row execute function public.sync_financial_transaction()',t);
 execute format('drop trigger if exists delete_financial_transaction on public.%I',t); execute format('create trigger delete_financial_transaction after delete on public.%I for each row execute function public.delete_financial_transaction()',t);
 execute format('drop trigger if exists set_updated_at on public.%I',t); execute format('create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()',t); end loop; end $$;

create or replace function public.save_accounting_invoice(_invoice jsonb, _items jsonb) returns uuid language plpgsql security definer set search_path=public as $$
declare iid uuid; it jsonb; sub bigint := 0; disc bigint := 0; next_no bigint; prefix text;
begin
 if not public.has_role(auth.uid(),'admin') then raise exception 'not allowed'; end if;
 if jsonb_array_length(_items)=0 then raise exception 'invoice needs an item'; end if;
 iid := nullif(_invoice->>'id','')::uuid;
 for it in select * from jsonb_array_elements(_items) loop
   if (it->>'quantity')::integer < 1 or (it->>'finalUnitPrice')::bigint < 0 then raise exception 'invalid invoice item'; end if;
   sub := sub + (it->>'quantity')::integer * (it->>'finalUnitPrice')::bigint; disc := disc + coalesce((it->>'discountAmount')::bigint,0);
 end loop;
 if iid is null then select invoice_prefix,invoice_next_number into prefix,next_no from financial_settings where id=true for update;
   insert into invoices(invoice_number,issued_at,customer_name,customer_phone,customer_address,customer_postal_code,notes,subtotal,discount_amount,shipping_amount,total_amount,paid_amount,payment_status,payment_method,created_by)
   values(prefix||next_no,coalesce((_invoice->>'issuedAt')::timestamptz,now()),_invoice->>'customerName',nullif(_invoice->>'customerPhone',''),nullif(_invoice->>'customerAddress',''),nullif(_invoice->>'customerPostalCode',''),nullif(_invoice->>'notes',''),sub+disc,disc+coalesce((_invoice->>'discountAmount')::bigint,0),coalesce((_invoice->>'shippingAmount')::bigint,0),sub-disc+coalesce((_invoice->>'shippingAmount')::bigint,0),coalesce((_invoice->>'paidAmount')::bigint,0),_invoice->>'paymentStatus',nullif(_invoice->>'paymentMethod',''),auth.uid()) returning id into iid;
   update financial_settings set invoice_next_number=next_no+1 where id=true;
 else
   update invoices set issued_at=coalesce((_invoice->>'issuedAt')::timestamptz,issued_at),customer_name=_invoice->>'customerName',customer_phone=nullif(_invoice->>'customerPhone',''),customer_address=nullif(_invoice->>'customerAddress',''),customer_postal_code=nullif(_invoice->>'customerPostalCode',''),notes=nullif(_invoice->>'notes',''),subtotal=sub+disc,discount_amount=disc+coalesce((_invoice->>'discountAmount')::bigint,0),shipping_amount=coalesce((_invoice->>'shippingAmount')::bigint,0),total_amount=sub-disc+coalesce((_invoice->>'shippingAmount')::bigint,0),paid_amount=coalesce((_invoice->>'paidAmount')::bigint,0),payment_status=_invoice->>'paymentStatus',payment_method=nullif(_invoice->>'paymentMethod','') where id=iid;
   if not found then raise exception 'invoice not found'; end if; delete from invoice_items where invoice_id=iid;
 end if;
 for it in select * from jsonb_array_elements(_items) loop insert into invoice_items(invoice_id,product_id,product_name,quantity,catalog_unit_price,final_unit_price,unit_cost,discount_amount,line_total,notes)
 values(iid,nullif(it->>'productId','')::uuid,it->>'productName',(it->>'quantity')::integer,(it->>'catalogUnitPrice')::bigint,(it->>'finalUnitPrice')::bigint,coalesce((it->>'unitCost')::bigint,0),coalesce((it->>'discountAmount')::bigint,0),(it->>'quantity')::integer*(it->>'finalUnitPrice')::bigint-coalesce((it->>'discountAmount')::bigint,0),nullif(it->>'notes','')); end loop;
 return iid;
end $$;

alter table public.financial_settings enable row level security; alter table public.expense_categories enable row level security; alter table public.invoices enable row level security; alter table public.invoice_items enable row level security; alter table public.manual_incomes enable row level security; alter table public.expenses enable row level security; alter table public.financial_transactions enable row level security;
create policy "admin manage accounting settings" on public.financial_settings for all using(public.has_role(auth.uid(),'admin')) with check(public.has_role(auth.uid(),'admin'));
create policy "admin manage expense categories" on public.expense_categories for all using(public.has_role(auth.uid(),'admin')) with check(public.has_role(auth.uid(),'admin'));
create policy "admin manage invoices" on public.invoices for all using(public.has_role(auth.uid(),'admin')) with check(public.has_role(auth.uid(),'admin'));
create policy "admin manage invoice items" on public.invoice_items for all using(public.has_role(auth.uid(),'admin')) with check(public.has_role(auth.uid(),'admin'));
create policy "admin manage incomes" on public.manual_incomes for all using(public.has_role(auth.uid(),'admin')) with check(public.has_role(auth.uid(),'admin'));
create policy "admin manage expenses" on public.expenses for all using(public.has_role(auth.uid(),'admin')) with check(public.has_role(auth.uid(),'admin'));
create policy "admin read transactions" on public.financial_transactions for select using(public.has_role(auth.uid(),'admin'));
grant execute on function public.save_accounting_invoice(jsonb,jsonb) to authenticated;
