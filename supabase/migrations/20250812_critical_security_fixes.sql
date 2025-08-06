-- =====================================================
-- CORREÇÕES CRÍTICAS DE SEGURANÇA - REGISTRO DE EMPRESAS
-- =====================================================

-- 1. ADICIONAR CONSTRAINT ÚNICA PARA CNPJ (proteção contra empresa duplicada)
-- Remove duplicates primeiro se existirem
DELETE FROM public.companies 
WHERE id NOT IN (
    SELECT MIN(id) 
    FROM public.companies 
    GROUP BY cnpj 
    HAVING cnpj IS NOT NULL
);

-- Adiciona constraint única no CNPJ
ALTER TABLE public.companies 
ADD CONSTRAINT companies_cnpj_unique 
UNIQUE (cnpj);

-- 2. ADICIONAR CONSTRAINT ÚNICA PARA CPF (proteção contra admin duplicado)
-- Remove duplicates primeiro se existirem
DELETE FROM public.profiles 
WHERE user_id NOT IN (
    SELECT MIN(user_id) 
    FROM public.profiles 
    GROUP BY cpf 
    HAVING cpf IS NOT NULL
);

-- Adiciona constraint única no CPF
ALTER TABLE public.profiles 
ADD CONSTRAINT profiles_cpf_unique 
UNIQUE (cpf);

-- 3. ADICIONAR COLUNA PARA CONTROLAR ADMIN ÚNICO POR EMPRESA
ALTER TABLE public.companies 
ADD COLUMN IF NOT EXISTS founder_user_id UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS founder_email VARCHAR(255);

