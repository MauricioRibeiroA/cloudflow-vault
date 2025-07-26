-- Insert default storage limit setting
INSERT INTO public.settings (key, value, updated_by)
VALUES ('storage_limit_gb', '20'::jsonb, (SELECT user_id FROM public.profiles WHERE group_name = 'admin' LIMIT 1))
ON CONFLICT (key) DO NOTHING;