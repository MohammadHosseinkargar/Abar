INSERT INTO public.site_settings (key, value)
VALUES ('heroModelUrl', '"/models/default-hero.glb"')
ON CONFLICT (key) DO NOTHING;
GRANT SELECT ON public.site_settings TO anon, authenticated;