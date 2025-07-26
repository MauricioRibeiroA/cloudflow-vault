-- Create companies table
CREATE TABLE public.companies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  domain TEXT UNIQUE,
  settings JSONB DEFAULT '{"storage_limit_gb": 10}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended'))
);

-- Enable RLS on companies
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

-- Add company_id to existing tables
ALTER TABLE public.profiles ADD COLUMN company_id UUID REFERENCES public.companies(id);
ALTER TABLE public.files ADD COLUMN company_id UUID REFERENCES public.companies(id);
ALTER TABLE public.folders ADD COLUMN company_id UUID REFERENCES public.companies(id);
ALTER TABLE public.logs ADD COLUMN company_id UUID REFERENCES public.companies(id);
ALTER TABLE public.permissions ADD COLUMN company_id UUID REFERENCES public.companies(id);
ALTER TABLE public.departments ADD COLUMN company_id UUID REFERENCES public.companies(id);
ALTER TABLE public.positions ADD COLUMN company_id UUID REFERENCES public.companies(id);
ALTER TABLE public.security_audit ADD COLUMN company_id UUID REFERENCES public.companies(id);

-- Create indexes for better performance
CREATE INDEX idx_profiles_company_id ON public.profiles(company_id);
CREATE INDEX idx_files_company_id ON public.files(company_id);
CREATE INDEX idx_folders_company_id ON public.folders(company_id);
CREATE INDEX idx_logs_company_id ON public.logs(company_id);
CREATE INDEX idx_permissions_company_id ON public.permissions(company_id);
CREATE INDEX idx_departments_company_id ON public.departments(company_id);
CREATE INDEX idx_positions_company_id ON public.positions(company_id);

-- Add trigger for companies updated_at
CREATE TRIGGER update_companies_updated_at
BEFORE UPDATE ON public.companies
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to get user's company_id
CREATE OR REPLACE FUNCTION public.get_user_company_id(user_id UUID DEFAULT auth.uid())
RETURNS UUID
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
  SELECT company_id FROM public.profiles WHERE profiles.user_id = get_user_company_id.user_id;
$$;

-- Create function to check if user is super admin
CREATE OR REPLACE FUNCTION public.is_super_admin(user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.user_id = is_super_admin.user_id 
    AND group_name = 'super_admin'
    AND status = 'active'
  );
$$;

-- Create function to check if user is company admin
CREATE OR REPLACE FUNCTION public.is_company_admin(user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.user_id = is_company_admin.user_id 
    AND group_name IN ('company_admin', 'super_admin')
    AND status = 'active'
  );
$$;

-- Update RLS policies for companies table
CREATE POLICY "Super admins can manage all companies" 
ON public.companies 
FOR ALL 
USING (is_super_admin());

CREATE POLICY "Company admins can view their company" 
ON public.companies 
FOR SELECT 
USING (id = get_user_company_id() AND is_company_admin());

-- Drop and recreate RLS policies for profiles table
DROP POLICY IF EXISTS "Admins view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users view own profile only" ON public.profiles;

CREATE POLICY "Super admins view all profiles" 
ON public.profiles 
FOR SELECT 
USING (is_super_admin());

CREATE POLICY "Company admins view company profiles" 
ON public.profiles 
FOR SELECT 
USING (company_id = get_user_company_id() AND is_company_admin());

CREATE POLICY "Users view own profile only" 
ON public.profiles 
FOR SELECT 
USING (auth.uid() = user_id);

-- Update RLS policies for files table
DROP POLICY IF EXISTS "Users can view files in accessible folders" ON public.files;
DROP POLICY IF EXISTS "Users can upload files to writable folders" ON public.files;
DROP POLICY IF EXISTS "Users can update files in writable folders" ON public.files;
DROP POLICY IF EXISTS "Users can delete files in writable folders" ON public.files;

CREATE POLICY "Users can view files in accessible folders" 
ON public.files 
FOR SELECT 
USING ((company_id = get_user_company_id() OR is_super_admin()) AND (has_folder_permission(folder_id, 'read'::text) OR (uploaded_by = auth.uid())));

CREATE POLICY "Users can upload files to writable folders" 
ON public.files 
FOR INSERT 
WITH CHECK (company_id = get_user_company_id() AND has_folder_permission(folder_id, 'write'::text));

CREATE POLICY "Users can update files in writable folders" 
ON public.files 
FOR UPDATE 
USING (company_id = get_user_company_id() AND (has_folder_permission(folder_id, 'write'::text) OR (uploaded_by = auth.uid())));

CREATE POLICY "Users can delete files in writable folders" 
ON public.files 
FOR DELETE 
USING (company_id = get_user_company_id() AND (has_folder_permission(folder_id, 'write'::text) OR (uploaded_by = auth.uid())));

-- Update RLS policies for folders table
DROP POLICY IF EXISTS "Users can view folders they have access to" ON public.folders;
DROP POLICY IF EXISTS "Users can create folders in accessible folders" ON public.folders;
DROP POLICY IF EXISTS "Users can update folders they have admin access to" ON public.folders;
DROP POLICY IF EXISTS "Users can delete folders they have admin access to" ON public.folders;

CREATE POLICY "Users can view folders they have access to" 
ON public.folders 
FOR SELECT 
USING ((company_id = get_user_company_id() OR is_super_admin()) AND (has_folder_permission(id, 'read'::text) OR (created_by = auth.uid())));

