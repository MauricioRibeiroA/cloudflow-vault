-- Fix status constraint to include pending_activation status
-- This fixes the error: new row for relation "profiles" violates check constraint "profiles_status_check"

-- Drop the old constraint
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS check_valid_status;
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_status_check;

-- Add the new constraint with all valid status values including pending_activation
ALTER TABLE public.profiles ADD CONSTRAINT profiles_status_check 
CHECK (status IN ('active', 'inactive', 'suspended', 'pending_activation'));

-- Also update the other migration constraint if it exists
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS check_valid_group_name;
ALTER TABLE public.profiles ADD CONSTRAINT check_valid_group_name 
CHECK (group_name IN ('admin', 'rh', 'user', 'super_admin', 'company_admin', 'hr'));
