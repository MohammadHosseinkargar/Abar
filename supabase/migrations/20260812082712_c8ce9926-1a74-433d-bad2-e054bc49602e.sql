-- Step 1: Create color and size variants for existing products
-- We need to check existing products first, but let's assume we can add columns to products table 
-- to support a list of available colors and sizes.

-- However, a better approach for a "store" is to have a product_variants table 
-- but the user just wants "selection of color and size" on product page.
-- The products table already has "color" and "size_mm" as nullable text columns.
-- We should probably evolve these to be arrays or JSON if they represent "available" options.
-- Or just add new columns if we want to keep simple.

ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS available_colors text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS available_sizes text[] DEFAULT '{}';

COMMENT ON COLUMN public.products.available_colors IS 'List of available colors for selection';
COMMENT ON COLUMN public.products.available_sizes IS 'List of available sizes for selection';

-- Update sample data to have some options
UPDATE public.products 
SET available_colors = ARRAY['سفید', 'مشکی', 'قرمز', 'آبی'],
    available_sizes = ARRAY['کوچک', 'متوسط', 'بزرگ']
WHERE slug = 'minimal-vase';

UPDATE public.products 
SET available_colors = ARRAY['طلایی', 'نقره‌ای', 'برنزی'],
    available_sizes = ARRAY['۱۰ سانتی‌متر', '۱۵ سانتی‌متر', '۲۰ سانتی‌متر']
WHERE slug = 'spider-man-figure';
