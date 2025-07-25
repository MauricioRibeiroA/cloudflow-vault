-- Corrigir search_path das funções para segurança
CREATE OR REPLACE FUNCTION public.is_admin(user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.user_id = is_admin.user_id 
    AND group_name IN ('admin', 'rh')
    AND status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION public.has_folder_permission(
  folder_id UUID, 
  required_permission TEXT DEFAULT 'read',
  user_id UUID DEFAULT auth.uid()
)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.permissions p
    JOIN public.profiles pr ON pr.user_id = p.user_id
    WHERE p.folder_id = has_folder_permission.folder_id
    AND p.user_id = has_folder_permission.user_id
    AND pr.status = 'active'
    AND (
      (required_permission = 'read' AND p.permission_type IN ('read', 'write', 'admin'))
      OR (required_permission = 'write' AND p.permission_type IN ('write', 'admin'))
      OR (required_permission = 'admin' AND p.permission_type = 'admin')
    )
  ) OR public.is_admin(has_folder_permission.user_id);
$$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;