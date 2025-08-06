-- =====================================================
-- SISTEMA HIERÁRQUICO DE ACESSO - VERSÃO SIMPLIFICADA
-- =====================================================

-- 1. Adicionar enum para tipos de usuário mais específicos
DO $$ BEGIN
    CREATE TYPE user_role_type AS ENUM ('super_admin', 'company_admin', 'rh_manager', 'employee');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Atualizar tabela profiles para incluir novos campos PRIMEIRO
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS role_type user_role_type DEFAULT 'employee',
ADD COLUMN IF NOT EXISTS can_manage_users BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- 3. Atualizar função get_user_role (após criar a coluna)
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT AS $$
DECLARE
    user_role TEXT;
BEGIN
    SELECT COALESCE(role_type::TEXT, group_name, 'employee')
    INTO user_role
    FROM public.profiles
    WHERE user_id = auth.uid();
    
    RETURN COALESCE(user_role, 'employee');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Função para verificar se é RH manager
CREATE OR REPLACE FUNCTION public.is_rh_manager(user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.user_id = is_rh_manager.user_id 
    AND (role_type = 'rh_manager' OR group_name = 'rh')
    AND status = 'active'
  );
$$;

-- 5. Criar tabela de controle de acesso a arquivos
CREATE TABLE IF NOT EXISTS file_access_control (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    file_path TEXT NOT NULL,
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    uploaded_by UUID REFERENCES auth.users(id),
    allowed_departments UUID[] DEFAULT '{}',
    allowed_positions UUID[] DEFAULT '{}',
    allowed_users UUID[] DEFAULT '{}',
    access_type TEXT NOT NULL DEFAULT 'mixed',
    file_name TEXT NOT NULL,
    file_size_bytes BIGINT DEFAULT 0,
    content_type TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Criar tabela de logs de ações
CREATE TABLE IF NOT EXISTS user_action_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id UUID NOT NULL REFERENCES public.companies(id),
    user_id UUID NOT NULL REFERENCES auth.users(id),
    action_type TEXT NOT NULL,
    target_path TEXT,
    target_user_id UUID REFERENCES auth.users(id),
    details JSONB DEFAULT '{}',
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. Criar índices
CREATE INDEX IF NOT EXISTS idx_profiles_role_type ON public.profiles(role_type);
CREATE INDEX IF NOT EXISTS idx_file_access_control_company_id ON file_access_control(company_id);
CREATE INDEX IF NOT EXISTS idx_file_access_control_file_path ON file_access_control(file_path);
CREATE INDEX IF NOT EXISTS idx_file_access_control_uploaded_by ON file_access_control(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_user_action_logs_company_id ON user_action_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_user_action_logs_user_id ON user_action_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_user_action_logs_created_at ON user_action_logs(created_at);

-- 8. Habilitar RLS
ALTER TABLE file_access_control ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_action_logs ENABLE ROW LEVEL SECURITY;

-- 9. Políticas RLS básicas
CREATE POLICY "File access readable by company" ON file_access_control
FOR SELECT USING (
    company_id = public.get_user_company_id()
    OR public.is_super_admin()
);

CREATE POLICY "File access manageable by owner and admins" ON file_access_control
FOR ALL USING (
    uploaded_by = auth.uid()
    OR (company_id = public.get_user_company_id() AND public.is_company_admin())
    OR public.is_super_admin()
);

CREATE POLICY "Action logs readable by admins" ON user_action_logs
FOR SELECT USING (
    (company_id = public.get_user_company_id() AND public.is_company_admin())
    OR public.is_super_admin()
    OR user_id = auth.uid()
);

-- 10. Funções principais para controle de acesso
CREATE OR REPLACE FUNCTION user_can_access_file(
    user_uuid UUID, 
    file_path_param TEXT
)
RETURNS JSON AS $$
DECLARE
    user_profile RECORD;
    file_access RECORD;
    has_access BOOLEAN DEFAULT false;
    access_reason TEXT DEFAULT '';
BEGIN
    -- Buscar dados do usuário
    SELECT p.*, c.id as company_id
    INTO user_profile
    FROM public.profiles p
    JOIN public.companies c ON p.company_id = c.id
    WHERE p.user_id = user_uuid;
    
    IF NOT FOUND THEN
        RETURN json_build_object('has_access', false, 'reason', 'User not found');
    END IF;
    
    -- Super admin tem acesso a tudo
    IF user_profile.role_type = 'super_admin' OR user_profile.group_name = 'super_admin' THEN
        RETURN json_build_object('has_access', true, 'reason', 'super_admin');
    END IF;
    
    -- Buscar controle de acesso do arquivo
    SELECT * INTO file_access
    FROM file_access_control
    WHERE file_path = file_path_param AND company_id = user_profile.company_id;
    
    IF NOT FOUND THEN
        -- Se não há controle específico, apenas company_admin pode acessar
        IF user_profile.role_type = 'company_admin' OR user_profile.group_name = 'company_admin' THEN
            has_access := true;
            access_reason := 'company_admin';
        END IF;
    ELSE
        -- Company admin sempre tem acesso
        IF user_profile.role_type = 'company_admin' OR user_profile.group_name = 'company_admin' THEN
            has_access := true;
            access_reason := 'company_admin';
        -- Verificar se é o dono do arquivo
        ELSIF user_uuid = file_access.uploaded_by THEN
            has_access := true;
            access_reason := 'file_owner';
        -- Verificar se está na lista de usuários permitidos
        ELSIF user_uuid = ANY(file_access.allowed_users) THEN
            has_access := true;
            access_reason := 'specific_user_access';
        -- Verificar acesso por departamento
        ELSIF user_profile.department_id IS NOT NULL 
              AND user_profile.department_id = ANY(file_access.allowed_departments) THEN
            has_access := true;
            access_reason := 'department_access';
        -- Verificar acesso por cargo
        ELSIF user_profile.position_id IS NOT NULL 
              AND user_profile.position_id = ANY(file_access.allowed_positions) THEN
            has_access := true;
            access_reason := 'position_access';
        -- Arquivo compartilhado da empresa
        ELSIF file_access.access_type = 'shared' THEN
            has_access := true;
            access_reason := 'company_shared';
        END IF;
    END IF;
    
    RETURN json_build_object(
        'has_access', has_access,
        'reason', access_reason,
        'user_role', COALESCE(user_profile.role_type::TEXT, user_profile.group_name),
        'user_department', user_profile.department_id,
        'user_position', user_profile.position_id
    );
END;
$$ LANGUAGE plpgsql;

-- 11. Função para registrar upload
CREATE OR REPLACE FUNCTION register_file_upload(
    file_path_param TEXT,
    file_name_param TEXT,
    file_size_param BIGINT,
    content_type_param TEXT,
    uploaded_by_uuid UUID,
    allowed_departments_param UUID[] DEFAULT '{}',
    allowed_positions_param UUID[] DEFAULT '{}',
    allowed_users_param UUID[] DEFAULT '{}',
    access_type_param TEXT DEFAULT 'mixed'
)
RETURNS JSON AS $$
DECLARE
    user_company_id UUID;
    file_id UUID;
BEGIN
    -- Buscar company_id do usuário
    SELECT company_id INTO user_company_id
    FROM public.profiles WHERE user_id = uploaded_by_uuid;
    
    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'error', 'User not found');
    END IF;
    
    -- Inserir registro de controle de acesso
    INSERT INTO file_access_control (
        file_path, company_id, uploaded_by, allowed_departments,
        allowed_positions, allowed_users, access_type,
        file_name, file_size_bytes, content_type
    ) VALUES (
        file_path_param, user_company_id, uploaded_by_uuid, allowed_departments_param,
        allowed_positions_param, allowed_users_param, access_type_param,
        file_name_param, file_size_param, content_type_param
    ) RETURNING id INTO file_id;
    
    -- Log da ação
    INSERT INTO user_action_logs (company_id, user_id, action_type, target_path, details)
    VALUES (user_company_id, uploaded_by_uuid, 'upload', file_path_param,
            json_build_object('file_name', file_name_param, 'file_size', file_size_param));
    
    RETURN json_build_object('success', true, 'file_id', file_id, 'company_id', user_company_id);
END;
$$ LANGUAGE plpgsql;

-- 12. Trigger para updated_at
CREATE TRIGGER update_file_access_control_updated_at 
BEFORE UPDATE ON file_access_control
FOR EACH ROW 
EXECUTE FUNCTION update_updated_at_column();

-- 13. Atualizar constraint de group_name
DO $$ 
BEGIN
    ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS check_valid_group_name;
    ALTER TABLE public.profiles ADD CONSTRAINT check_valid_group_name 
    CHECK (group_name IN ('super_admin', 'company_admin', 'rh', 'rh_manager', 'user', 'employee'));
END $$;

-- 14. Função para criar departamentos padrão
CREATE OR REPLACE FUNCTION create_default_departments_for_company(company_uuid UUID)
RETURNS JSON AS $$
DECLARE
    dept_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO dept_count FROM departments WHERE company_id = company_uuid;
    
    IF dept_count = 0 THEN
        INSERT INTO departments (company_id, name, description) VALUES
        (company_uuid, 'Administração', 'Departamento administrativo geral'),
        (company_uuid, 'Recursos Humanos', 'Gestão de pessoas e processos de RH'),
        (company_uuid, 'Financeiro', 'Controle financeiro e contabilidade'),
        (company_uuid, 'Comercial', 'Vendas e relacionamento com clientes');
        
        INSERT INTO positions (company_id, name, description, hierarchy_level) VALUES
        (company_uuid, 'Diretor', 'Diretor executivo', 5),
        (company_uuid, 'Gerente', 'Gerente de departamento', 4),
        (company_uuid, 'Coordenador', 'Coordenador de equipe', 3),
        (company_uuid, 'Analista', 'Analista especializado', 2),
        (company_uuid, 'Assistente', 'Assistente operacional', 1),
        (company_uuid, 'Estagiário', 'Estagiário de nível superior', 1);
    END IF;
    
    RETURN json_build_object('success', true, 'departments_created', dept_count = 0);
END;
$$ LANGUAGE plpgsql;

-- Comentários finais
COMMENT ON TABLE file_access_control IS 'Controle de acesso detalhado aos arquivos por departamento, cargo e usuário';
COMMENT ON TABLE user_action_logs IS 'Log de todas as ações dos usuários para auditoria';
COMMENT ON FUNCTION user_can_access_file(UUID, TEXT) IS 'Verifica se usuário tem permissão para acessar arquivo específico';
COMMENT ON FUNCTION register_file_upload(TEXT, TEXT, BIGINT, TEXT, UUID, UUID[], UUID[], UUID[], TEXT) IS 'Registra upload de arquivo com controle de acesso';
