-- Fix Critical RBAC Vulnerability (simplified approach)
-- Remove ability for users to modify their own group_name and status

-- Drop existing policies that might conflict
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile (restricted)" ON public.profiles;

-- Create audit logging table for security events
CREATE TABLE IF NOT EXISTS public.security_audit (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  action TEXT NOT NULL,
  target_table TEXT,
  target_id UUID,
  old_values JSONB,
  new_values JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on audit table
ALTER TABLE public.security_audit ENABLE ROW LEVEL SECURITY;

-- Only admins can view audit logs
CREATE POLICY "Admins can view audit logs" 
ON public.security_audit 
FOR SELECT 
USING (is_admin());

-- System can insert audit logs
CREATE POLICY "System can insert audit logs" 
ON public.security_audit 
FOR INSERT 
WITH CHECK (true);

-- Create function to update user profile safely (prevents privilege escalation)
CREATE OR REPLACE FUNCTION public.update_user_profile(
  p_user_id UUID,
  p_full_name TEXT DEFAULT NULL,
  p_email TEXT DEFAULT NULL
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  -- Only allow users to update their own profile
  IF auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Access denied: can only update own profile';
  END IF;
  
  -- Update only safe fields (exclude group_name and status)
  UPDATE public.profiles 
  SET 
    full_name = COALESCE(p_full_name, full_name),
    email = COALESCE(p_email, email),
    updated_at = now()
  WHERE user_id = p_user_id;
  
  -- Log the update
  INSERT INTO public.security_audit (user_id, action, target_table, target_id)
  VALUES (auth.uid(), 'profile_update', 'profiles', p_user_id);
END;
$$;

-- Create function for admin to update any profile
CREATE OR REPLACE FUNCTION public.admin_update_profile(
  p_user_id UUID,
  p_full_name TEXT DEFAULT NULL,
  p_email TEXT DEFAULT NULL,
  p_group_name TEXT DEFAULT NULL,
  p_status TEXT DEFAULT NULL
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  -- Only admins can use this function
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Access denied: admin privileges required';
  END IF;
  
  -- Update all fields
  UPDATE public.profiles 
  SET 
    full_name = COALESCE(p_full_name, full_name),
    email = COALESCE(p_email, email),
    group_name = COALESCE(p_group_name, group_name),
    status = COALESCE(p_status, status),
    updated_at = now()
  WHERE user_id = p_user_id;
  
  -- Log the admin action
  INSERT INTO public.security_audit (user_id, action, target_table, target_id, new_values)
  VALUES (auth.uid(), 'admin_profile_update', 'profiles', p_user_id, 
          jsonb_build_object('group_name', p_group_name, 'status', p_status));
END;
$$;

-- Create restrictive policies that prevent direct table updates
CREATE POLICY "Prevent direct profile updates" 
ON public.profiles 
FOR UPDATE 
USING (false);

-- Allow users to view their own profile
CREATE POLICY "Users can view their own profile" 
ON public.profiles 
FOR SELECT 
USING (auth.uid() = user_id);

-- Allow admins to view all profiles  
CREATE POLICY "Admins can view all profiles" 
ON public.profiles 
FOR SELECT 
USING (is_admin());

-- Add constraints to prevent invalid status/group values
ALTER TABLE public.profiles 
ADD CONSTRAINT IF NOT EXISTS check_valid_group_name 
CHECK (group_name IN ('admin', 'rh', 'user'));

ALTER TABLE public.profiles 
ADD CONSTRAINT IF NOT EXISTS check_valid_status 
CHECK (status IN ('active', 'inactive', 'suspended'));