-- 4. FUNÇÃO SEGURA PARA REGISTRO COM VALIDAÇÕES ROBUSTAS
CREATE OR REPLACE FUNCTION register_company_with_trial_secure(
    -- Dados da empresa
    p_company_name VARCHAR(255),
    p_cnpj VARCHAR(18),
    p_razao_social VARCHAR(255) DEFAULT NULL,
    p_inscricao_estadual VARCHAR(20) DEFAULT NULL,
    p_setor VARCHAR(100) DEFAULT NULL,
    p_porte VARCHAR(20) DEFAULT 'MICRO',
    p_cep VARCHAR(10) DEFAULT NULL,
    p_logradouro VARCHAR(255) DEFAULT NULL,
    p_numero VARCHAR(10) DEFAULT NULL,
    p_complemento VARCHAR(100) DEFAULT NULL,
    p_bairro VARCHAR(100) DEFAULT NULL,
    p_cidade VARCHAR(100) DEFAULT NULL,
    p_estado VARCHAR(2) DEFAULT NULL,
    p_telefone_empresa VARCHAR(20) DEFAULT NULL,
    
    -- Dados do admin
    p_admin_name VARCHAR(255) DEFAULT NULL,
    p_admin_email VARCHAR(255) DEFAULT NULL,
    p_admin_cpf VARCHAR(14) DEFAULT NULL,
    p_admin_telefone VARCHAR(20) DEFAULT NULL,
    p_admin_cargo VARCHAR(100) DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
    new_company_id UUID;
    trial_result JSON;
    result JSON;
    clean_cnpj VARCHAR(18);
    clean_cpf VARCHAR(14);
BEGIN
    -- Limpar e validar CNPJ
    clean_cnpj := REGEXP_REPLACE(COALESCE(p_cnpj, ''), '[^0-9]', '', 'g');
    IF LENGTH(clean_cnpj) != 14 THEN
        RETURN json_build_object('success', false, 'error', 'CNPJ deve ter exatamente 14 dígitos numéricos');
    END IF;
    
    -- Limpar e validar CPF
    clean_cpf := REGEXP_REPLACE(COALESCE(p_admin_cpf, ''), '[^0-9]', '', 'g');
    IF LENGTH(clean_cpf) != 11 THEN
        RETURN json_build_object('success', false, 'error', 'CPF deve ter exatamente 11 dígitos numéricos');
    END IF;
    
    -- Validar email
    IF p_admin_email IS NULL OR p_admin_email !~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' THEN
        RETURN json_build_object('success', false, 'error', 'Email inválido');
    END IF;
    
    -- Validar nome da empresa
    IF LENGTH(TRIM(COALESCE(p_company_name, ''))) < 3 THEN
        RETURN json_build_object('success', false, 'error', 'Nome da empresa deve ter pelo menos 3 caracteres');
    END IF;
    
    -- PROTEÇÃO 1: Verificar se CNPJ já existe (com ANY para buscar em arrays também)
    IF EXISTS (
        SELECT 1 FROM public.companies 
        WHERE cnpj = p_cnpj 
        OR cnpj = clean_cnpj
        OR REGEXP_REPLACE(cnpj, '[^0-9]', '', 'g') = clean_cnpj
    ) THEN
        RETURN json_build_object(
            'success', false, 
            'error', 'CNPJ já cadastrado no sistema. Uma empresa com este CNPJ já possui cadastro.',
            'error_code', 'CNPJ_ALREADY_EXISTS'
        );
    END IF;
    
    -- PROTEÇÃO 2: Verificar se CPF já existe
    IF EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE cpf = p_admin_cpf 
        OR cpf = clean_cpf
        OR REGEXP_REPLACE(cpf, '[^0-9]', '', 'g') = clean_cpf
    ) THEN
        RETURN json_build_object(
            'success', false, 
            'error', 'CPF já cadastrado no sistema. Este CPF já está associado a outra conta.',
            'error_code', 'CPF_ALREADY_EXISTS'
        );
    END IF;
    
    -- PROTEÇÃO 3: Verificar se email já tem empresa associada
    -- Buscar por email em founder_email para evitar múltiplos admins
    IF EXISTS (
        SELECT 1 FROM public.companies 
        WHERE founder_email = LOWER(TRIM(p_admin_email))
    ) THEN
        RETURN json_build_object(
            'success', false, 
            'error', 'Este email já é administrador de outra empresa. Use um email diferente.',
            'error_code', 'EMAIL_ALREADY_FOUNDER'
        );
    END IF;
    
    -- PROTEÇÃO 4: Prevenir SQL Injection adicional
    -- Validar caracteres especiais nos campos texto
    IF p_company_name ~ '[<>"\'';&|]' OR p_admin_name ~ '[<>"\'';&|]' THEN
        RETURN json_build_object('success', false, 'error', 'Caracteres especiais não permitidos nos nomes');
    END IF;
    
    -- Criar empresa com dados sanitizados
    INSERT INTO public.companies (
        name, cnpj, razao_social, inscricao_estadual, setor, porte,
        cep, logradouro, numero, complemento, bairro, cidade, estado, telefone,
        is_self_registered, registration_source,
        current_storage_used_bytes, current_download_used_bytes,
        active_users_count, founder_email
    ) VALUES (
        TRIM(p_company_name), 
        clean_cnpj, 
        COALESCE(TRIM(p_razao_social), TRIM(p_company_name)), 
        TRIM(p_inscricao_estadual), 
        TRIM(p_setor), 
        p_porte,
        TRIM(p_cep), 
        TRIM(p_logradouro), 
        TRIM(p_numero), 
        TRIM(p_complemento), 
        TRIM(p_bairro), 
        TRIM(p_cidade), 
        UPPER(TRIM(p_estado)), 
        TRIM(p_telefone_empresa),
        true, 
        'trial_signup',
        0, 
        0, 
        1, 
        LOWER(TRIM(p_admin_email))
    ) RETURNING id INTO new_company_id;
    
    -- Iniciar trial automaticamente
    SELECT start_free_trial(new_company_id) INTO trial_result;
    
    -- Log da ação (conditional)
    BEGIN
        INSERT INTO user_action_logs (
            company_id, 
            action_type, 
            details
        ) VALUES (
            new_company_id,
            'company_self_registration_secure',
            json_build_object(
                'company_name', TRIM(p_company_name),
                'cnpj', clean_cnpj,
                'admin_email', LOWER(TRIM(p_admin_email)),
                'registration_source', 'trial_signup',
                'trial_started', trial_result,
                'security_level', 'enhanced'
            )
        );
    EXCEPTION
        WHEN undefined_table THEN
            NULL;
    END;
    
    result := json_build_object(
        'success', true,
        'message', 'Empresa cadastrada com sucesso! Agora crie sua conta de usuário.',
        'company_id', new_company_id,
        'company_name', TRIM(p_company_name),
        'trial_info', trial_result,
        'next_step', 'create_admin_user_account'
    );
    
    RETURN result;
    
EXCEPTION
    WHEN unique_violation THEN
        -- Tratamento específico para violações de constraint
        IF SQLERRM LIKE '%cnpj%' THEN
            RETURN json_build_object('success', false, 'error', 'CNPJ já cadastrado no sistema');
        ELSIF SQLERRM LIKE '%cpf%' THEN
            RETURN json_build_object('success', false, 'error', 'CPF já cadastrado no sistema');
        ELSE
            RETURN json_build_object('success', false, 'error', 'Dados já existentes no sistema');
        END IF;
    WHEN OTHERS THEN
        RETURN json_build_object(
            'success', false, 
            'error', 'Erro interno do sistema. Tente novamente.',
            'technical_error', SQLERRM
        );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. FUNÇÃO SEGURA PARA COMPLETAR REGISTRO - GARANTIR COMPANY_ADMIN
CREATE OR REPLACE FUNCTION complete_company_registration_secure(
    p_company_id UUID,
    p_user_id UUID,
    p_admin_name VARCHAR(255),
    p_admin_cpf VARCHAR(14),
    p_admin_telefone VARCHAR(20),
    p_admin_cargo VARCHAR(100)
)
RETURNS JSON AS $$
DECLARE
    company_founder_email VARCHAR(255);
    user_email VARCHAR(255);
    clean_cpf VARCHAR(14);
BEGIN
    -- Validações de entrada
    IF p_company_id IS NULL OR p_user_id IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'IDs obrigatórios não fornecidos');
    END IF;
    
    -- Limpar CPF
    clean_cpf := REGEXP_REPLACE(COALESCE(p_admin_cpf, ''), '[^0-9]', '', 'g');
    
    -- PROTEÇÃO: Verificar se a empresa existe e pegar email do fundador
    SELECT founder_email INTO company_founder_email
    FROM public.companies 
    WHERE id = p_company_id;
    
    IF company_founder_email IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Empresa não encontrada ou não autorizada');
    END IF;
    
    -- PROTEÇÃO: Verificar se o usuário atual é o mesmo que registrou a empresa
    -- Buscar email do usuário autenticado (simulação - na prática vem do auth)
    SELECT email INTO user_email 
    FROM auth.users 
    WHERE id = p_user_id;
    
    IF LOWER(TRIM(user_email)) != company_founder_email THEN
        RETURN json_build_object(
            'success', false, 
            'error', 'Usuário não autorizado. Apenas o fundador da empresa pode completar este cadastro.',
            'error_code', 'UNAUTHORIZED_USER'
        );
    END IF;
    
    -- Verificar se perfil já existe para evitar duplicação
    IF EXISTS (SELECT 1 FROM public.profiles WHERE user_id = p_user_id) THEN
        RETURN json_build_object('success', false, 'error', 'Perfil já existe para este usuário');
    END IF;
    
    -- Criar perfil do admin com ROLE CORRETO
    INSERT INTO public.profiles (
        user_id, 
        company_id, 
        full_name, 
        cpf, 
        telefone, 
        cargo,
        role_type,        -- ADICIONADO: Definir role explicitamente
        group_name,       -- MANTIDO para compatibilidade
        is_company_founder,
        is_active,
        can_manage_users  -- ADICIONADO: Permitir gerenciar usuários
    ) VALUES (
        p_user_id, 
        p_company_id, 
        TRIM(p_admin_name), 
        clean_cpf, 
        TRIM(p_admin_telefone), 
        TRIM(p_admin_cargo),
        'company_admin',  -- CORREÇÃO CRÍTICA: Role correto
        'company_admin',  -- Group name
        true,             -- É fundador da empresa
        true,             -- Ativo
        true              -- Pode gerenciar usuários
    );
    
    -- Atualizar empresa com referência ao fundador
    UPDATE public.companies 
    SET founder_user_id = p_user_id,
        active_users_count = 1
    WHERE id = p_company_id;
    
    -- Log da finalização
    BEGIN
        INSERT INTO user_action_logs (
            company_id, user_id, action_type, details
        ) VALUES (
            p_company_id, p_user_id, 'admin_profile_created_secure',
            json_build_object(
                'admin_name', TRIM(p_admin_name),
                'is_company_founder', true,
                'role_type', 'company_admin',
                'can_manage_users', true,
                'registration_completed', true,
                'security_level', 'enhanced'
            )
        );
    EXCEPTION
        WHEN undefined_table THEN
            NULL;
    END;
    
    RETURN json_build_object(
        'success', true,
        'message', 'Cadastro finalizado com sucesso! Você é agora o administrador da empresa.',
        'user_id', p_user_id,
        'company_id', p_company_id,
        'role_type', 'company_admin',
        'is_company_founder', true,
        'can_manage_users', true
    );
    
