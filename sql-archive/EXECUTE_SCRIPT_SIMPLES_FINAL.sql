-- =====================================================
-- SCRIPT SIMPLES PARA CORRIGIR TODOS OS PROBLEMAS
-- Execute este SQL no editor SQL do Supabase
-- =====================================================

-- 1. Adicionar colunas de trial se não existirem
ALTER TABLE public.companies 
ADD COLUMN IF NOT EXISTS trial_started_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS is_trial_active BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS trial_used BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'inactive';

-- 2. Adicionar constraint de subscription_status se não existir
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'companies_subscription_status_check') THEN
        ALTER TABLE public.companies ADD CONSTRAINT companies_subscription_status_check 
        CHECK (subscription_status IN ('inactive', 'trial', 'active', 'cancelled', 'expired'));
    END IF;
END $$;

-- 3. Remover planos trial duplicados
DELETE FROM public.plans WHERE name = 'Trial';

-- 4. Inserir plano trial correto (SEM COLUNA FEATURES)
INSERT INTO public.plans (name, price_brl, storage_limit_gb, download_limit_gb, max_users) 
VALUES ('Trial', 0.00, 50, 15, 3);

-- 5. Corrigir constraints de status na tabela profiles
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS check_valid_status;
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_status_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_status_check 
CHECK (status IN ('active', 'inactive', 'suspended', 'pending_activation'));

-- 6. Corrigir constraints de group_name na tabela profiles
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS check_valid_group_name;
ALTER TABLE public.profiles ADD CONSTRAINT check_valid_group_name 
CHECK (group_name IN ('admin', 'rh', 'user', 'super_admin', 'company_admin', 'hr'));

-- 7. Função de registro com trial automático
CREATE OR REPLACE FUNCTION public.register_company_with_trial_secure(
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
    trial_plan_id UUID;
    result JSON;
BEGIN
    -- Verificar duplicações
    IF p_cnpj IS NOT NULL AND EXISTS (SELECT 1 FROM public.companies WHERE cnpj = p_cnpj) THEN
        RETURN json_build_object('success', false, 'error', 'CNPJ já cadastrado no sistema');
    END IF;
    
    IF p_admin_cpf IS NOT NULL AND EXISTS (SELECT 1 FROM public.profiles WHERE cpf = p_admin_cpf) THEN
        RETURN json_build_object('success', false, 'error', 'CPF já cadastrado no sistema');
    END IF;
    
    -- Buscar plano Trial
    SELECT id INTO trial_plan_id FROM public.plans WHERE name = 'Trial' LIMIT 1;
    
    IF trial_plan_id IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Plano Trial não encontrado');
    END IF;
    
    -- Criar empresa com trial ativo
    INSERT INTO public.companies (
        name, cnpj, razao_social, inscricao_estadual, setor, porte,
        cep, logradouro, numero, complemento, bairro, cidade, estado, telefone,
        is_self_registered, registration_source,
        current_storage_used_bytes, current_download_used_bytes,
        active_users_count,
        plan_id,
        trial_started_at,
        trial_ends_at,
        is_trial_active,
        trial_used,
        subscription_status,
        download_reset_date
    ) VALUES (
        p_company_name, p_cnpj, COALESCE(p_razao_social, p_company_name), 
        p_inscricao_estadual, p_setor, p_porte,
        p_cep, p_logradouro, p_numero, p_complemento, p_bairro, p_cidade, p_estado, p_telefone_empresa,
        true, 'trial_signup',
        0, 0, 1,
        trial_plan_id,
        NOW(),
        NOW() + INTERVAL '7 days',
        true,
        true,
        'trial',
        DATE_TRUNC('month', NOW())::DATE
    ) RETURNING id INTO new_company_id;
    
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
        RETURN json_build_object('success', false, 'error', 'Erro interno: ' || SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Função de finalização de cadastro
CREATE OR REPLACE FUNCTION public.complete_company_registration_secure(
    p_company_id UUID,
    p_user_id UUID,
    p_admin_name VARCHAR(255),
    p_admin_cpf VARCHAR(14),
    p_admin_telefone VARCHAR(20),
    p_admin_cargo VARCHAR(100)
)
RETURNS JSON AS $$
BEGIN
    -- Verificar se empresa existe
    IF NOT EXISTS(SELECT 1 FROM public.companies WHERE id = p_company_id) THEN
        RETURN json_build_object('success', false, 'error', 'Empresa não encontrada');
    END IF;
    
    -- Criar perfil do admin
    INSERT INTO public.profiles (
        user_id, company_id, full_name, email, cpf, telefone, cargo,
        group_name, status, is_company_founder
    ) VALUES (
        p_user_id, p_company_id, p_admin_name, 
        (SELECT email FROM auth.users WHERE id = p_user_id),
        p_admin_cpf, p_admin_telefone, p_admin_cargo,
        'company_admin', 'active', true
    );
    
    -- Atualizar contador de usuários
    UPDATE public.companies SET active_users_count = 1 WHERE id = p_company_id;
    
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
        RETURN json_build_object('success', false, 'error', 'Erro ao finalizar cadastro: ' || SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. Criar tabela de convites para usuários
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

ALTER TABLE public.user_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company admins can manage invitations" 
ON public.user_invitations FOR ALL 
USING (company_id = get_user_company_id() AND (is_company_admin() OR is_super_admin()));

-- 10. Função para criar usuários (sistema de convites)
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
  -- Verificar permissões
  IF NOT (public.is_company_admin() OR public.is_super_admin()) THEN
    RAISE EXCEPTION 'Access denied: admin privileges required';
  END IF;
  
  -- Obter company_id
  target_company_id := public.get_user_company_id();
  
  IF target_company_id IS NULL THEN
    RAISE EXCEPTION 'Company ID is required';
  END IF;

  -- Verificar se email já existe
  IF EXISTS (SELECT 1 FROM public.profiles WHERE email = p_email) THEN
    RAISE EXCEPTION 'Email already exists in profiles: %', p_email;
  END IF;

  -- Criar convite
  INSERT INTO public.user_invitations (
    email, full_name, group_name, company_id, department_id, position_id,
    status, invited_by, expires_at
  ) VALUES (
    p_email, p_full_name, p_group_name, target_company_id, 
    p_department_id, p_position_id, 'pending', auth.uid(), NOW() + INTERVAL '7 days'
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

-- 11. Conceder permissões
GRANT EXECUTE ON FUNCTION public.register_company_with_trial_secure TO anon;
GRANT EXECUTE ON FUNCTION public.complete_company_registration_secure TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_create_user_simple_fixed TO authenticated;

-- =====================================================
-- SCRIPT CONCLUÍDO COM SUCESSO!
-- =====================================================