CREATE POLICY "Users can create folders in accessible folders" 
ON public.folders 
FOR INSERT 
WITH CHECK (company_id = get_user_company_id() AND (((parent_id IS NULL) AND is_company_admin()) OR ((parent_id IS NOT NULL) AND has_folder_permission(parent_id, 'write'::text))));

CREATE POLICY "Users can update folders they have admin access to" 
ON public.folders 
FOR UPDATE 
USING (company_id = get_user_company_id() AND (has_folder_permission(id, 'admin'::text) OR (created_by = auth.uid())));

CREATE POLICY "Users can delete folders they have admin access to" 
ON public.folders 
FOR DELETE 
USING (company_id = get_user_company_id() AND (has_folder_permission(id, 'admin'::text) OR (created_by = auth.uid())));

-- Update RLS policies for departments table
DROP POLICY IF EXISTS "Admin and HR can view departments" ON public.departments;
DROP POLICY IF EXISTS "Admin and HR can create departments" ON public.departments;
DROP POLICY IF EXISTS "Admin and HR can update departments" ON public.departments;
DROP POLICY IF EXISTS "Admin and HR can delete departments" ON public.departments;

CREATE POLICY "Company admins can view departments" 
ON public.departments 
FOR SELECT 
USING ((company_id = get_user_company_id() AND is_company_admin()) OR is_super_admin());

CREATE POLICY "Company admins can create departments" 
ON public.departments 
FOR INSERT 
WITH CHECK (company_id = get_user_company_id() AND is_company_admin());

CREATE POLICY "Company admins can update departments" 
ON public.departments 
FOR UPDATE 
USING ((company_id = get_user_company_id() AND is_company_admin()) OR is_super_admin());

CREATE POLICY "Company admins can delete departments" 
ON public.departments 
FOR DELETE 
USING ((company_id = get_user_company_id() AND is_company_admin()) OR is_super_admin());

-- Update RLS policies for positions table
DROP POLICY IF EXISTS "Admin and HR can view positions" ON public.positions;
DROP POLICY IF EXISTS "Admin and HR can create positions" ON public.positions;
DROP POLICY IF EXISTS "Admin and HR can update positions" ON public.positions;
DROP POLICY IF EXISTS "Admin and HR can delete positions" ON public.positions;

CREATE POLICY "Company admins can view positions" 
ON public.positions 
FOR SELECT 
USING ((company_id = get_user_company_id() AND is_company_admin()) OR is_super_admin());

CREATE POLICY "Company admins can create positions" 
ON public.positions 
FOR INSERT 
WITH CHECK (company_id = get_user_company_id() AND is_company_admin());

CREATE POLICY "Company admins can update positions" 
ON public.positions 
FOR UPDATE 
USING ((company_id = get_user_company_id() AND is_company_admin()) OR is_super_admin());

CREATE POLICY "Company admins can delete positions" 
ON public.positions 
FOR DELETE 
USING ((company_id = get_user_company_id() AND is_company_admin()) OR is_super_admin());

-- Update RLS policies for logs table
DROP POLICY IF EXISTS "Admins can view all logs" ON public.logs;
DROP POLICY IF EXISTS "Users can view their own logs" ON public.logs;

CREATE POLICY "Super admins can view all logs" 
ON public.logs 
FOR SELECT 
USING (is_super_admin());

CREATE POLICY "Company admins can view company logs" 
ON public.logs 
FOR SELECT 
USING (company_id = get_user_company_id() AND is_company_admin());

CREATE POLICY "Users can view their own logs" 
ON public.logs 
FOR SELECT 
USING (user_id = auth.uid());

-- Update RLS policies for permissions table
DROP POLICY IF EXISTS "Admins can manage all permissions" ON public.permissions;

CREATE POLICY "Super admins can manage all permissions" 
ON public.permissions 
FOR ALL 
USING (is_super_admin());

CREATE POLICY "Company admins can manage company permissions" 
ON public.permissions 
FOR ALL 
USING (company_id = get_user_company_id() AND is_company_admin());

-- Update RLS policies for security_audit table
DROP POLICY IF EXISTS "Admins can view audit logs" ON public.security_audit;

CREATE POLICY "Super admins can view all audit logs" 
ON public.security_audit 
FOR SELECT 
USING (is_super_admin());

CREATE POLICY "Company admins can view company audit logs" 
ON public.security_audit 
FOR SELECT 
USING (company_id = get_user_company_id() AND is_company_admin());

-- Update admin functions to work with companies
CREATE OR REPLACE FUNCTION public.admin_create_user(
  p_email TEXT,
  p_full_name TEXT,
  p_group_name TEXT DEFAULT 'user',
  p_company_id UUID DEFAULT NULL,
  p_department_id UUID DEFAULT NULL,
  p_position_id UUID DEFAULT NULL
)
RETURNS UUID
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
  VALUES (new_user_id, p_full_name, p_email, p_group_name, target_company_id, p_department_id, p_position_id);
  
  -- Log the action
  INSERT INTO public.security_audit (user_id, action, target_table, target_id, company_id, new_values)
  VALUES (auth.uid(), 'user_created', 'profiles', new_user_id, target_company_id,
          jsonb_build_object('email', p_email, 'group_name', p_group_name, 'company_id', target_company_id));
  
  RETURN new_user_id;
END;
$function$;