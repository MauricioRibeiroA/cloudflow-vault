-- SCRIPT FINAL CORRIGIDO - PROBLEMA DE DUPLICATE KEY RESOLVIDO

-- REMOVER FUNÇÕES ANTIGAS
DROP FUNCTION IF EXISTS register_company_with_trial CASCADE;
DROP FUNCTION IF EXISTS complete_company_registration CASCADE;
DROP FUNCTION IF EXISTS register_company_with_trial_secure CASCADE;
DROP FUNCTION IF EXISTS complete_company_registration_secure CASCADE;

-- ADICIONAR COLUNAS PARA CONTROLE (apenas as que não existem)
ALTER TABLE public.companies 
ADD COLUMN IF NOT EXISTS founder_user_id UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS founder_email VARCHAR(255);

-- Adicionar colunas na tabela profiles (apenas as que não existem)
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS role_type VARCHAR(50) DEFAULT 'employee',
ADD COLUMN IF NOT EXISTS can_manage_users BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS cpf VARCHAR(14),
ADD COLUMN IF NOT EXISTS telefone VARCHAR(20),
ADD COLUMN IF NOT EXISTS cargo VARCHAR(100),
ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id),
ADD COLUMN IF NOT EXISTS is_company_founder BOOLEAN DEFAULT false;

