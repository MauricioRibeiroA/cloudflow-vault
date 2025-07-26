-- Insert default storage limit setting without requiring an admin user
INSERT INTO public.settings (key, value, updated_by)
VALUES ('storage_limit_gb', '20'::jsonb, gen_random_uuid())
ON CONFLICT (key) DO NOTHING;