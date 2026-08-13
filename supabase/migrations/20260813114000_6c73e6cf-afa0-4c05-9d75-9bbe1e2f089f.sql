ALTER TABLE products ADD COLUMN IF NOT EXISTS is_bookmark BOOLEAN DEFAULT false;
UPDATE products SET is_bookmark = true WHERE name ILIKE '%بوکمارک%' OR name ILIKE '%bookmark%';