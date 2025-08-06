-- =====================================================
-- PLANO TRIAL GRATUITO DE 7 DIAS
-- =====================================================

-- 1. Adicionar colunas relacionadas ao trial na tabela companies
ALTER TABLE public.companies 
ADD COLUMN IF NOT EXISTS trial_started_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS is_trial_active BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS trial_used BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'inactive' CHECK (subscription_status IN ('inactive', 'trial', 'active', 'cancelled', 'expired'));

-- 2. Inserir plano Trial gratuito
INSERT INTO plans (name, price_brl, storage_limit_gb, download_limit_gb, max_users) VALUES
('Trial', 0.00, 50, 15, 2)
ON CONFLICT DO NOTHING;

-- 3. Função para iniciar trial gratuito para uma empresa
CREATE OR REPLACE FUNCTION start_free_trial(company_uuid UUID)
RETURNS JSON AS $$
DECLARE
    trial_plan_id UUID;
    trial_duration_days INTEGER := 7;
    result JSON;
BEGIN
    -- Verificar se empresa existe
    IF NOT EXISTS (SELECT 1 FROM public.companies WHERE id = company_uuid) THEN
        RETURN json_build_object('success', false, 'error', 'Company not found');
    END IF;
    
    -- Verificar se já usou o trial
    IF EXISTS (SELECT 1 FROM public.companies WHERE id = company_uuid AND trial_used = true) THEN
        RETURN json_build_object('success', false, 'error', 'Trial already used for this company');
    END IF;
    
    -- Verificar se já tem trial ativo
    IF EXISTS (SELECT 1 FROM public.companies WHERE id = company_uuid AND is_trial_active = true) THEN
        RETURN json_build_object('success', false, 'error', 'Trial already active');
    END IF;
    
    -- Buscar ID do plano Trial
    SELECT id INTO trial_plan_id FROM plans WHERE name = 'Trial' LIMIT 1;
    
    IF trial_plan_id IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Trial plan not found');
    END IF;
    
    -- Ativar trial
    UPDATE public.companies
    SET 
        plan_id = trial_plan_id,
        trial_started_at = NOW(),
        trial_ends_at = NOW() + INTERVAL '7 days',
        is_trial_active = true,
        trial_used = true,
        subscription_status = 'trial',
        current_storage_used_bytes = 0,
        current_download_used_bytes = 0,
        download_reset_date = DATE_TRUNC('month', NOW())::DATE
    WHERE id = company_uuid;
    
    -- Log da ação
    INSERT INTO user_action_logs (
        company_id, user_id, action_type, details
    ) 
    SELECT 
        company_uuid,
        (SELECT user_id FROM public.profiles WHERE company_id = company_uuid AND group_name = 'company_admin' LIMIT 1),
        'trial_started',
        json_build_object(
            'trial_duration_days', trial_duration_days,
            'trial_ends_at', NOW() + INTERVAL '7 days',
            'plan_name', 'Trial'
        );
    
    result := json_build_object(
        'success', true,
        'message', 'Trial started successfully',
        'trial_started_at', NOW(),
        'trial_ends_at', NOW() + INTERVAL '7 days',
        'plan_name', 'Trial',
        'storage_limit_gb', 50,
        'download_limit_gb', 15,
        'max_users', 2
    );
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- 4. Função para verificar status do trial
CREATE OR REPLACE FUNCTION check_trial_status(company_uuid UUID)
RETURNS JSON AS $$
DECLARE
    company_data RECORD;
    days_remaining INTEGER;
    hours_remaining INTEGER;
    is_expired BOOLEAN;
    result JSON;
BEGIN
    -- Buscar dados da empresa
    SELECT 
        c.id,
        c.name,
        c.is_trial_active,
        c.trial_started_at,
        c.trial_ends_at,
        c.trial_used,
        c.subscription_status,
        p.name as plan_name,
        p.storage_limit_gb,
        p.download_limit_gb,
        p.max_users
    INTO company_data
    FROM public.companies c
    LEFT JOIN plans p ON c.plan_id = p.id
    WHERE c.id = company_uuid;
    
    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'error', 'Company not found');
    END IF;
    
    -- Se não tem trial ativo, retornar status básico
    IF NOT company_data.is_trial_active THEN
        RETURN json_build_object(
            'success', true,
            'has_trial_active', false,
            'trial_used', company_data.trial_used,
            'subscription_status', company_data.subscription_status,
            'plan_name', company_data.plan_name
        );
    END IF;
    
    -- Verificar se trial expirou
    is_expired := company_data.trial_ends_at < NOW();
    
    -- Calcular tempo restante
    IF NOT is_expired THEN
        days_remaining := EXTRACT(DAYS FROM (company_data.trial_ends_at - NOW()));
        hours_remaining := EXTRACT(HOURS FROM (company_data.trial_ends_at - NOW())) % 24;
    ELSE
        days_remaining := 0;
        hours_remaining := 0;
        
        -- Se expirou, atualizar status
        UPDATE public.companies
        SET 
            is_trial_active = false,
            subscription_status = 'expired'
        WHERE id = company_uuid;
    END IF;
    
    result := json_build_object(
        'success', true,
        'has_trial_active', NOT is_expired,
        'is_expired', is_expired,
        'trial_started_at', company_data.trial_started_at,
        'trial_ends_at', company_data.trial_ends_at,
        'days_remaining', days_remaining,
        'hours_remaining', hours_remaining,
        'subscription_status', CASE WHEN is_expired THEN 'expired' ELSE company_data.subscription_status END,
        'plan_name', company_data.plan_name,
        'storage_limit_gb', company_data.storage_limit_gb,
        'download_limit_gb', company_data.download_limit_gb,
        'max_users', company_data.max_users
    );
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- 5. Função para verificar se empresa pode executar ação (considerando trial)
CREATE OR REPLACE FUNCTION can_company_perform_action(
    company_uuid UUID, 
    action_type TEXT  -- 'upload', 'download', 'create_user'
)
RETURNS JSON AS $$
DECLARE
    trial_status JSON;
    company_usage JSON;
    result JSON;
