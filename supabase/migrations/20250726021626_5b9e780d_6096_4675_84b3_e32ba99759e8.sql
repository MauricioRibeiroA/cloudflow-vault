-- Add HR user type support
-- 1. Update existing user types to include HR
-- No need to modify existing data, just add support for HR

-- 2. Create is_hr function
CREATE OR REPLACE FUNCTION public.is_hr(user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.user_id = is_hr.user_id 
    AND group_name = 'hr'
    AND status = 'active'
  );
$function$;

-- 3. Update is_company_admin function to include HR for certain operations
CREATE OR REPLACE FUNCTION public.is_company_admin_or_hr(user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.user_id = is_company_admin_or_hr.user_id 
    AND group_name IN ('company_admin', 'super_admin', 'hr')
    AND status = 'active'
  );
$function$;

-- 4. Update admin_create_user function to allow HR to create regular users only
CREATE OR REPLACE FUNCTION public.admin_create_user(
  p_email text, 
  p_full_name text, 
  p_group_name text DEFAULT 'user'::text, 
  p_company_id uuid DEFAULT NULL::uuid, 
  p_department_id uuid DEFAULT NULL::uuid, 
  p_position_id uuid DEFAULT NULL::uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  new_user_id UUID;
  target_company_id UUID;
  current_user_group TEXT;
BEGIN
  -- Get current user's group
  SELECT group_name INTO current_user_group 
  FROM public.profiles 
  WHERE user_id = auth.uid() AND status = 'active';
  
  -- Check permissions based on user type
  IF current_user_group = 'super_admin' THEN
    -- Super admin can create any user type
    NULL;
  ELSIF current_user_group = 'company_admin' THEN
    -- Company admin can create hr and user types
    IF p_group_name NOT IN ('hr', 'user') THEN
      RAISE EXCEPTION 'Company admins can only create HR and regular users';
    END IF;
  ELSIF current_user_group = 'hr' THEN
    -- HR can only create regular users
    IF p_group_name != 'user' THEN
      RAISE EXCEPTION 'HR can only create regular users';
    END IF;
  ELSE
    RAISE EXCEPTION 'Access denied: admin privileges required';
  END IF;
  
  -- Determine target company
  IF current_user_group = 'super_admin' AND p_company_id IS NOT NULL THEN
    target_company_id := p_company_id;
  ELSE
    target_company_id := get_user_company_id();
  END IF;
  
  IF target_company_id IS NULL THEN
    RAISE EXCEPTION 'Company ID is required';
  END IF;
  
  -- Create the user profile
  new_user_id := gen_random_uuid();
  
  INSERT INTO public.profiles (user_id, full_name, email, group_name, company_id, department_id, position_id)
  VALUES (new_user_id, p_full_name, p_email, p_group_name, target_company_id, 
          CASE WHEN p_department_id = '' THEN NULL ELSE p_department_id END,
          CASE WHEN p_position_id = '' THEN NULL ELSE p_position_id END);
  
  -- Log the action
  INSERT INTO public.security_audit (user_id, action, target_table, target_id, company_id, new_values)
  VALUES (auth.uid(), 'user_created', 'profiles', new_user_id, target_company_id,
          jsonb_build_object('email', p_email, 'group_name', p_group_name, 'company_id', target_company_id));
  
  RETURN new_user_id;
END;
$function$;

-- 5. Update admin_update_profile function to respect HR limitations
CREATE OR REPLACE FUNCTION public.admin_update_profile(
  p_user_id uuid, 
  p_full_name text DEFAULT NULL::text, 
  p_email text DEFAULT NULL::text, 
  p_group_name text DEFAULT NULL::text, 
  p_status text DEFAULT NULL::text, 
  p_department_id uuid DEFAULT NULL::uuid, 
  p_position_id uuid DEFAULT NULL::uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  current_user_group TEXT;
  target_user_group TEXT;
BEGIN
  -- Get current user's group
  SELECT group_name INTO current_user_group 
  FROM public.profiles 
  WHERE user_id = auth.uid() AND status = 'active';
  
  -- Get target user's current group
  SELECT group_name INTO target_user_group 
  FROM public.profiles 
  WHERE user_id = p_user_id;
  
  -- Check permissions based on user type
  IF current_user_group = 'super_admin' THEN
    -- Super admin can update anyone
    NULL;
  ELSIF current_user_group = 'company_admin' THEN
    -- Company admin can update hr and users, but not other admins
    IF target_user_group IN ('company_admin', 'super_admin') AND target_user_group != current_user_group THEN
      RAISE EXCEPTION 'Company admins cannot modify other admins';
    END IF;
    -- Company admin can promote users to HR or demote HR to user
    IF p_group_name IS NOT NULL AND p_group_name NOT IN ('hr', 'user') THEN
      RAISE EXCEPTION 'Company admins can only set users as HR or regular users';
    END IF;
  ELSIF current_user_group = 'hr' THEN
    -- HR can only update regular users
    IF target_user_group != 'user' THEN
      RAISE EXCEPTION 'HR can only modify regular users';
    END IF;
    -- HR cannot change user group
    IF p_group_name IS NOT NULL AND p_group_name != 'user' THEN
      RAISE EXCEPTION 'HR cannot change user group types';
    END IF;
  ELSE
    RAISE EXCEPTION 'Access denied: admin privileges required';
  END IF;
  
  -- Update fields
  UPDATE public.profiles 
  SET 
    full_name = COALESCE(p_full_name, full_name),
    email = COALESCE(p_email, email),
    group_name = COALESCE(p_group_name, group_name),
    status = COALESCE(p_status, status),
    department_id = CASE WHEN p_department_id = '' THEN NULL ELSE COALESCE(p_department_id, department_id) END,
    position_id = CASE WHEN p_position_id = '' THEN NULL ELSE COALESCE(p_position_id, position_id) END,
    updated_at = now()
  WHERE user_id = p_user_id;
  
  -- Log the admin action
  INSERT INTO public.security_audit (user_id, action, target_table, target_id, new_values)
  VALUES (auth.uid(), 'admin_profile_update', 'profiles', p_user_id, 
          jsonb_build_object(
            'group_name', p_group_name, 
            'status', p_status,
            'department_id', p_department_id,
            'position_id', p_position_id
          ));
END;
$function$;

-- Test users will be created through the application after authentication is set up
-- Removing insertions to avoid FK constraint violations during migration