EXCEPTION
    WHEN unique_violation THEN
        RETURN json_build_object('success', false, 'error', 'CPF já cadastrado no sistema');
    WHEN OTHERS THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Erro ao finalizar cadastro: ' || SQLERRM
        );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. FUNÇÃO PARA VERIFICAR SE UM USUÁRIO JÁ É ADMIN DE EMPRESA
CREATE OR REPLACE FUNCTION check_user_company_admin_status(p_email VARCHAR)
RETURNS JSON AS $$
DECLARE
    existing_company_id UUID;
    company_name VARCHAR;
BEGIN
    -- Verificar se o email já é fundador de alguma empresa
    SELECT c.id, c.name INTO existing_company_id, company_name
    FROM public.companies c
    WHERE c.founder_email = LOWER(TRIM(p_email));
    
    IF existing_company_id IS NOT NULL THEN
        RETURN json_build_object(
            'is_company_admin', true,
            'company_id', existing_company_id,
            'company_name', company_name,
            'message', 'Este email já é administrador da empresa: ' || company_name
        );
    END IF;
    
    -- Verificar se é admin por perfil também
    SELECT p.company_id, c.name INTO existing_company_id, company_name
    FROM public.profiles p
    JOIN public.companies c ON c.id = p.company_id
    JOIN auth.users u ON u.id = p.user_id
    WHERE LOWER(u.email) = LOWER(TRIM(p_email))
    AND (p.role_type = 'company_admin' OR p.is_company_founder = true);
    
    IF existing_company_id IS NOT NULL THEN
        RETURN json_build_object(
            'is_company_admin', true,
            'company_id', existing_company_id,
            'company_name', company_name,
            'message', 'Este email já é administrador da empresa: ' || company_name
        );
    END IF;
    
    RETURN json_build_object(
        'is_company_admin', false,
        'message', 'Email disponível para registro'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. RLS POLICIES ATUALIZADAS
DROP POLICY IF EXISTS "Allow company registration during signup" ON public.companies;

CREATE POLICY "Allow secure company registration" 
ON public.companies 
FOR INSERT 
WITH CHECK (
    registration_source = 'trial_signup' 
    AND founder_email IS NOT NULL
    AND LENGTH(TRIM(name)) >= 3
);

-- 8. ÍNDICES PARA PERFORMANCE E SEGURANÇA
CREATE INDEX IF NOT EXISTS idx_companies_founder_email ON public.companies(founder_email);
CREATE INDEX IF NOT EXISTS idx_companies_cnpj_clean ON public.companies(REGEXP_REPLACE(cnpj, '[^0-9]', '', 'g'));
CREATE INDEX IF NOT EXISTS idx_profiles_cpf_clean ON public.profiles(REGEXP_REPLACE(cpf, '[^0-9]', '', 'g'));
CREATE INDEX IF NOT EXISTS idx_profiles_role_company ON public.profiles(role_type, company_id) WHERE role_type = 'company_admin';

-- 9. GRANT PERMISSIONS
GRANT EXECUTE ON FUNCTION register_company_with_trial_secure TO anon;
GRANT EXECUTE ON FUNCTION complete_company_registration_secure TO authenticated;
GRANT EXECUTE ON FUNCTION check_user_company_admin_status TO anon;

-- 10. TRIGGER PARA AUDIT LOG DE TENTATIVAS DE REGISTRO DUPLICADO
CREATE OR REPLACE FUNCTION log_failed_registration_attempts()
RETURNS TRIGGER AS $$
BEGIN
    -- Log tentativas de violação de constraints críticas
    IF TG_OP = 'INSERT' AND (
        NEW.cnpj IN (SELECT cnpj FROM public.companies WHERE id != NEW.id) OR
        NEW.founder_email IN (SELECT founder_email FROM public.companies WHERE id != NEW.id)
    ) THEN
        INSERT INTO user_action_logs (
            company_id, action_type, details, created_at
        ) VALUES (
            NEW.id,
            'duplicate_registration_attempt',
            json_build_object(
                'attempted_cnpj', NEW.cnpj,
                'attempted_email', NEW.founder_email,
                'ip_address', inet_client_addr(),
                'timestamp', NOW()
            ),
            NOW()
        );
    END IF;
    
    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        -- Se falhar o log, não impedir a operação principal
        RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar trigger apenas se a tabela de logs existir
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_action_logs') THEN
        DROP TRIGGER IF EXISTS tr_log_failed_registrations ON public.companies;
        CREATE TRIGGER tr_log_failed_registrations
            BEFORE INSERT ON public.companies
            FOR EACH ROW
            EXECUTE FUNCTION log_failed_registration_attempts();
    END IF;
END $$;