BEGIN
    -- Verificar status do trial
    SELECT check_trial_status(company_uuid) INTO trial_status;
    
    -- Se trial expirou, bloquear ações
    IF (trial_status->>'is_expired')::BOOLEAN = true THEN
        RETURN json_build_object(
            'allowed', false,
            'error', 'Trial period has expired. Please upgrade to continue.',
            'trial_status', trial_status
        );
    END IF;
    
    -- Se não tem plano ativo, bloquear
    IF (trial_status->>'subscription_status') NOT IN ('trial', 'active') THEN
        RETURN json_build_object(
            'allowed', false,
            'error', 'No active plan. Please start trial or subscribe.',
            'trial_status', trial_status
        );
    END IF;
    
    -- Para ações específicas, verificar limites usando funções existentes
    CASE action_type
        WHEN 'create_user' THEN
            SELECT can_create_user(company_uuid) INTO result;
        ELSE
            -- Para upload e download, as funções existentes já verificam os limites
            result := json_build_object('allowed', true, 'message', 'Action allowed');
    END CASE;
    
    -- Adicionar informações do trial no resultado
    result := result || json_build_object('trial_status', trial_status);
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- 6. Função para auto-ativar trial quando empresa é criada
CREATE OR REPLACE FUNCTION auto_start_trial_for_new_company()
RETURNS TRIGGER AS $$
BEGIN
    -- Se a empresa não tem plano definido, iniciar trial automaticamente
    IF NEW.plan_id IS NULL AND NEW.is_trial_active = false AND NEW.trial_used = false THEN
        PERFORM start_free_trial(NEW.id);
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 7. Criar trigger para auto-ativar trial
DROP TRIGGER IF EXISTS auto_trial_trigger ON public.companies;
CREATE TRIGGER auto_trial_trigger
    AFTER INSERT ON public.companies
    FOR EACH ROW
    EXECUTE FUNCTION auto_start_trial_for_new_company();

-- 8. Função para obter informações do dashboard com trial
CREATE OR REPLACE FUNCTION get_company_dashboard_data(company_uuid UUID)
RETURNS JSON AS $$
DECLARE
    usage_data JSON;
    trial_data JSON;
    result JSON;
BEGIN
    -- Obter dados de uso existentes
    SELECT get_company_usage(company_uuid) INTO usage_data;
    
    -- Obter dados do trial
    SELECT check_trial_status(company_uuid) INTO trial_data;
    
    -- Combinar dados
    result := usage_data || json_build_object('trial_info', trial_data);
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- 9. Atualizar funções existentes para considerar trial
CREATE OR REPLACE FUNCTION can_upload_file_with_trial(company_uuid UUID, file_size_bytes BIGINT)
RETURNS JSON AS $$
DECLARE
    action_check JSON;
    upload_check JSON;
BEGIN
    -- Verificar se pode executar ação (trial ativo)
    SELECT can_company_perform_action(company_uuid, 'upload') INTO action_check;
    
    IF (action_check->>'allowed')::BOOLEAN = false THEN
        RETURN action_check;
    END IF;
    
    -- Verificar limites de storage
    SELECT can_upload_file(company_uuid, file_size_bytes) INTO upload_check;
    
    -- Combinar resultados
    RETURN upload_check || json_build_object('trial_status', action_check->'trial_status');
END;
$$ LANGUAGE plpgsql;

-- 10. View para facilitar consultas sobre empresas em trial
CREATE OR REPLACE VIEW trial_companies AS
SELECT 
    c.id,
    c.name,
    c.trial_started_at,
    c.trial_ends_at,
    c.is_trial_active,
    CASE 
        WHEN c.trial_ends_at < NOW() THEN true 
        ELSE false 
    END as is_expired,
    EXTRACT(DAYS FROM (c.trial_ends_at - NOW())) as days_remaining,
    p.name as plan_name,
    p.storage_limit_gb,
    p.download_limit_gb,
    p.max_users,
    c.current_storage_used_bytes,
    c.current_download_used_bytes,
    c.active_users_count
FROM public.companies c
LEFT JOIN plans p ON c.plan_id = p.id
WHERE c.is_trial_active = true OR c.trial_used = true;

-- 11. RLS para views não é suportado diretamente
-- A view herda as políticas RLS da tabela base (companies)
-- O controle de acesso será feito a nível de aplicação

-- =====================================================
-- ÍNDICES PARA PERFORMANCE
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_companies_trial_status ON public.companies(is_trial_active, trial_ends_at);
CREATE INDEX IF NOT EXISTS idx_companies_subscription_status ON public.companies(subscription_status);
CREATE INDEX IF NOT EXISTS idx_companies_trial_used ON public.companies(trial_used);

-- =====================================================
-- COMENTÁRIOS PARA DOCUMENTAÇÃO
-- =====================================================

COMMENT ON FUNCTION start_free_trial(UUID) IS 'Inicia trial gratuito de 7 dias para uma empresa';
COMMENT ON FUNCTION check_trial_status(UUID) IS 'Verifica status atual do trial de uma empresa';
COMMENT ON FUNCTION can_company_perform_action(UUID, TEXT) IS 'Verifica se empresa pode executar ação considerando trial';
COMMENT ON FUNCTION get_company_dashboard_data(UUID) IS 'Retorna dados completos do dashboard incluindo informações de trial';
COMMENT ON VIEW trial_companies IS 'View com informações de todas as empresas em trial ou que já usaram trial';
