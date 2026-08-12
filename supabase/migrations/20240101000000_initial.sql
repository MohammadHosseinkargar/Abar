-- Abar 3D schema for a hosted Supabase project.
create extension if not exists pgcrypto;

do $$ begin create type public.app_role as enum ('admin', 'user'); exception when duplicate_object then null; end $$;
do $$ begin create type public.order_status as enum ('pending','processing','printing','shipped','delivered','cancelled'); exception when duplicate_object then null; end $$;
do $$ begin create type public.payment_status as enum ('unpaid','paid','refunded'); exception when duplicate_object then null; end $$;

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(), slug text unique not null, name text not null,
  tagline text, image_url text, sort_order integer not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(), slug text unique not null, name text not null,
  category_slug text not null references public.categories(slug) on update cascade,
  price bigint not null default 0 check (price >= 0), compare_at bigint, stock integer not null default 0,
  rating numeric(3,2) not null default 0, reviews_count integer not null default 0,
  material text, color text, size_mm text, description text, specs jsonb not null default '[]',
  image_url text, model_url text, image_urls text[] not null default '{}', model_urls text[] not null default '{}',
  image_metadata jsonb, model_metadata jsonb, model_glb_url text, model_thumbnails text[],
  featured boolean not null default false, is_active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade, full_name text, phone text, avatar_url text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null, created_at timestamptz not null default now(), unique(user_id, role)
);
create table if not exists public.addresses (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  title text, receiver text not null, phone text not null, province text not null, city text not null,
  line text not null, postal_code text, is_default boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.discount_codes (
  id uuid primary key default gen_random_uuid(), code text unique not null, label text, percent integer not null check(percent between 1 and 100),
  active boolean not null default true, expires_at timestamptz, max_uses integer, used_count integer not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id), code text unique not null,
  subtotal bigint not null default 0, shipping_amount bigint not null default 0, discount_amount bigint not null default 0,
  total bigint not null default 0, discount_code text, shipping_address jsonb, note text,
  status public.order_status not null default 'pending', payment_status public.payment_status not null default 'unpaid',
  payment_method text, payment_authority text, payment_ref_id text, paid_at timestamptz,
  tracking_code text, stock_applied boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(), order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id), product_slug text, name text not null, qty integer not null check(qty > 0),
  price bigint not null check(price >= 0), created_at timestamptz not null default now()
);
create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(), product_id uuid not null references public.products(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade, author_name text, rating integer not null check(rating between 1 and 5),
  body text, approved boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(product_id,user_id)
);
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  title text not null, body text, kind text not null default 'info', link text, read boolean not null default false,
  created_at timestamptz not null default now()
);
create table if not exists public.site_settings (
  key text primary key, value jsonb not null default '{}', updated_at timestamptz not null default now()
);

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.user_roles where user_id=_user_id and role=_role)
$$;
grant execute on function public.has_role(uuid, public.app_role) to anon, authenticated;

create or replace function public.apply_order_stock(_order_id uuid)
returns void language plpgsql security definer set search_path=public as $$
begin
  if not exists(select 1 from orders where id=_order_id and (user_id=auth.uid() or has_role(auth.uid(),'admin'))) then raise exception 'not allowed'; end if;
  if exists(select 1 from orders where id=_order_id and stock_applied) then return; end if;
  if exists(select 1 from order_items i join products p on p.id=i.product_id where i.order_id=_order_id and p.stock<i.qty) then raise exception 'insufficient stock'; end if;
  update products p set stock=p.stock-i.qty from order_items i where i.order_id=_order_id and p.id=i.product_id;
  update orders set stock_applied=true where id=_order_id;
end $$;
grant execute on function public.apply_order_stock(uuid) to authenticated;

create or replace function public.set_updated_at() returns trigger language plpgsql as $$ begin new.updated_at=now(); return new; end $$;
do $$ declare t text; begin foreach t in array array['categories','products','profiles','addresses','discount_codes','orders','reviews'] loop
  execute format('drop trigger if exists set_updated_at on public.%I',t);
  execute format('create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()',t);
end loop; end $$;

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path=public as $$
begin insert into public.profiles(id,full_name) values(new.id,new.raw_user_meta_data->>'full_name') on conflict(id) do nothing; return new; end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

alter table public.categories enable row level security; alter table public.products enable row level security;
alter table public.profiles enable row level security; alter table public.user_roles enable row level security;
alter table public.addresses enable row level security; alter table public.discount_codes enable row level security;
alter table public.orders enable row level security; alter table public.order_items enable row level security;
alter table public.reviews enable row level security; alter table public.notifications enable row level security;
alter table public.site_settings enable row level security;

create policy "public read categories" on public.categories for select using(true);
create policy "public read active products" on public.products for select using(is_active or public.has_role(auth.uid(),'admin'));
create policy "public read active discounts" on public.discount_codes for select using(active or public.has_role(auth.uid(),'admin'));
create policy "public read approved reviews" on public.reviews for select using(approved or user_id=auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "own profile" on public.profiles for select using(id=auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "update own profile" on public.profiles for update using(id=auth.uid()) with check(id=auth.uid());
create policy "read own roles" on public.user_roles for select using(user_id=auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "bootstrap first admin" on public.user_roles for insert with check(user_id=auth.uid() and role='admin' and not exists(select 1 from public.user_roles where role='admin'));
create policy "own addresses" on public.addresses for all using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy "own orders" on public.orders for select using(user_id=auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "create own orders" on public.orders for insert with check(user_id=auth.uid());
create policy "update own unpaid orders" on public.orders for update using(user_id=auth.uid() and payment_status='unpaid') with check(user_id=auth.uid());
create policy "own order items" on public.order_items for select using(exists(select 1 from public.orders o where o.id=order_id and (o.user_id=auth.uid() or public.has_role(auth.uid(),'admin'))));
create policy "create own order items" on public.order_items for insert with check(exists(select 1 from public.orders o where o.id=order_id and o.user_id=auth.uid()));
create policy "create own reviews" on public.reviews for insert with check(user_id=auth.uid());
create policy "own notifications" on public.notifications for select using(user_id=auth.uid());
create policy "update own notifications" on public.notifications for update using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy "public read settings" on public.site_settings for select using(true);

insert into storage.buckets(id,name,public) values('product-images','product-images',false) on conflict(id) do nothing;
create policy "admin manage product files" on storage.objects for all to authenticated
using(bucket_id='product-images' and public.has_role(auth.uid(),'admin'))
with check(bucket_id='product-images' and public.has_role(auth.uid(),'admin'));

grant usage on schema public to anon, authenticated;
grant select on public.categories, public.products, public.discount_codes, public.reviews, public.site_settings to anon, authenticated;
grant select,insert,update,delete on all tables in schema public to authenticated;
