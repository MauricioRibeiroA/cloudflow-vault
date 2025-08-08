-- =====================================================
-- FINAL SQL SCRIPT FOR LOVABLE SUPABASE
-- (Drops existing functions first)
-- =====================================================

-- Insert trial plan with only existing columns (using UUID)
INSERT INTO plans (id, name, price_brl, storage_limit_gb, download_limit_gb, max_users)
VALUES ('11111111-1111-1111-1111-111111111111'::UUID, 'Trial Gratuito', 0.00, 1, 5, 3)
ON CONFLICT (id) DO NOTHING;

-- Add missing trial columns to companies table
DO $$ 
BEGIN
    -- Add trial-related columns if they don't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'companies' AND column_name = 'is_trial_active') THEN
        ALTER TABLE public.companies ADD COLUMN is_trial_active BOOLEAN DEFAULT false;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'companies' AND column_name = 'trial_started_at') THEN
        ALTER TABLE public.companies ADD COLUMN trial_started_at TIMESTAMP WITH TIME ZONE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'companies' AND column_name = 'trial_ends_at') THEN
        ALTER TABLE public.companies ADD COLUMN trial_ends_at TIMESTAMP WITH TIME ZONE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'companies' AND column_name = 'subscription_status') THEN
        ALTER TABLE public.companies ADD COLUMN subscription_status VARCHAR(20) DEFAULT 'inactive' CHECK (subscription_status IN ('inactive', 'active', 'trialing', 'past_due', 'canceled', 'unpaid'));
    END IF;
END $$;

-- Add self-registration columns to companies table
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'companies' AND column_name = 'cnpj') THEN
        ALTER TABLE public.companies ADD COLUMN cnpj VARCHAR(18);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'companies' AND column_name = 'razao_social') THEN
        ALTER TABLE public.companies ADD COLUMN razao_social VARCHAR(255);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'companies' AND column_name = 'inscricao_estadual') THEN
        ALTER TABLE public.companies ADD COLUMN inscricao_estadual VARCHAR(20);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'companies' AND column_name = 'setor') THEN
        ALTER TABLE public.companies ADD COLUMN setor VARCHAR(100);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'companies' AND column_name = 'porte') THEN
        ALTER TABLE public.companies ADD COLUMN porte VARCHAR(20) CHECK (porte IN ('MEI', 'MICRO', 'PEQUENA', 'MEDIA', 'GRANDE'));
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'companies' AND column_name = 'cep') THEN
        ALTER TABLE public.companies ADD COLUMN cep VARCHAR(10);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'companies' AND column_name = 'logradouro') THEN
        ALTER TABLE public.companies ADD COLUMN logradouro VARCHAR(255);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'companies' AND column_name = 'numero') THEN
        ALTER TABLE public.companies ADD COLUMN numero VARCHAR(10);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'companies' AND column_name = 'complemento') THEN
        ALTER TABLE public.companies ADD COLUMN complemento VARCHAR(100);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'companies' AND column_name = 'bairro') THEN
        ALTER TABLE public.companies ADD COLUMN bairro VARCHAR(100);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'companies' AND column_name = 'cidade') THEN
        ALTER TABLE public.companies ADD COLUMN cidade VARCHAR(100);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'companies' AND column_name = 'estado') THEN
        ALTER TABLE public.companies ADD COLUMN estado VARCHAR(2);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'companies' AND column_name = 'telefone') THEN
        ALTER TABLE public.companies ADD COLUMN telefone VARCHAR(20);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'companies' AND column_name = 'is_self_registered') THEN
        ALTER TABLE public.companies ADD COLUMN is_self_registered BOOLEAN DEFAULT false;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'companies' AND column_name = 'registration_source') THEN
        ALTER TABLE public.companies ADD COLUMN registration_source VARCHAR(20) DEFAULT 'manual' CHECK (registration_source IN ('manual', 'trial_signup', 'admin_created'));
    END IF;
END $$;

