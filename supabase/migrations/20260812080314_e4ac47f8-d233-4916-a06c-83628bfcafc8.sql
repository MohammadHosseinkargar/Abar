-- Initial schema for Abar project
CREATE TYPE public.app_role AS ENUM ('admin', 'user');
CREATE TYPE public.order_status AS ENUM ('pending','processing','printing','shipped','delivered','cancelled');
CREATE TYPE public.payment_status AS ENUM ('unpaid','paid','refunded');

CREATE TABLE public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  tagline text,
  image_url text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  category_slug text NOT NULL REFERENCES public.categories(slug) ON UPDATE CASCADE,
  price bigint NOT NULL DEFAULT 0 CHECK (price >= 0),
  compare_at bigint,
  stock integer NOT NULL DEFAULT 0,
  rating numeric(3,2) NOT NULL DEFAULT 0,
  reviews_count integer NOT NULL DEFAULT 0,
  material text,
  color text,
  size_mm text,
  description text,
  specs jsonb NOT NULL DEFAULT '[]',
  image_url text,
  model_url text,
  image_urls text[] NOT NULL DEFAULT '{}',
  model_urls text[] NOT NULL DEFAULT '{}',
  image_metadata jsonb,
  model_metadata jsonb,
  model_glb_url text,
  model_thumbnails text[],
  featured boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  phone text,
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

CREATE TABLE public.addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text,
  receiver text NOT NULL,
  phone text NOT NULL,
  province text NOT NULL,
  city text NOT NULL,
  line text NOT NULL,
  postal_code text,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.discount_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  label text,
  percent integer NOT NULL CHECK(percent BETWEEN 1 AND 100),
  active boolean NOT NULL DEFAULT true,
  expires_at timestamptz,
  max_uses integer,
  used_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  code text UNIQUE NOT NULL,
  subtotal bigint NOT NULL DEFAULT 0,
  shipping_amount bigint NOT NULL DEFAULT 0,
  discount_amount bigint NOT NULL DEFAULT 0,
  total bigint NOT NULL DEFAULT 0,
  discount_code text,
  shipping_address jsonb,
  note text,
  status public.order_status NOT NULL DEFAULT 'pending',
  payment_status public.payment_status NOT NULL DEFAULT 'unpaid',
  payment_method text,
  payment_authority text,
  payment_ref_id text,
  paid_at timestamptz,
  tracking_code text,
  stock_applied boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id),
  product_slug text,
  name text NOT NULL,
  qty integer NOT NULL CHECK(qty > 0),
  price bigint NOT NULL CHECK(price >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  author_name text,
  rating integer NOT NULL CHECK(rating BETWEEN 1 AND 5),
  body text,
  approved boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(product_id,user_id)
);

CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text,
  kind text NOT NULL DEFAULT 'info',
  link text,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.site_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Security Definer Functions
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=_user_id AND role=_role)
$$;

CREATE OR REPLACE FUNCTION public.apply_order_stock(_order_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NOT EXISTS(SELECT 1 FROM orders WHERE id=_order_id AND (user_id=auth.uid() OR has_role(auth.uid(),'admin'))) THEN RAISE EXCEPTION 'not allowed'; END IF;
  IF EXISTS(SELECT 1 FROM orders WHERE id=_order_id AND stock_applied) THEN RETURN; END IF;
  IF EXISTS(SELECT 1 FROM order_items i JOIN products p ON p.id=i.product_id WHERE i.order_id=_order_id AND p.stock<i.qty) THEN RAISE EXCEPTION 'insufficient stock'; END IF;
  UPDATE products p SET stock=p.stock-i.qty FROM order_items i WHERE i.order_id=_order_id AND p.id=i.product_id;
  UPDATE orders SET stock_applied=true WHERE id=_order_id;
END $$;

-- Triggers
CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN new.updated_at=now(); RETURN new; END $$;

DO $$ 
DECLARE 
  t text; 
BEGIN 
  FOR t IN SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('categories','products','profiles','addresses','discount_codes','orders','reviews') LOOP
    EXECUTE format('CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()', t);
  END LOOP; 
END $$;

CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN 
  INSERT INTO public.profiles(id, full_name) 
  VALUES(new.id, new.raw_user_meta_data->>'full_name') 
  ON CONFLICT(id) DO NOTHING; 
  RETURN new; 
END $$;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- RLS
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discount_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "public read categories" ON public.categories FOR SELECT USING(true);
CREATE POLICY "public read active products" ON public.products FOR SELECT USING(is_active OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "public read active discounts" ON public.discount_codes FOR SELECT USING(active OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "public read approved reviews" ON public.reviews FOR SELECT USING(approved OR user_id=auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "own profile" ON public.profiles FOR SELECT USING(id=auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "update own profile" ON public.profiles FOR UPDATE USING(id=auth.uid()) WITH CHECK(id=auth.uid());
CREATE POLICY "read own roles" ON public.user_roles FOR SELECT USING(user_id=auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "bootstrap first admin" ON public.user_roles FOR INSERT WITH CHECK(user_id=auth.uid() AND role='admin' AND NOT EXISTS(SELECT 1 FROM public.user_roles WHERE role='admin'));
CREATE POLICY "own addresses" ON public.addresses FOR ALL USING(user_id=auth.uid()) WITH CHECK(user_id=auth.uid());
CREATE POLICY "own orders" ON public.orders FOR SELECT USING(user_id=auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "create own orders" ON public.orders FOR INSERT WITH CHECK(user_id=auth.uid());
CREATE POLICY "update own unpaid orders" ON public.orders FOR UPDATE USING(user_id=auth.uid() AND payment_status='unpaid') WITH CHECK(user_id=auth.uid());
CREATE POLICY "own order items" ON public.order_items FOR SELECT USING(EXISTS(SELECT 1 FROM public.orders o WHERE o.id=order_id AND (o.user_id=auth.uid() OR public.has_role(auth.uid(),'admin'))));
CREATE POLICY "create own order items" ON public.order_items FOR INSERT WITH CHECK(EXISTS(SELECT 1 FROM public.orders o WHERE o.id=order_id AND o.user_id=auth.uid()));
CREATE POLICY "create own reviews" ON public.reviews FOR INSERT WITH CHECK(user_id=auth.uid());
CREATE POLICY "own notifications" ON public.notifications FOR SELECT USING(user_id=auth.uid());
CREATE POLICY "update own notifications" ON public.notifications FOR UPDATE USING(user_id=auth.uid()) WITH CHECK(user_id=auth.uid());
CREATE POLICY "public read settings" ON public.site_settings FOR SELECT USING(true);

-- Grants
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON public.categories, public.products, public.discount_codes, public.reviews, public.site_settings TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.categories, public.products, public.profiles, public.user_roles, public.addresses, public.discount_codes, public.orders, public.order_items, public.reviews, public.notifications, public.site_settings TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_order_stock(uuid) TO authenticated;