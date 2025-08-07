-- =====================================================
-- FIX COMPLETO: TRIAL + CRIAÇÃO DE USUÁRIOS + PLANOS
-- Execute este SQL inteiro no editor SQL do Supabase
-- =====================================================

-- ===== 1. ADICIONAR COLUNAS DE TRIAL NA TABELA COMPANIES SE NÃO EXISTIREM =====

-- Adicionar colunas relacionadas ao trial na tabela companies
ALTER TABLE public.companies 
ADD COLUMN IF NOT EXISTS trial_started_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS is_trial_active BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS trial_used BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'inactive';

-- Adicionar constraint se não existir
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'companies_subscription_status_check') THEN
        ALTER TABLE public.companies ADD CONSTRAINT companies_subscription_status_check 
        CHECK (subscription_status IN ('inactive', 'trial', 'active', 'cancelled', 'expired'));
    END IF;
END $$;

-- ===== 2. CORRIGIR PLANOS (REMOVER DUPLICATAS) =====

-- Deletar todos os planos trial duplicados
DELETE FROM public.plans WHERE name = 'Trial';

-- Inserir APENAS UM plano trial correto
INSERT INTO public.plans (name, price_brl, storage_limit_gb, download_limit_gb, max_users) 
VALUES (
  'Trial', 
  0.00, 
  50, 
  15, 
  3
) ON CONFLICT DO NOTHING;

-- ===== 3. CORRIGIR CONSTRAINT DE STATUS =====

-- Drop das constraints antigas
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS check_valid_status;
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_status_check;

-- Adicionar nova constraint com todos os status válidos
ALTER TABLE public.profiles ADD CONSTRAINT profiles_status_check 
CHECK (status IN ('active', 'inactive', 'suspended', 'pending_activation'));

-- Atualizar constraint de group_name também
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS check_valid_group_name;
ALTER TABLE public.profiles ADD CONSTRAINT check_valid_group_name 
CHECK (group_name IN ('admin', 'rh', 'user', 'super_admin', 'company_admin', 'hr'));

-- ===== 4. CORRIGIR FUNÇÃO DE REGISTRO DE EMPRESA COM TRIAL AUTOMÁTICO =====

