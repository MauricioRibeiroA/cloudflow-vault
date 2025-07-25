-- Criar tabela de perfis de usuário
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  group_name TEXT NOT NULL DEFAULT 'user',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar tabela de pastas
CREATE TABLE public.folders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  parent_id UUID REFERENCES public.folders(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(name, parent_id)
);

-- Criar tabela de arquivos
CREATE TABLE public.files (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  file_type TEXT NOT NULL,
  folder_id UUID REFERENCES public.folders(id) ON DELETE CASCADE,
  uploaded_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar tabela de permissões
CREATE TABLE public.permissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  folder_id UUID NOT NULL REFERENCES public.folders(id) ON DELETE CASCADE,
  permission_type TEXT NOT NULL CHECK (permission_type IN ('read', 'write', 'admin')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, folder_id)
);

-- Criar tabela de logs
CREATE TABLE public.logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL CHECK (target_type IN ('file', 'folder', 'user')),
  target_id UUID,
  target_name TEXT,
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar tabela de configurações
CREATE TABLE public.settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  value JSONB NOT NULL,
  updated_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS em todas as tabelas
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- Função para verificar se usuário é admin
CREATE OR REPLACE FUNCTION public.is_admin(user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.user_id = is_admin.user_id 
    AND group_name IN ('admin', 'rh')
    AND status = 'active'
  );
$$;

-- Função para verificar permissão em pasta
CREATE OR REPLACE FUNCTION public.has_folder_permission(
  folder_id UUID, 
  required_permission TEXT DEFAULT 'read',
  user_id UUID DEFAULT auth.uid()
)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
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

-- Políticas RLS para profiles
CREATE POLICY "Users can view their own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all profiles" ON public.profiles
  FOR SELECT USING (public.is_admin());

CREATE POLICY "Users can update their own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all profiles" ON public.profiles
  FOR ALL USING (public.is_admin());

-- Políticas RLS para folders
CREATE POLICY "Users can view folders they have access to" ON public.folders
  FOR SELECT USING (
    public.has_folder_permission(id, 'read') OR 
    created_by = auth.uid()
  );

CREATE POLICY "Users can create folders in accessible folders" ON public.folders
  FOR INSERT WITH CHECK (
    (parent_id IS NULL AND public.is_admin()) OR
    (parent_id IS NOT NULL AND public.has_folder_permission(parent_id, 'write'))
  );

CREATE POLICY "Users can update folders they have admin access to" ON public.folders
  FOR UPDATE USING (
    public.has_folder_permission(id, 'admin') OR 
    created_by = auth.uid()
  );

CREATE POLICY "Users can delete folders they have admin access to" ON public.folders
  FOR DELETE USING (
    public.has_folder_permission(id, 'admin') OR 
    created_by = auth.uid()
  );

-- Políticas RLS para files
CREATE POLICY "Users can view files in accessible folders" ON public.files
  FOR SELECT USING (
    public.has_folder_permission(folder_id, 'read') OR 
    uploaded_by = auth.uid()
  );

CREATE POLICY "Users can upload files to writable folders" ON public.files
  FOR INSERT WITH CHECK (
    public.has_folder_permission(folder_id, 'write')
  );

CREATE POLICY "Users can update files in writable folders" ON public.files
  FOR UPDATE USING (
    public.has_folder_permission(folder_id, 'write') OR 
    uploaded_by = auth.uid()
  );

CREATE POLICY "Users can delete files in writable folders" ON public.files
  FOR DELETE USING (
    public.has_folder_permission(folder_id, 'write') OR 
    uploaded_by = auth.uid()
  );

-- Políticas RLS para permissions
CREATE POLICY "Admins can manage all permissions" ON public.permissions
  FOR ALL USING (public.is_admin());

CREATE POLICY "Users can view their own permissions" ON public.permissions
  FOR SELECT USING (user_id = auth.uid());

-- Políticas RLS para logs
CREATE POLICY "Admins can view all logs" ON public.logs
  FOR SELECT USING (public.is_admin());

CREATE POLICY "Users can view their own logs" ON public.logs
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "System can insert logs" ON public.logs
  FOR INSERT WITH CHECK (true);

-- Políticas RLS para settings
CREATE POLICY "Admins can manage settings" ON public.settings
  FOR ALL USING (public.is_admin());

-- Trigger para criar perfil automaticamente
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, email, group_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'group_name', 'user')
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_folders_updated_at
  BEFORE UPDATE ON public.folders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_files_updated_at
  BEFORE UPDATE ON public.files
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_settings_updated_at
  BEFORE UPDATE ON public.settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Criar buckets de storage
INSERT INTO storage.buckets (id, name, public) VALUES ('files', 'files', false);

-- Políticas de storage
CREATE POLICY "Users can upload files to accessible folders" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'files' AND
    auth.uid() IS NOT NULL
  );

CREATE POLICY "Users can view files they have access to" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'files' AND
    auth.uid() IS NOT NULL
  );

CREATE POLICY "Users can update files they have access to" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'files' AND
    auth.uid() IS NOT NULL
  );

CREATE POLICY "Users can delete files they have access to" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'files' AND
    auth.uid() IS NOT NULL
  );

-- Inserir pastas padrão
INSERT INTO public.folders (name, parent_id, created_by) VALUES 
  ('Financeiro', NULL, (SELECT id FROM auth.users LIMIT 1)),
  ('RH', NULL, (SELECT id FROM auth.users LIMIT 1)),
  ('TI', NULL, (SELECT id FROM auth.users LIMIT 1)),
  ('Geral', NULL, (SELECT id FROM auth.users LIMIT 1))
ON CONFLICT DO NOTHING;