INSERT INTO public.site_settings (key, value)
VALUES 
  ('storeName', '"ابر تری دی"'),
  ('supportPhone', '"+98 915 284 4711"'),
  ('supportEmail', '""'),
  ('announcement', '""'),
  ('shippingStandard', '65000'),
  ('shippingExpress', '120000'),
  ('freeShippingOver', '0'),
  ('zibalEnabled', 'false'),
  ('zibalMerchant', '""'),
  ('zibalSandbox', 'true')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
