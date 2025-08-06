-- Remove references to 'ti' group from RLS policies

-- Update security_audit table policies
DROP POLICY IF EXISTS "Admins can view audit logs" ON public.security_audit;
CREATE POLICY "Admins can view audit logs" 
ON public.security_audit 
FOR SELECT 
USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id = auth.uid()) AND (profiles.group_name = ANY (ARRAY['admin'::text, 'rh'::text]))))));

-- Update logs table policies
DROP POLICY IF EXISTS "Admins can view all logs" ON public.logs;
CREATE POLICY "Admins can view all logs" 
ON public.logs 
FOR SELECT 
USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id = auth.uid()) AND (profiles.group_name = ANY (ARRAY['admin'::text, 'rh'::text]))))));

-- Update folders table policies
DROP POLICY IF EXISTS "Users can create folders in accessible folders" ON public.folders;
CREATE POLICY "Users can create folders in accessible folders" 
ON public.folders 
FOR INSERT 
WITH CHECK (((parent_id IS NULL) AND (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.user_id = auth.uid()) AND (profiles.group_name = 'admin'::text))))) OR ((parent_id IS NOT NULL) AND has_folder_permission(parent_id, 'write'::text)));