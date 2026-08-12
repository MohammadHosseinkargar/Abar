-- Sample Categories
INSERT INTO public.categories (slug, name, tagline, sort_order)
VALUES 
  ('decor', 'دکوراتیو', 'زیبایی بخش محیط زندگی شما', 1),
  ('figure', 'فیگور و اکشن فیگور', 'شخصیت‌های محبوب شما', 2),
  ('tool', 'قطعات کاربردی', 'حل چالش‌های فنی با چاپ سه‌بعدی', 3)
ON CONFLICT (slug) DO NOTHING;

-- Sample Products
INSERT INTO public.products (slug, name, category_slug, price, stock, rating, reviews_count, material, color, size_mm, description, featured)
VALUES 
  ('minimal-vase', 'گلدان مینیمال', 'decor', 150000, 10, 4.8, 5, 'PLA', 'سفید متالیک', '100x100x150', 'یک گلدان زیبا با طراحی مدرن.', true),
  ('spiderman-figure', 'فیگور مرد عنکبوتی', 'figure', 450000, 5, 4.9, 12, 'Resin', 'قرمز و آبی', '80x80x180', 'فیگور با جزئیات بالا.', true),
  ('gear-set', 'مجموعه چرخ‌دنده', 'tool', 85000, 20, 4.5, 3, 'PETG', 'مشکی', '50x50x10', 'چرخ‌دنده‌های مقاوم برای پروژه‌های فنی.', false)
ON CONFLICT (slug) DO NOTHING;
