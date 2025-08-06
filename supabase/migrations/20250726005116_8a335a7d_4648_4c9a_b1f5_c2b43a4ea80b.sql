-- Add department_id and position_id to profiles table
ALTER TABLE public.profiles 
ADD COLUMN department_id UUID REFERENCES public.departments(id),
ADD COLUMN position_id UUID REFERENCES public.positions(id);

-- Update the admin_update_profile function to include department and position
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
SET search_path = ''
AS $function$
BEGIN
  -- Only admins can use this function
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Access denied: admin privileges required';
  END IF;
  
  -- Update all fields including department and position
  UPDATE public.profiles 
  SET 
    full_name = COALESCE(p_full_name, full_name),
    email = COALESCE(p_email, email),
    group_name = COALESCE(p_group_name, group_name),
    status = COALESCE(p_status, status),
    department_id = COALESCE(p_department_id, department_id),
    position_id = COALESCE(p_position_id, position_id),
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