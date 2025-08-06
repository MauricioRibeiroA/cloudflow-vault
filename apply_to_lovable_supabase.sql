-- =====================================================
-- APLICAR NO SUPABASE DO LOVABLE - SQL EDITOR
-- =====================================================

-- 1. Adicionar campos extras na tabela companies para dados completos
ALTER TABLE public.companies 
ADD COLUMN IF NOT EXISTS cnpj VARCHAR(18),
ADD COLUMN IF NOT EXISTS razao_social VARCHAR(255),
ADD COLUMN IF NOT EXISTS inscricao_estadual VARCHAR(20),
ADD COLUMN IF NOT EXISTS setor VARCHAR(100),
ADD COLUMN IF NOT EXISTS porte VARCHAR(20) CHECK (porte IN ('MEI', 'MICRO', 'PEQUENA', 'MEDIA', 'GRANDE')),
ADD COLUMN IF NOT EXISTS cep VARCHAR(10),
ADD COLUMN IF NOT EXISTS logradouro VARCHAR(255),
ADD COLUMN IF NOT EXISTS numero VARCHAR(10),
ADD COLUMN IF NOT EXISTS complemento VARCHAR(100),
ADD COLUMN IF NOT EXISTS bairro VARCHAR(100),
ADD COLUMN IF NOT EXISTS cidade VARCHAR(100),
ADD COLUMN IF NOT EXISTS estado VARCHAR(2),
ADD COLUMN IF NOT EXISTS telefone VARCHAR(20),
ADD COLUMN IF NOT EXISTS is_self_registered BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS registration_source VARCHAR(20) DEFAULT 'manual' CHECK (registration_source IN ('manual', 'trial_signup', 'admin_created'));

-- 2. Adicionar campos extras na tabela profiles para dados do admin
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS cpf VARCHAR(14),
ADD COLUMN IF NOT EXISTS telefone VARCHAR(20),
ADD COLUMN IF NOT EXISTS cargo VARCHAR(100),
ADD COLUMN IF NOT EXISTS is_company_founder BOOLEAN DEFAULT false;

-- 3. Função para auto-cadastro de empresa com trial
CREATE OR REPLACE FUNCTION register_company_with_trial(
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
    new_user_id UUID;
    trial_result JSON;
    result JSON;
BEGIN
    -- Verificar se CNPJ já existe
    IF p_cnpj IS NOT NULL AND EXISTS (SELECT 1 FROM public.companies WHERE cnpj = p_cnpj) THEN
        RETURN json_build_object('success', false, 'error', 'CNPJ já cadastrado no sistema');
    END IF;
    
    -- Verificar se email já existe
    IF p_admin_email IS NOT NULL AND EXISTS (SELECT 1 FROM auth.users WHERE email = p_admin_email) THEN
        RETURN json_build_object('success', false, 'error', 'E-mail já cadastrado no sistema');
    END IF;
    
    -- Verificar se CPF já existe
    IF p_admin_cpf IS NOT NULL AND EXISTS (SELECT 1 FROM public.profiles WHERE cpf = p_admin_cpf) THEN
        RETURN json_build_object('success', false, 'error', 'CPF já cadastrado no sistema');
    END IF;
    
    -- 1. Criar empresa
    INSERT INTO public.companies (
        name, cnpj, razao_social, inscricao_estadual, setor, porte,
        cep, logradouro, numero, complemento, bairro, cidade, estado, telefone,
        is_self_registered, registration_source,
        current_storage_used_bytes, current_download_used_bytes,
        active_users_count
    ) VALUES (
        p_company_name, p_cnpj, COALESCE(p_razao_social, p_company_name), p_inscricao_estadual, p_setor, p_porte,
        p_cep, p_logradouro, p_numero, p_complemento, p_bairro, p_cidade, p_estado, p_telefone_empresa,
        true, 'trial_signup',
        0, 0, 1
    ) RETURNING id INTO new_company_id;
    
    -- 2. Criar usuário no auth (simulação - na prática será feito pelo Supabase Auth)
    -- Aqui apenas retornamos o ID da empresa para uso posterior
    
    -- 3. Iniciar trial automaticamente
    SELECT start_free_trial(new_company_id) INTO trial_result;
    
    -- 4. Log da ação
    INSERT INTO user_action_logs (
        company_id, 
        action_type, 
        details
    ) VALUES (
        new_company_id,
        'company_self_registration',
        json_build_object(
            'company_name', p_company_name,
            'cnpj', p_cnpj,
            'admin_email', p_admin_email,
            'registration_source', 'trial_signup',
            'trial_started', trial_result
        )
    );
    
    result := json_build_object(
        'success', true,
        'message', 'Empresa cadastrada com sucesso!',
        'company_id', new_company_id,
        'company_name', p_company_name,
        'trial_info', trial_result,
        'next_step', 'create_admin_user'
    );
    
    RETURN result;
    
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'success', false, 
            'error', 'Erro interno: ' || SQLERRM
        );
END;
$$ LANGUAGE plpgsql;