CREATE OR REPLACE FUNCTION public.register_company_with_trial_secure(
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
    trial_plan_id UUID;
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
    
    -- Buscar ID do plano Trial
    SELECT id INTO trial_plan_id FROM public.plans WHERE name = 'Trial' LIMIT 1;
    
    IF trial_plan_id IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Plano Trial não encontrado');
    END IF;
    
    -- 1. Criar empresa JÁ COM PLANO TRIAL ATIVO
    INSERT INTO public.companies (
        name, cnpj, razao_social, inscricao_estadual, setor, porte,
        cep, logradouro, numero, complemento, bairro, cidade, estado, telefone,
        is_self_registered, registration_source,
        current_storage_used_bytes, current_download_used_bytes,
        active_users_count,
        -- TRIAL ATIVO IMEDIATAMENTE
        plan_id,
        trial_started_at,
        trial_ends_at,
        is_trial_active,
        trial_used,
        subscription_status,
        download_reset_date
    ) VALUES (
        p_company_name, p_cnpj, COALESCE(p_razao_social, p_company_name), p_inscricao_estadual, p_setor, p_porte,
        p_cep, p_logradouro, p_numero, p_complemento, p_bairro, p_cidade, p_estado, p_telefone_empresa,
        true, 'trial_signup',
        0, 0, 1,
        -- TRIAL ATIVO
        trial_plan_id,
        NOW(),
        NOW() + INTERVAL '7 days',
        true,
        true,
        'trial',
        DATE_TRUNC('month', NOW())::DATE
    ) RETURNING id INTO new_company_id;
    
    -- 2. Log da ação (conditional on table existence)
    BEGIN
        INSERT INTO public.user_action_logs (
            company_id, 
            action_type, 
            details
        ) VALUES (
            new_company_id,
            'company_trial_registration',
            json_build_object(
                'company_name', p_company_name,
                'cnpj', p_cnpj,
                'admin_email', p_admin_email,
                'registration_source', 'trial_signup',
                'trial_started', true,
                'trial_ends_at', NOW() + INTERVAL '7 days'
            )
        );
    EXCEPTION
        WHEN undefined_table THEN
            -- Table doesn't exist, skip logging
            NULL;
    END;
    
    result := json_build_object(
        'success', true,
        'message', 'Empresa cadastrada com sucesso e trial iniciado!',
        'company_id', new_company_id,
        'company_name', p_company_name,
        'trial_active', true,
        'trial_ends_at', NOW() + INTERVAL '7 days',
        'plan_name', 'Trial',
        'storage_limit_gb', 50,
        'download_limit_gb', 15,
        'max_users', 3,
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

-- ===== 5. CORRIGIR FUNÇÃO DE FINALIZAÇÃO DO CADASTRO =====

CREATE OR REPLACE FUNCTION public.complete_company_registration_secure(
    p_company_id UUID,
    p_user_id UUID,
    p_admin_name VARCHAR(255),
    p_admin_cpf VARCHAR(14),
    p_admin_telefone VARCHAR(20),
    p_admin_cargo VARCHAR(100)
)
RETURNS JSON AS $$
DECLARE
    company_exists BOOLEAN;
    user_exists BOOLEAN;
BEGIN
    -- Verificar se empresa existe
    SELECT EXISTS(SELECT 1 FROM public.companies WHERE id = p_company_id) INTO company_exists;
    IF NOT company_exists THEN
        RETURN json_build_object('success', false, 'error', 'Empresa não encontrada');
    END IF;
    
    -- Verificar se user_id existe na auth.users (se necessário)
    -- NOTE: Como não podemos acessar auth.users diretamente, vamos assumir que o user_id é válido
    
    -- Criar perfil do admin com referência válida ao auth.users
    INSERT INTO public.profiles (
        user_id, 
        company_id, 
        full_name, 
        email,
        cpf, 
        telefone, 
        cargo,
        group_name, 
        status,
        is_company_founder
    ) VALUES (
        p_user_id, 
        p_company_id, 
        p_admin_name, 
        (SELECT email FROM auth.users WHERE id = p_user_id),
        p_admin_cpf, 
        p_admin_telefone, 
        p_admin_cargo,
        'company_admin', 
        'active',
        true
    );
    
    -- Atualizar contador de usuários ativos da empresa
    UPDATE public.companies 
    SET active_users_count = 1
    WHERE id = p_company_id;
    
    -- Log da finalização (conditional on table existence)
    BEGIN
        INSERT INTO public.user_action_logs (
            company_id, user_id, action_type, details
        ) VALUES (
            p_company_id, p_user_id, 'company_admin_profile_created',
            json_build_object(
                'admin_name', p_admin_name,
                'is_company_founder', true,
                'registration_completed', true,
                'role_type', 'company_admin'
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
        'group_name', 'company_admin',
        'role_type', 'company_admin'
    );
    
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Erro ao finalizar cadastro: ' || SQLERRM
        );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===== 6. NOVA FUNÇÃO PARA CRIAR USUÁRIOS (SEM FOREIGN KEY ISSUE) =====

CREATE OR REPLACE FUNCTION public.admin_create_user_simple_fixed(
  p_email TEXT,
  p_full_name TEXT,
  p_group_name TEXT DEFAULT 'user',
  p_department_id UUID DEFAULT NULL,
  p_position_id UUID DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  target_company_id UUID;
  result jsonb;
BEGIN
  -- Verificar se o usuário atual é admin
  IF NOT (public.is_company_admin() OR public.is_super_admin()) THEN
    RAISE EXCEPTION 'Access denied: admin privileges required';
  END IF;
  
  -- Obter company_id do admin atual
  target_company_id := public.get_user_company_id();
  
  IF target_company_id IS NULL THEN
    RAISE EXCEPTION 'Company ID is required';
  END IF;

  -- Verificar se email já existe
  IF EXISTS (SELECT 1 FROM public.profiles WHERE email = p_email) THEN
    RAISE EXCEPTION 'Email already exists in profiles: %', p_email;
  END IF;

  -- CRIAR O USUÁRIO NO SUPABASE AUTH PRIMEIRO
  -- NOTE: Esta função agora apenas cria uma entrada de "convite" para o usuário
  -- O usuário real será criado quando ele fizer signup usando o mesmo email
  
  -- Criar entrada de perfil pendente SEM user_id (será preenchido depois)
  INSERT INTO public.user_invitations (
    email,
    full_name,
    group_name,
    company_id,
    department_id,
    position_id,
    status,
    invited_by,
    expires_at
  ) VALUES (
    p_email,
    p_full_name,
    p_group_name,
    target_company_id,
    p_department_id,
    p_position_id,
    'pending',
    auth.uid(),
    NOW() + INTERVAL '7 days'
  );

  result := jsonb_build_object(
    'success', true,
    'email', p_email,
    'full_name', p_full_name,
    'message', 'Convite enviado! O usuário deve se cadastrar usando o email: ' || p_email,
    'requires_signup', true,
    'status', 'invitation_sent'
  );

  RETURN result;

EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'Error creating user invitation: %', SQLERRM;
END;
$$;

-- ===== 7. CRIAR TABELA DE CONVITES DE USUÁRIOS =====

CREATE TABLE IF NOT EXISTS public.user_invitations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  group_name TEXT NOT NULL DEFAULT 'user',
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  department_id UUID REFERENCES public.departments(id),
  position_id UUID REFERENCES public.positions(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired')),
  invited_by UUID NOT NULL REFERENCES auth.users(id),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_invitations ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Company admins can manage invitations" 
ON public.user_invitations FOR ALL 
USING (company_id = get_user_company_id() AND (is_company_admin() OR is_super_admin()));

-- ===== 8. PERMISSÕES PARA AS FUNÇÕES =====

GRANT EXECUTE ON FUNCTION public.register_company_with_trial_secure TO anon;
GRANT EXECUTE ON FUNCTION public.complete_company_registration_secure TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_create_user_simple_fixed TO authenticated;

-- ===== 9. COMENTÁRIOS DAS FUNÇÕES =====

COMMENT ON FUNCTION public.register_company_with_trial_secure IS 'Creates company with trial automatically activated';
COMMENT ON FUNCTION public.complete_company_registration_secure IS 'Completes company registration by creating admin profile';
COMMENT ON FUNCTION public.admin_create_user_simple_fixed IS 'Creates user invitation instead of direct profile creation';

-- =====================================================
-- FIM DO SCRIPT
-- =====================================================

-- INSTRUÇÕES:
-- 1. Execute este SQL completo no editor SQL do Supabase
-- 2. Teste o cadastro de empresa no frontend
-- 3. Teste a criação de usuários na página /admin
-- 4. Verifique se o trial está ativo após cadastro da empresa

-- O QUE FOI CORRIGIDO:
-- ✅ Removidas duplicatas de planos trial
-- ✅ Empresa já recebe plano trial automaticamente no cadastro
-- ✅ Constraint de status corrigida
-- ✅ Foreign key issue resolvida com sistema de convites
-- ✅ Functions com SECURITY DEFINER
-- ✅ Logs condicionais para evitar erros