-- Add self-registration columns to profiles table
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'cpf') THEN
        ALTER TABLE public.profiles ADD COLUMN cpf VARCHAR(14);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'telefone') THEN
        ALTER TABLE public.profiles ADD COLUMN telefone VARCHAR(20);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'cargo') THEN
        ALTER TABLE public.profiles ADD COLUMN cargo VARCHAR(100);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'is_company_founder') THEN
        ALTER TABLE public.profiles ADD COLUMN is_company_founder BOOLEAN DEFAULT false;
    END IF;
END $$;

-- Add unique constraints if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'unique_cnpj') THEN
        ALTER TABLE public.companies ADD CONSTRAINT unique_cnpj UNIQUE (cnpj);
    END IF;
EXCEPTION
    WHEN duplicate_table THEN NULL;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'unique_cpf') THEN
        ALTER TABLE public.profiles ADD CONSTRAINT unique_cpf UNIQUE (cpf);
    END IF;
EXCEPTION
    WHEN duplicate_table THEN NULL;
END $$;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_companies_cnpj ON public.companies(cnpj);
CREATE INDEX IF NOT EXISTS idx_companies_self_registered ON public.companies(is_self_registered);
CREATE INDEX IF NOT EXISTS idx_companies_registration_source ON public.companies(registration_source);
CREATE INDEX IF NOT EXISTS idx_profiles_cpf ON public.profiles(cpf);
CREATE INDEX IF NOT EXISTS idx_profiles_company_founder ON public.profiles(is_company_founder);

-- Add RLS policy to allow company registration without authentication
DROP POLICY IF EXISTS "Allow company registration during signup" ON public.companies;
CREATE POLICY "Allow company registration during signup" 
ON public.companies 
FOR INSERT 
WITH CHECK (registration_source = 'trial_signup');

-- Drop existing functions first to avoid parameter conflicts
DROP FUNCTION IF EXISTS start_free_trial(UUID);
DROP FUNCTION IF EXISTS register_company_with_trial;
DROP FUNCTION IF EXISTS complete_company_registration;
DROP FUNCTION IF EXISTS validate_cnpj(TEXT);
DROP FUNCTION IF EXISTS validate_cpf(TEXT);

-- Function to start free trial (using UUID)
CREATE OR REPLACE FUNCTION start_free_trial(p_company_id UUID)
RETURNS JSON AS $$
DECLARE
    trial_plan_id UUID := '11111111-1111-1111-1111-111111111111'::UUID;
    result JSON;
BEGIN
    -- Update company with trial information
    UPDATE public.companies 
    SET 
        plan_id = trial_plan_id,
        is_trial_active = true,
        trial_started_at = NOW(),
        trial_ends_at = NOW() + INTERVAL '7 days',
        subscription_status = 'trialing'
    WHERE id = p_company_id;
    
    result := json_build_object(
        'success', true,
        'message', 'Trial iniciado com sucesso!',
        'plan_id', trial_plan_id,
        'trial_started_at', NOW(),
        'trial_ends_at', NOW() + INTERVAL '7 days',
        'trial_duration_days', 7
    );
    
    RETURN result;
    
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Erro ao iniciar trial: ' || SQLERRM
        );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function for company self-registration (FIXED for RLS)
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
    trial_result JSON;
    result JSON;
BEGIN
    -- Verificar se CNPJ já existe
    IF p_cnpj IS NOT NULL AND EXISTS (SELECT 1 FROM public.companies WHERE cnpj = p_cnpj) THEN
        RETURN json_build_object('success', false, 'error', 'CNPJ já cadastrado no sistema');
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
    
    -- 2. Iniciar trial automaticamente
    SELECT start_free_trial(new_company_id) INTO trial_result;
    
    -- 3. Log da ação (conditional on table existence)
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

-- Function to complete company registration
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

-- Validation functions
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
    
    RETURN true;
END;
$$ LANGUAGE plpgsql;

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

-- Drop and recreate view for self-registered companies
DROP VIEW IF EXISTS self_registered_companies;
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

-- Grant execute permissions on the functions
GRANT EXECUTE ON FUNCTION register_company_with_trial TO anon;
GRANT EXECUTE ON FUNCTION complete_company_registration TO authenticated;
GRANT EXECUTE ON FUNCTION validate_cnpj TO anon;
GRANT EXECUTE ON FUNCTION validate_cpf TO anon;
GRANT EXECUTE ON FUNCTION start_free_trial TO anon;
