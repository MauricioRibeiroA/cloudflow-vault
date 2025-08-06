-- =====================================================
-- SISTEMA DE PLANOS E CONTROLE DE LIMITES
-- =====================================================

-- 1. Criar tabela de planos
CREATE TABLE IF NOT EXISTS plans (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    price_brl NUMERIC(10,2) NOT NULL,
    storage_limit_gb INTEGER NOT NULL,
    download_limit_gb INTEGER NOT NULL,
    max_users INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Adicionar colunas à tabela companies
ALTER TABLE public.companies 
ADD COLUMN IF NOT EXISTS plan_id UUID REFERENCES plans(id),
ADD COLUMN IF NOT EXISTS current_storage_used_bytes BIGINT DEFAULT 0,
ADD COLUMN IF NOT EXISTS current_download_used_bytes BIGINT DEFAULT 0,
ADD COLUMN IF NOT EXISTS download_reset_date DATE DEFAULT DATE_TRUNC('month', NOW())::DATE,
ADD COLUMN IF NOT EXISTS active_users_count INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT,
ADD COLUMN IF NOT EXISTS stripe_status TEXT DEFAULT 'inactive';

-- 3. Inserir os planos iniciais
INSERT INTO plans (name, price_brl, storage_limit_gb, download_limit_gb, max_users) VALUES
('Starter', 59.00, 100, 30, 3),
('Plus', 89.00, 200, 60, 6),
('Pro', 139.00, 500, 150, 12)
ON CONFLICT DO NOTHING;

-- 4. Criar tabela de logs de bloqueios
CREATE TABLE IF NOT EXISTS usage_block_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id UUID REFERENCES public.companies(id),
    user_id UUID REFERENCES auth.users(id),
    block_type TEXT NOT NULL, -- 'storage', 'download', 'users'
    attempted_action TEXT NOT NULL, -- 'upload', 'download', 'create_user'
    file_size_bytes BIGINT,
    current_usage_bytes BIGINT,
    limit_bytes BIGINT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_companies_plan_id ON public.companies(plan_id);
CREATE INDEX IF NOT EXISTS idx_usage_block_logs_company_id ON usage_block_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_usage_block_logs_created_at ON usage_block_logs(created_at);

-- =====================================================
-- FUNÇÕES DE VALIDAÇÃO E CONTROLE
-- =====================================================

-- Função para obter uso atual da empresa
CREATE OR REPLACE FUNCTION get_company_usage(company_uuid UUID)
RETURNS JSON AS $$
DECLARE
    company_data RECORD;
    plan_data RECORD;
    result JSON;
BEGIN
    -- Buscar dados da empresa e plano
    SELECT 
        c.*,
        p.name as plan_name,
        p.storage_limit_gb,
        p.download_limit_gb,
        p.max_users
    INTO company_data
    FROM public.companies c
    LEFT JOIN plans p ON c.plan_id = p.id
    WHERE c.id = company_uuid;
    
    IF NOT FOUND THEN
        RETURN json_build_object('error', 'Company not found');
    END IF;
    
    -- Reset download mensal se necessário
    IF company_data.download_reset_date < DATE_TRUNC('month', NOW())::DATE THEN
        UPDATE public.companies
        SET 
            current_download_used_bytes = 0,
            download_reset_date = DATE_TRUNC('month', NOW())::DATE
        WHERE id = company_uuid;
        
        company_data.current_download_used_bytes = 0;
    END IF;
    
    -- Construir resultado
    result := json_build_object(
        'company_id', company_data.id,
        'company_name', company_data.name,
        'plan_name', COALESCE(company_data.plan_name, 'No Plan'),
        'storage_used_bytes', company_data.current_storage_used_bytes,
        'storage_used_gb', ROUND(company_data.current_storage_used_bytes::NUMERIC / 1073741824, 2),
        'storage_limit_gb', COALESCE(company_data.storage_limit_gb, 0),
        'download_used_bytes', company_data.current_download_used_bytes,
        'download_used_gb', ROUND(company_data.current_download_used_bytes::NUMERIC / 1073741824, 2),
        'download_limit_gb', COALESCE(company_data.download_limit_gb, 0),
        'active_users_count', company_data.active_users_count,
        'max_users', COALESCE(company_data.max_users, 0),
        'download_reset_date', company_data.download_reset_date
    );
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Função para validar se pode fazer upload
CREATE OR REPLACE FUNCTION can_upload_file(company_uuid UUID, file_size_bytes BIGINT)
RETURNS JSON AS $$
DECLARE
    company_data RECORD;
    new_total_bytes BIGINT;
    limit_bytes BIGINT;
BEGIN
    -- Buscar dados da empresa e plano
    SELECT 
        c.current_storage_used_bytes,
        COALESCE(p.storage_limit_gb * 1073741824, 0) as storage_limit_bytes
    INTO company_data
    FROM public.companies c
    LEFT JOIN plans p ON c.plan_id = p.id
    WHERE c.id = company_uuid;
    
    IF NOT FOUND THEN
        RETURN json_build_object('allowed', false, 'error', 'Company not found');
    END IF;
    
    -- Se não tem plano, bloquear
    IF company_data.storage_limit_bytes = 0 THEN
        RETURN json_build_object(
            'allowed', false, 
            'error', 'No active plan',
            'current_usage_bytes', company_data.current_storage_used_bytes,
            'limit_bytes', 0
        );
    END IF;
    
    new_total_bytes := company_data.current_storage_used_bytes + file_size_bytes;
    
    IF new_total_bytes > company_data.storage_limit_bytes THEN
        -- Registrar tentativa bloqueada
        INSERT INTO usage_block_logs (
            company_id, block_type, attempted_action, 
            file_size_bytes, current_usage_bytes, limit_bytes
        ) VALUES (
            company_uuid, 'storage', 'upload',
            file_size_bytes, company_data.current_storage_used_bytes, company_data.storage_limit_bytes
        );
        
        RETURN json_build_object(
            'allowed', false,
            'error', 'Storage limit exceeded',
            'current_usage_bytes', company_data.current_storage_used_bytes,
            'file_size_bytes', file_size_bytes,
            'new_total_bytes', new_total_bytes,
            'limit_bytes', company_data.storage_limit_bytes
        );
    END IF;
    
    RETURN json_build_object(
        'allowed', true,
        'current_usage_bytes', company_data.current_storage_used_bytes,
        'new_total_bytes', new_total_bytes,
        'limit_bytes', company_data.storage_limit_bytes
    );
END;
$$ LANGUAGE plpgsql;

-- Função para validar se pode fazer download
CREATE OR REPLACE FUNCTION can_download_file(company_uuid UUID, file_size_bytes BIGINT)
RETURNS JSON AS $$
DECLARE
    company_data RECORD;
    new_total_bytes BIGINT;
    limit_bytes BIGINT;
BEGIN
    -- Buscar dados da empresa e plano
    SELECT 
        c.current_download_used_bytes,
        c.download_reset_date,
        COALESCE(p.download_limit_gb * 1073741824, 0) as download_limit_bytes
    INTO company_data
    FROM public.companies c
    LEFT JOIN plans p ON c.plan_id = p.id
    WHERE c.id = company_uuid;
    
    IF NOT FOUND THEN
        RETURN json_build_object('allowed', false, 'error', 'Company not found');
    END IF;
    
    -- Reset download mensal se necessário
    IF company_data.download_reset_date < DATE_TRUNC('month', NOW())::DATE THEN
        UPDATE public.companies
        SET 
            current_download_used_bytes = 0,
            download_reset_date = DATE_TRUNC('month', NOW())::DATE
        WHERE id = company_uuid;
        
        company_data.current_download_used_bytes = 0;
    END IF;
    
    -- Se não tem plano, bloquear
    IF company_data.download_limit_bytes = 0 THEN
        RETURN json_build_object(
            'allowed', false, 
            'error', 'No active plan',
            'current_usage_bytes', company_data.current_download_used_bytes,
            'limit_bytes', 0
        );
    END IF;
    
    new_total_bytes := company_data.current_download_used_bytes + file_size_bytes;
    
    IF new_total_bytes > company_data.download_limit_bytes THEN
        -- Registrar tentativa bloqueada
        INSERT INTO usage_block_logs (
            company_id, block_type, attempted_action,
            file_size_bytes, current_usage_bytes, limit_bytes
        ) VALUES (
            company_uuid, 'download', 'download',
            file_size_bytes, company_data.current_download_used_bytes, company_data.download_limit_bytes
        );
        
        RETURN json_build_object(
            'allowed', false,
            'error', 'Download limit exceeded for this month',
            'current_usage_bytes', company_data.current_download_used_bytes,
            'file_size_bytes', file_size_bytes,
            'new_total_bytes', new_total_bytes,
            'limit_bytes', company_data.download_limit_bytes
        );
    END IF;
    
    RETURN json_build_object(
        'allowed', true,
        'current_usage_bytes', company_data.current_download_used_bytes,
        'new_total_bytes', new_total_bytes,
        'limit_bytes', company_data.download_limit_bytes
    );
END;
$$ LANGUAGE plpgsql;

-- Função para atualizar uso de armazenamento
CREATE OR REPLACE FUNCTION update_storage_usage(company_uuid UUID, bytes_change BIGINT)
RETURNS JSON AS $$
BEGIN
    UPDATE public.companies
    SET current_storage_used_bytes = GREATEST(0, current_storage_used_bytes + bytes_change)
    WHERE id = company_uuid;
    
    RETURN json_build_object('success', true, 'bytes_change', bytes_change);
END;
$$ LANGUAGE plpgsql;

-- Função para atualizar uso de download
CREATE OR REPLACE FUNCTION update_download_usage(company_uuid UUID, bytes_downloaded BIGINT)
RETURNS JSON AS $$
DECLARE
    company_data RECORD;
BEGIN
    -- Buscar dados atuais
    SELECT current_download_used_bytes, download_reset_date
    INTO company_data
    FROM public.companies
    WHERE id = company_uuid;
    
    -- Reset download mensal se necessário
    IF company_data.download_reset_date < DATE_TRUNC('month', NOW())::DATE THEN
        UPDATE public.companies
        SET 
            current_download_used_bytes = bytes_downloaded,
            download_reset_date = DATE_TRUNC('month', NOW())::DATE
        WHERE id = company_uuid;
    ELSE
        UPDATE public.companies
        SET current_download_used_bytes = current_download_used_bytes + bytes_downloaded
        WHERE id = company_uuid;
    END IF;
    
    RETURN json_build_object('success', true, 'bytes_downloaded', bytes_downloaded);
END;
$$ LANGUAGE plpgsql;

-- Função para validar criação de novo usuário
CREATE OR REPLACE FUNCTION can_create_user(company_uuid UUID)
RETURNS JSON AS $$
DECLARE
    company_data RECORD;
BEGIN
    SELECT 
        c.active_users_count,
        COALESCE(p.max_users, 0) as max_users
    INTO company_data
    FROM public.companies c
    LEFT JOIN plans p ON c.plan_id = p.id
    WHERE c.id = company_uuid;
    
    IF NOT FOUND THEN
        RETURN json_build_object('allowed', false, 'error', 'Company not found');
    END IF;
    
    -- Se não tem plano, bloquear
    IF company_data.max_users = 0 THEN
        RETURN json_build_object(
            'allowed', false, 
            'error', 'No active plan',
            'current_users', company_data.active_users_count,
            'max_users', 0
        );
    END IF;
    
    IF company_data.active_users_count >= company_data.max_users THEN
        -- Registrar tentativa bloqueada
        INSERT INTO usage_block_logs (
            company_id, block_type, attempted_action,
            current_usage_bytes, limit_bytes
        ) VALUES (
            company_uuid, 'users', 'create_user',
            company_data.active_users_count, company_data.max_users
        );
        
        RETURN json_build_object(
            'allowed', false,
            'error', 'User limit reached for current plan',
            'current_users', company_data.active_users_count,
            'max_users', company_data.max_users
        );
    END IF;
    
    RETURN json_build_object(
        'allowed', true,
        'current_users', company_data.active_users_count,
        'max_users', company_data.max_users
    );
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- RLS (ROW LEVEL SECURITY) POLICIES
-- =====================================================

-- Habilitar RLS nas novas tabelas
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_block_logs ENABLE ROW LEVEL SECURITY;

-- Policy para plans (todos podem ler, apenas super_admin pode modificar)
CREATE POLICY "Plans are readable by everyone" ON plans FOR SELECT USING (true);

CREATE POLICY "Plans are modifiable by super_admin only" ON plans 
FOR ALL USING (
    public.is_super_admin()
);

-- Policy para usage_block_logs (apenas super_admin e usuários da própria empresa)
CREATE POLICY "Usage logs are readable by company members and super_admin" ON usage_block_logs 
FOR SELECT USING (
    company_id = public.get_user_company_id()
    OR public.is_super_admin()
);

-- Trigger para atualizar updated_at nos planos
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_plans_updated_at 
BEFORE UPDATE ON plans
FOR EACH ROW 
EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE plans IS 'Planos de assinatura disponíveis no sistema';
COMMENT ON TABLE usage_block_logs IS 'Log de tentativas de uso bloqueadas por limite de plano';
COMMENT ON FUNCTION get_company_usage(UUID) IS 'Retorna uso atual de storage, download e usuários da empresa';
COMMENT ON FUNCTION can_upload_file(UUID, BIGINT) IS 'Valida se empresa pode fazer upload baseado no limite de storage';
COMMENT ON FUNCTION can_download_file(UUID, BIGINT) IS 'Valida se empresa pode fazer download baseado no limite mensal';
COMMENT ON FUNCTION can_create_user(UUID) IS 'Valida se empresa pode criar novo usuário baseado no limite do plano';
