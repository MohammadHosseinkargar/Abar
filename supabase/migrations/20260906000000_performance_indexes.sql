-- Performance indexes for high-traffic queries.
-- All use IF NOT EXISTS so re-running is safe.

-- orders: most admin and user queries filter/sort by these columns
create index if not exists orders_user_id_idx          on public.orders(user_id);
create index if not exists orders_status_idx           on public.orders(status);
create index if not exists orders_payment_status_idx   on public.orders(payment_status);
create index if not exists orders_created_at_idx       on public.orders(created_at desc);

-- products: catalog listing filters on category + active flag, sorts on created_at
create index if not exists products_category_active_idx
  on public.products(category_slug, is_active);
create index if not exists products_featured_active_idx
  on public.products(featured, is_active)
  where featured = true and is_active = true;
create index if not exists products_created_at_idx     on public.products(created_at desc);

-- order_items: placeOrder reads items by product_id to verify stock;
-- listMyOrders embeds order_items per order
create index if not exists order_items_order_id_idx    on public.order_items(order_id);
create index if not exists order_items_product_id_idx  on public.order_items(product_id);

-- reviews: product page fetches approved reviews for a product
create index if not exists reviews_product_approved_idx
  on public.reviews(product_id, approved)
  where approved = true;

-- notifications: user notification badge queries unread count
create index if not exists notifications_user_read_idx
  on public.notifications(user_id, read)
  where read = false;

-- discount_codes: validateDiscount does ilike lookup on active codes
create index if not exists discount_codes_active_idx
  on public.discount_codes(active, code)
  where active = true;
