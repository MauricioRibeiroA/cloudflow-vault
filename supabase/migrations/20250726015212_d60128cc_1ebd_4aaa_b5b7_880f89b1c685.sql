-- Fix security warnings by setting search_path for all functions
CREATE OR REPLACE FUNCTION public.get_user_company_id(user_id UUID DEFAULT auth.uid())
RETURNS UUID
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path TO ''
AS $$
  SELECT company_id FROM public.profiles WHERE profiles.user_id = get_user_company_id.user_id;
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin(user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path TO ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.user_id = is_super_admin.user_id 
    AND group_name = 'super_admin'
    AND status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_company_admin(user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path TO ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.user_id = is_company_admin.user_id 
    AND group_name IN ('company_admin', 'super_admin')
    AND status = 'active'
  );
$$;