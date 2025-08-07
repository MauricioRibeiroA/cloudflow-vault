-- =====================================================
-- SISTEMA DE PERMISSÕES DE ARQUIVOS POR EMPRESA/SETOR/CARGO
-- =====================================================

-- 1. TABELA DE PERMISSÕES DE ARQUIVOS
CREATE TABLE IF NOT EXISTS public.file_permissions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    file_path TEXT NOT NULL,
    folder_name TEXT, -- Nome da pasta para facilitar consultas
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    
    -- Permissões por setor/cargo (opcional - se não definido, acesso livre na empresa)
    department_id UUID REFERENCES public.departments(id) ON DELETE CASCADE,
    position_id UUID REFERENCES public.positions(id) ON DELETE CASCADE,
    
    -- Permissões por usuário específico (opcional)
    user_id UUID REFERENCES public.profiles(user_id) ON DELETE CASCADE,
    
    -- Tipo de permissão
    permission_type TEXT NOT NULL CHECK (permission_type IN ('read', 'write', 'admin')) DEFAULT 'read',
    
    -- Metadados
    created_by UUID NOT NULL REFERENCES public.profiles(user_id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    
    -- Índices únicos para evitar duplicatas
    UNIQUE(file_path, company_id, department_id, position_id, user_id, permission_type)
);

-- 2. HABILITAR RLS
ALTER TABLE public.file_permissions ENABLE ROW LEVEL SECURITY;

-- 3. POLÍTICAS RLS - Usuários só veem permissões da própria empresa
CREATE POLICY "Users can view permissions of their company" ON public.file_permissions
    FOR SELECT USING (
        company_id IN (
            SELECT p.company_id FROM public.profiles p 
            WHERE p.user_id = auth.uid()
        )
    );

-- 4. POLÍTICAS RLS - Apenas admins podem gerenciar permissões
CREATE POLICY "Company admins can manage permissions" ON public.file_permissions
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles p 
            WHERE p.user_id = auth.uid() 
            AND p.company_id = file_permissions.company_id
            AND p.group_name IN ('company_admin', 'super_admin')
        )
    );

-- 5. POLÍTICAS RLS - RH managers podem gerenciar permissões do seu setor
CREATE POLICY "RH managers can manage their department permissions" ON public.file_permissions
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles p 
            WHERE p.user_id = auth.uid() 
            AND p.company_id = file_permissions.company_id
            AND p.group_name = 'rh_manager'
            AND (p.department_id = file_permissions.department_id OR file_permissions.department_id IS NULL)
        )
    );

-- 6. FUNÇÃO PARA VERIFICAR PERMISSÃO DE ARQUIVO
CREATE OR REPLACE FUNCTION check_file_permission(
    p_file_path TEXT,
    p_user_id UUID,
    p_required_permission TEXT DEFAULT 'read'
) RETURNS BOOLEAN AS $$
DECLARE
    user_company_id UUID;
    user_department_id UUID;
    user_position_id UUID;
    user_role TEXT;
    has_permission BOOLEAN := FALSE;
BEGIN
    -- Buscar dados do usuário
    SELECT p.company_id, p.department_id, p.position_id, p.group_name
    INTO user_company_id, user_department_id, user_position_id, user_role
    FROM public.profiles p
    WHERE p.user_id = p_user_id;
    
    -- Super admin tem acesso a tudo
    IF user_role = 'super_admin' THEN
        RETURN TRUE;
    END IF;
    
    -- Company admin tem acesso total à empresa
    IF user_role = 'company_admin' THEN
        -- Verificar se o arquivo é da empresa do usuário
        SELECT EXISTS(
            SELECT 1 FROM public.file_permissions fp
            WHERE fp.file_path = p_file_path 
            AND fp.company_id = user_company_id
        ) INTO has_permission;
        
        -- Se não há permissões específicas, company_admin pode acessar
        IF NOT has_permission THEN
            RETURN TRUE;
        END IF;
        
        -- Se há permissões específicas, verificar se company_admin está incluído
        SELECT EXISTS(
            SELECT 1 FROM public.file_permissions fp
            WHERE fp.file_path = p_file_path 
            AND fp.company_id = user_company_id
            AND (
                fp.user_id = p_user_id OR
                fp.department_id IS NULL OR  -- Permissão geral da empresa
                (p_required_permission = 'read' AND fp.permission_type IN ('read', 'write', 'admin')) OR
                (p_required_permission = 'write' AND fp.permission_type IN ('write', 'admin')) OR
                (p_required_permission = 'admin' AND fp.permission_type = 'admin')
            )
        ) INTO has_permission;
        
        RETURN has_permission;
    END IF;
    
    -- Para outros usuários, verificar permissões específicas
    SELECT EXISTS(
        SELECT 1 FROM public.file_permissions fp
        WHERE fp.file_path = p_file_path 
        AND fp.company_id = user_company_id
        AND (
            fp.user_id = p_user_id OR  -- Permissão específica ao usuário
            fp.department_id = user_department_id OR  -- Permissão por setor
            fp.position_id = user_position_id  -- Permissão por cargo
        )
        AND (
            (p_required_permission = 'read' AND fp.permission_type IN ('read', 'write', 'admin')) OR
            (p_required_permission = 'write' AND fp.permission_type IN ('write', 'admin')) OR
            (p_required_permission = 'admin' AND fp.permission_type = 'admin')
        )
    ) INTO has_permission;
    
    RETURN has_permission;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. FUNÇÃO PARA DEFINIR PERMISSÕES DE PASTA
