-- Insert default storage limit setting using auth.uid() which will work when an admin creates it
-- For now, let's create it with the first available user or system user
INSERT INTO public.settings (key, value, updated_by)
SELECT 'storage_limit_gb', '20'::jsonb, user_id 
FROM public.profiles 
WHERE group_name = 'admin' 
LIMIT 1
ON CONFLICT (key) DO NOTHING;

-- If no admin exists, create a system setting that can be updated later
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.settings WHERE key = 'storage_limit_gb') THEN
    -- Create a temporary entry that will be updated when first admin logs in
    INSERT INTO public.settings (key, value, updated_by)
    SELECT 'storage_limit_gb', '20'::jsonb, user_id 
    FROM public.profiles 
    LIMIT 1;
  END IF;
END $$;