-- =====================================================
-- FIX RLS ISSUES FOR COMPANY REGISTRATION
-- =====================================================

-- 1. Add RLS policy to allow company registration without authentication
CREATE POLICY "Allow company registration during signup" 
ON public.companies 
FOR INSERT 
WITH CHECK (registration_source = 'trial_signup');

-- 2. Fix the registration function to be SECURITY DEFINER and remove auth.users reference
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
    
    -- NOTE: Email validation should be handled by Supabase Auth during user creation
    -- Removing the auth.users check as we don't have permission to access it
    
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
    
    -- 4. Log da ação (conditional on table existence)
    BEGIN
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
    EXCEPTION
        WHEN undefined_table THEN
            -- Table doesn't exist, skip logging
            NULL;
    END;
    
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Update the complete registration function to be SECURITY DEFINER
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
    
    -- Log da finalização (conditional on table existence)
    BEGIN
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
    EXCEPTION
        WHEN undefined_table THEN
            -- Table doesn't exist, skip logging
            NULL;
    END;
    
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Grant execute permissions on the functions
GRANT EXECUTE ON FUNCTION register_company_with_trial TO anon;
GRANT EXECUTE ON FUNCTION complete_company_registration TO authenticated;
GRANT EXECUTE ON FUNCTION validate_cnpj TO anon;
GRANT EXECUTE ON FUNCTION validate_cpf TO anon;