CREATE OR REPLACE FUNCTION set_folder_permissions(
    p_folder_path TEXT,
    p_folder_name TEXT,
    p_company_id UUID,
    p_permissions JSONB, -- Array de objetos {department_id?, position_id?, user_id?, permission_type}
    p_created_by UUID
) RETURNS BOOLEAN AS $$
DECLARE
    permission_item JSONB;
BEGIN
    -- Remover permissões existentes para esta pasta
    DELETE FROM public.file_permissions 
    WHERE file_path = p_folder_path AND company_id = p_company_id;
    
    -- Inserir novas permissões
    FOR permission_item IN SELECT * FROM jsonb_array_elements(p_permissions)
    LOOP
        INSERT INTO public.file_permissions (
            file_path,
            folder_name,
            company_id,
            department_id,
            position_id,
            user_id,
            permission_type,
            created_by
        ) VALUES (
            p_folder_path,
            p_folder_name,
            p_company_id,
            (permission_item->>'department_id')::UUID,
            (permission_item->>'position_id')::UUID,
            (permission_item->>'user_id')::UUID,
            COALESCE(permission_item->>'permission_type', 'read'),
            p_created_by
        );
    END LOOP;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. FUNÇÃO PARA LISTAR PERMISSÕES DE PASTA
CREATE OR REPLACE FUNCTION get_folder_permissions(
    p_folder_path TEXT,
    p_company_id UUID
) RETURNS TABLE (
    id UUID,
    department_name TEXT,
    position_name TEXT,
    user_name TEXT,
    permission_type TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        fp.id,
        d.name as department_name,
        pos.name as position_name,
        p.full_name as user_name,
        fp.permission_type
    FROM public.file_permissions fp
    LEFT JOIN public.departments d ON fp.department_id = d.id
    LEFT JOIN public.positions pos ON fp.position_id = pos.id
    LEFT JOIN public.profiles p ON fp.user_id = p.user_id
    WHERE fp.file_path = p_folder_path 
    AND fp.company_id = p_company_id
    ORDER BY d.name, pos.name, p.full_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. ÍNDICES PARA PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_file_permissions_file_path ON public.file_permissions(file_path);
CREATE INDEX IF NOT EXISTS idx_file_permissions_company_id ON public.file_permissions(company_id);
CREATE INDEX IF NOT EXISTS idx_file_permissions_department_id ON public.file_permissions(department_id);
CREATE INDEX IF NOT EXISTS idx_file_permissions_position_id ON public.file_permissions(position_id);
CREATE INDEX IF NOT EXISTS idx_file_permissions_user_id ON public.file_permissions(user_id);

-- 10. TRIGGER PARA UPDATED_AT
CREATE OR REPLACE FUNCTION update_file_permissions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER file_permissions_updated_at
    BEFORE UPDATE ON public.file_permissions
    FOR EACH ROW EXECUTE FUNCTION update_file_permissions_updated_at();

-- 11. COMENTÁRIOS PARA DOCUMENTAÇÃO
COMMENT ON TABLE public.file_permissions IS 'Sistema de controle de acesso a arquivos e pastas por empresa, setor, cargo e usuário';
COMMENT ON COLUMN public.file_permissions.file_path IS 'Caminho completo do arquivo ou pasta';
COMMENT ON COLUMN public.file_permissions.folder_name IS 'Nome da pasta para facilitar consultas e interface';
COMMENT ON COLUMN public.file_permissions.permission_type IS 'Tipo de permissão: read, write, admin';
COMMENT ON FUNCTION check_file_permission(TEXT, UUID, TEXT) IS 'Verifica se um usuário tem permissão específica para um arquivo/pasta';
COMMENT ON FUNCTION set_folder_permissions(TEXT, TEXT, UUID, JSONB, UUID) IS 'Define permissões de acesso para uma pasta';
COMMENT ON FUNCTION get_folder_permissions(TEXT, UUID) IS 'Lista as permissões de uma pasta com nomes legíveis';