-- FUNÇÃO SEGURA PARA REGISTRO (sem mudanças)
CREATE OR REPLACE FUNCTION register_company_with_trial_secure(
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
    clean_cnpj VARCHAR(18);
    clean_cpf VARCHAR(14);
BEGIN
    -- Validações
    clean_cnpj := REGEXP_REPLACE(COALESCE(p_cnpj, ''), '[^0-9]', '', 'g');
    IF LENGTH(clean_cnpj) != 14 THEN
        RETURN json_build_object('success', false, 'error', 'CNPJ inválido');
    END IF;
    
    clean_cpf := REGEXP_REPLACE(COALESCE(p_admin_cpf, ''), '[^0-9]', '', 'g');
    IF LENGTH(clean_cpf) != 11 THEN
        RETURN json_build_object('success', false, 'error', 'CPF inválido');
    END IF;
    
    -- Verificar duplicatas
    IF EXISTS (SELECT 1 FROM public.companies WHERE REGEXP_REPLACE(COALESCE(cnpj, ''), '[^0-9]', '', 'g') = clean_cnpj) THEN
        RETURN json_build_object('success', false, 'error', 'CNPJ já cadastrado');
    END IF;
    
    IF EXISTS (SELECT 1 FROM public.profiles WHERE REGEXP_REPLACE(COALESCE(cpf, ''), '[^0-9]', '', 'g') = clean_cpf) THEN
        RETURN json_build_object('success', false, 'error', 'CPF já cadastrado');
    END IF;
    
    IF EXISTS (SELECT 1 FROM public.companies WHERE founder_email = LOWER(TRIM(p_admin_email))) THEN
        RETURN json_build_object('success', false, 'error', 'Email já é admin de outra empresa');
    END IF;
    
    -- Criar empresa
    INSERT INTO public.companies (
        name, cnpj, razao_social, inscricao_estadual, setor, porte,
        cep, logradouro, numero, complemento, bairro, cidade, estado, telefone,
        is_self_registered, registration_source,
        current_storage_used_bytes, current_download_used_bytes,
        active_users_count, founder_email
    ) VALUES (
        TRIM(p_company_name), clean_cnpj, 
        COALESCE(TRIM(p_razao_social), TRIM(p_company_name)), 
        TRIM(p_inscricao_estadual), TRIM(p_setor), p_porte,
        TRIM(p_cep), TRIM(p_logradouro), TRIM(p_numero), 
        TRIM(p_complemento), TRIM(p_bairro), TRIM(p_cidade), 
        UPPER(TRIM(p_estado)), TRIM(p_telefone_empresa),
        true, 'trial_signup', 0, 0, 1, LOWER(TRIM(p_admin_email))
    ) RETURNING id INTO new_company_id;
    
    -- Iniciar trial
    SELECT start_free_trial(new_company_id) INTO trial_result;
    
    RETURN json_build_object(
        'success', true,
        'message', 'Empresa cadastrada com sucesso!',
        'company_id', new_company_id,
        'company_name', TRIM(p_company_name),
        'trial_info', trial_result
    );
    
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- FUNÇÃO CORRIGIDA PARA COMPLETAR REGISTRO (USA UPDATE EM VEZ DE INSERT)
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
    profile_exists BOOLEAN;
BEGIN
    -- Validações
    SELECT founder_email INTO company_founder_email FROM public.companies WHERE id = p_company_id;
    SELECT email INTO user_email FROM auth.users WHERE id = p_user_id;
    
    IF LOWER(TRIM(user_email)) != company_founder_email THEN
        RETURN json_build_object('success', false, 'error', 'Usuário não autorizado');
    END IF;
    
    clean_cpf := REGEXP_REPLACE(COALESCE(p_admin_cpf, ''), '[^0-9]', '', 'g');
    
    -- Verificar se já existe perfil para este usuário (criado pelo trigger)
    SELECT EXISTS(SELECT 1 FROM public.profiles WHERE user_id = p_user_id) INTO profile_exists;
    
    IF profile_exists THEN
        -- ATUALIZAR perfil existente para company_admin
        UPDATE public.profiles SET
            company_id = p_company_id,
            full_name = TRIM(p_admin_name),
            cpf = clean_cpf,
            telefone = TRIM(p_admin_telefone),
            cargo = TRIM(p_admin_cargo),
            role_type = 'company_admin',
            group_name = 'company_admin',
            is_company_founder = true,
            can_manage_users = true,
            status = 'active',
            updated_at = now()
        WHERE user_id = p_user_id;
        
        RAISE NOTICE 'Profile updated for existing user: %', p_user_id;
        
    ELSE
        -- CRIAR novo perfil (caso não exista por algum motivo)
        INSERT INTO public.profiles (
            user_id, company_id, full_name, email, cpf, telefone, cargo,
            role_type, group_name, is_company_founder, can_manage_users, status
        ) VALUES (
            p_user_id, p_company_id, TRIM(p_admin_name), user_email, clean_cpf, 
            TRIM(p_admin_telefone), TRIM(p_admin_cargo),
            'company_admin', 'company_admin', true, true, 'active'
        );
        
        RAISE NOTICE 'New profile created for user: %', p_user_id;
    END IF;
    
    -- Atualizar empresa
    UPDATE public.companies 
    SET founder_user_id = p_user_id, active_users_count = 1
    WHERE id = p_company_id;
    
    RETURN json_build_object(
        'success', true,
        'message', 'Cadastro finalizado! Você é administrador da empresa.',
        'user_id', p_user_id,
        'company_id', p_company_id,
        'role_type', 'company_admin',
        'is_company_founder', true,
        'can_manage_users', true,
        'profile_action', CASE WHEN profile_exists THEN 'updated' ELSE 'created' END
    );
    
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- FUNÇÃO PARA VERIFICAR ADMIN (sem mudanças)
CREATE OR REPLACE FUNCTION check_user_company_admin_status(p_email VARCHAR)
RETURNS JSON AS $$
DECLARE
    existing_company_id UUID;
    company_name VARCHAR;
BEGIN
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
    
    RETURN json_build_object('is_company_admin', false, 'message', 'Email disponível');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- CORRIGIR USUÁRIOS EXISTENTES (usando apenas colunas que existem)
UPDATE public.profiles 
SET role_type = 'company_admin', can_manage_users = true
WHERE group_name = 'company_admin' AND (role_type IS NULL OR role_type = 'employee');

-- POLÍTICA RLS PARA PERMITIR INSERÇÃO NA TABELA COMPANIES (remover política duplicada se existir)
DROP POLICY IF EXISTS "Allow trial signup registrations" ON public.companies;
CREATE POLICY "Allow trial signup registrations" ON public.companies
FOR INSERT TO anon
WITH CHECK (registration_source = 'trial_signup');

-- PERMISSÕES
GRANT EXECUTE ON FUNCTION register_company_with_trial_secure TO anon;
GRANT EXECUTE ON FUNCTION complete_company_registration_secure TO authenticated;
GRANT EXECUTE ON FUNCTION check_user_company_admin_status TO anon;
