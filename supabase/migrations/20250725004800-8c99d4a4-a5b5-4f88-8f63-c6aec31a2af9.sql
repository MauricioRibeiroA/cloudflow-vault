-- Fix Critical RBAC Vulnerability (corrected)
-- Remove ability for users to modify their own group_name and status

-- Drop existing user profile update policy
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

-- Create new restricted policy that prevents users from modifying sensitive fields
CREATE POLICY "Users can update their own profile (restricted)" 
ON public.profiles 
FOR UPDATE 
USING (auth.uid() = user_id)
WITH CHECK (
  auth.uid() = user_id 
  AND (OLD IS NULL OR OLD.group_name = NEW.group_name)  -- Prevent group_name changes
  AND (OLD IS NULL OR OLD.status = NEW.status)          -- Prevent status changes
);

-- Create separate policy for admins to modify all profile fields
CREATE POLICY "Admins can modify all profile fields" 
ON public.profiles 
FOR UPDATE 
USING (is_admin())
WITH CHECK (is_admin());

-- Add audit logging table for security events
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

-- Create function to log security events
CREATE OR REPLACE FUNCTION public.log_security_event(
  p_action TEXT,
  p_target_table TEXT DEFAULT NULL,
  p_target_id UUID DEFAULT NULL,
  p_old_values JSONB DEFAULT NULL,
  p_new_values JSONB DEFAULT NULL
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  INSERT INTO public.security_audit (
    user_id, action, target_table, target_id, old_values, new_values
  ) VALUES (
    auth.uid(), p_action, p_target_table, p_target_id, p_old_values, p_new_values
  );
END;
$$;

-- Add constraints to prevent invalid status/group values
ALTER TABLE public.profiles 
ADD CONSTRAINT check_valid_group_name 
CHECK (group_name IN ('admin', 'rh', 'user'));

ALTER TABLE public.profiles 
ADD CONSTRAINT check_valid_status 
CHECK (status IN ('active', 'inactive', 'suspended'));