-- 4. Função para finalizar cadastro após criação do usuário Auth
CREATE OR REPLACE FUNCTION complete_company_registration(
    p_company_id UUID,
    p_user_id UUID,
    p_admin_name VARCHAR(255),
    p_admin_cpf VARCHAR(14),
    p_admin_telefone VARCHAR(20),
    p_admin_cargo VARCHAR(100)
)
RETURNS JSON AS $$
BEGIN
    -- Criar perfil do admin
    INSERT INTO public.profiles (
        user_id, company_id, full_name, cpf, telefone, cargo,
        group_name, is_company_founder
    ) VALUES (
        p_user_id, p_company_id, p_admin_name, p_admin_cpf, p_admin_telefone, p_admin_cargo,
        'company_admin', true
    );
    
    -- Atualizar contador de usuários ativos da empresa
    UPDATE public.companies 
    SET active_users_count = 1
    WHERE id = p_company_id;
    
    -- Log da finalização
    INSERT INTO user_action_logs (
        company_id, user_id, action_type, details
    ) VALUES (
        p_company_id, p_user_id, 'admin_profile_created',
        json_build_object(
            'admin_name', p_admin_name,
            'is_company_founder', true,
            'registration_completed', true
        )
    );
    
    RETURN json_build_object(
        'success', true,
        'message', 'Cadastro finalizado com sucesso!',
        'user_id', p_user_id,
        'company_id', p_company_id,
        'group_name', 'company_admin'
    );
    
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Erro ao finalizar cadastro: ' || SQLERRM
        );
END;
$$ LANGUAGE plpgsql;

-- 5. Função para validar CNPJ (básica)
CREATE OR REPLACE FUNCTION validate_cnpj(cnpj_input TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    -- Remove caracteres não numéricos
    cnpj_input := regexp_replace(cnpj_input, '[^0-9]', '', 'g');
    
    -- Verifica se tem 14 dígitos
    IF length(cnpj_input) != 14 THEN
        RETURN false;
    END IF;
    
    -- Verifica se não são todos iguais (11111111111111, etc.)
    IF cnpj_input ~ '^(\d)\1{13}$' THEN
        RETURN false;
    END IF;
    
    -- Aqui poderia implementar o algoritmo completo de validação do CNPJ
    -- Por simplicidade, vamos aceitar qualquer CNPJ com 14 dígitos únicos
    RETURN true;
END;
$$ LANGUAGE plpgsql;

-- 6. Função para validar CPF (básica)
CREATE OR REPLACE FUNCTION validate_cpf(cpf_input TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    -- Remove caracteres não numéricos
    cpf_input := regexp_replace(cpf_input, '[^0-9]', '', 'g');
    
    -- Verifica se tem 11 dígitos
    IF length(cpf_input) != 11 THEN
        RETURN false;
    END IF;
    
    -- Verifica se não são todos iguais
    IF cpf_input ~ '^(\d)\1{10}$' THEN
        RETURN false;
    END IF;
    
    RETURN true;
END;
$$ LANGUAGE plpgsql;

-- 7. View para empresas auto-cadastradas
CREATE OR REPLACE VIEW self_registered_companies AS
SELECT 
    c.id,
    c.name,
    c.cnpj,
    c.razao_social,
    c.cidade,
    c.estado,
    c.is_trial_active,
    c.trial_started_at,
    c.trial_ends_at,
    c.subscription_status,
    p.name as plan_name,
    c.created_at as registration_date,
    CASE 
        WHEN c.trial_ends_at < NOW() THEN true 
        ELSE false 
    END as trial_expired
FROM public.companies c
LEFT JOIN plans p ON c.plan_id = p.id
WHERE c.is_self_registered = true
ORDER BY c.created_at DESC;

-- =====================================================
-- ÍNDICES PARA PERFORMANCE
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_companies_cnpj ON public.companies(cnpj);
CREATE INDEX IF NOT EXISTS idx_companies_self_registered ON public.companies(is_self_registered);
CREATE INDEX IF NOT EXISTS idx_companies_registration_source ON public.companies(registration_source);
CREATE INDEX IF NOT EXISTS idx_profiles_cpf ON public.profiles(cpf);
CREATE INDEX IF NOT EXISTS idx_profiles_company_founder ON public.profiles(is_company_founder);

-- =====================================================
-- CONSTRAINTS ÚNICAS
-- =====================================================

ALTER TABLE public.companies ADD CONSTRAINT IF NOT EXISTS unique_cnpj UNIQUE (cnpj);
ALTER TABLE public.profiles ADD CONSTRAINT IF NOT EXISTS unique_cpf UNIQUE (cpf);

-- =====================================================
-- COMENTÁRIOS PARA DOCUMENTAÇÃO
-- =====================================================

COMMENT ON FUNCTION register_company_with_trial IS 'Registra nova empresa com trial gratuito automático';
COMMENT ON FUNCTION complete_company_registration IS 'Finaliza cadastro após criação do usuário no Auth';
COMMENT ON FUNCTION validate_cnpj(TEXT) IS 'Valida formato básico do CNPJ';
COMMENT ON FUNCTION validate_cpf(TEXT) IS 'Valida formato básico do CPF';
COMMENT ON VIEW self_registered_companies IS 'View com empresas que se auto-cadastraram para trial';
