-- Assign admin role to the created user
INSERT INTO public.user_roles (user_id, role)
VALUES ('11ad12ce-928a-492a-b784-6e059ae5aa63', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;
