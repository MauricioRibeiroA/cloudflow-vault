-- Fix user types and resolve UUID issues
-- 1. Update existing user types to new structure
UPDATE public.profiles 
SET group_name = 'company_admin' 
WHERE group_name IN ('admin', 'rh');

-- 2. Create a default system company if none exists
INSERT INTO public.companies (id, name, domain, status, created_by, settings)
SELECT 
  gen_random_uuid(),
  'Sistema Principal',
  'sistema.local',
  'active',
  (SELECT user_id FROM public.profiles WHERE email = 'mauricio@example.com' LIMIT 1),
  '{"storage_limit_gb": 100}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM public.companies);

-- 3. Update profiles without company_id to use the default company
UPDATE public.profiles 
SET company_id = (SELECT id FROM public.companies LIMIT 1)
WHERE company_id IS NULL;

-- 4. Migrate Maurício to super_admin
UPDATE public.profiles 
SET group_name = 'super_admin'
WHERE email = 'mauricio@example.com' OR full_name ILIKE '%mauricio%';

-- 5. Update admin_create_user function to handle UUID issues
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
BEGIN
  -- Only company admins and super admins can create users
  IF NOT is_company_admin() THEN
    RAISE EXCEPTION 'Access denied: admin privileges required';
  END IF;
  
  -- Determine target company
  IF is_super_admin() AND p_company_id IS NOT NULL THEN
    target_company_id := p_company_id;
  ELSE
    target_company_id := get_user_company_id();
  END IF;
  
  IF target_company_id IS NULL THEN
    RAISE EXCEPTION 'Company ID is required';
  END IF;
  
  -- Create the user profile (user creation will be handled by the application)
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

-- 6. Update admin_update_profile function to handle UUID issues
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
BEGIN
  -- Only admins can use this function
  IF NOT is_company_admin() THEN
    RAISE EXCEPTION 'Access denied: admin privileges required';
  END IF;
  
  -- Update all fields including department and position, handling empty strings as NULL
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

-- 7. Update is_admin function to use new user types
CREATE OR REPLACE FUNCTION public.is_admin(user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.user_id = is_admin.user_id 
    AND group_name IN ('company_admin', 'super_admin')
    AND status = 'active'
  );
$function$;