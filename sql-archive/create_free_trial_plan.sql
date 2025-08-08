-- =====================================================
-- PLANO FREE TRIAL COM LIMITES RESTRITIVOS
-- =====================================================
-- Baseado nas regras para proteger contra abuso:
-- • 10 GB de armazenamento (mesmo do Google Drive gratuito)
-- • 3 GB de download total durante o trial
-- • 2 usuários máximo (força upgrade para trabalho em equipe)
-- • 7 dias de duração
-- • Arquivos limitados a 250 MB cada
-- • Limite diário de upload de 2 GB
-- • Máximo 500 arquivos
-- • Exclusão automática após 7 dias do fim do trial
-- =====================================================

-- Inserir plano Free Trial
INSERT INTO plans (
  name,
  price_brl,
  storage_limit_gb,
  download_limit_gb,
  max_users,
  created_at,
  updated_at,
  is_active
) VALUES (
  'Free Trial',      -- Nome do plano
  0.00,              -- Gratuito
  10,                -- 10 GB de armazenamento (competitivo mas controlado)
  3,                 -- 3 GB de download total (evita "roubo reverso")
  2,                 -- 2 usuários (força upgrade para equipes)
  NOW(),
  NOW(),
  true
);

-- =====================================================
-- ATUALIZAR FUNÇÃO DE VALIDAÇÃO DE UPLOADS COM LIMITES DO TRIAL
-- =====================================================

-- Função melhorada para validar uploads considerando limites do Free Trial
CREATE OR REPLACE FUNCTION can_upload_file(
  company_uuid UUID, 
  file_size_bytes BIGINT,
  file_name TEXT DEFAULT 'unknown'
)
RETURNS JSON AS $$
DECLARE
  company_data RECORD;
  file_size_mb NUMERIC;
  current_files_count INTEGER;
  daily_upload_bytes BIGINT;
  limit_bytes BIGINT;
  new_total_bytes BIGINT;
BEGIN
  -- Calcular tamanho do arquivo em MB para validações
  file_size_mb := file_size_bytes::NUMERIC / (1024 * 1024);
  
  -- Buscar dados da empresa e plano
  SELECT 
    c.current_storage_used_bytes,
    c.is_trial_active,
    c.trial_ends_at,
    c.created_at as company_created_at,
    COALESCE(p.storage_limit_gb * 1073741824, 0) as storage_limit_bytes,
    p.name as plan_name,
    p.id as plan_id
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
  
  -- VALIDAÇÕES ESPECÍFICAS PARA FREE TRIAL
  IF company_data.plan_name = 'Free Trial' AND company_data.is_trial_active THEN
    
    -- 1. Validar se trial não expirou
    IF company_data.trial_ends_at IS NOT NULL AND company_data.trial_ends_at < NOW() THEN
      RETURN json_build_object(
        'allowed', false,
        'error', 'Free trial has expired. Please upgrade to a paid plan.',
        'trial_expired', true
      );
    END IF;
    
    -- 2. Limite por arquivo: 250 MB máximo
    IF file_size_mb > 250 THEN
      RETURN json_build_object(
        'allowed', false,
        'error', 'File size exceeds 250 MB limit for Free Trial. Upgrade for larger files.',
        'file_size_limit_exceeded', true,
        'file_size_mb', file_size_mb,
        'limit_mb', 250
      );
    END IF;
    
    -- 3. Limite de arquivos: 500 máximo
    SELECT COUNT(*) INTO current_files_count
    FROM files 
    WHERE company_id = company_uuid;
    
    IF current_files_count >= 500 THEN
      RETURN json_build_object(
        'allowed', false,
        'error', 'Free Trial allows maximum 500 files. Please upgrade your plan.',
        'file_count_limit_exceeded', true,
        'current_files', current_files_count,
        'limit_files', 500
      );
    END IF;
    
    -- 4. Limite diário de upload: 2 GB por dia
    SELECT COALESCE(SUM(file_size), 0) INTO daily_upload_bytes
    FROM files 
    WHERE company_id = company_uuid 
    AND DATE(created_at) = CURRENT_DATE;
    
    IF (daily_upload_bytes + file_size_bytes) > (2 * 1073741824) THEN -- 2 GB
      RETURN json_build_object(
        'allowed', false,
        'error', 'Daily upload limit of 2 GB exceeded for Free Trial. Try again tomorrow or upgrade.',
        'daily_limit_exceeded', true,
        'daily_used_bytes', daily_upload_bytes,
        'daily_limit_bytes', (2 * 1073741824),
        'file_size_bytes', file_size_bytes
      );
    END IF;
    
  END IF;
  
  -- Validação padrão de armazenamento (para todos os planos)
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
      'error', CASE 
        WHEN company_data.plan_name = 'Free Trial' THEN 
          'Storage limit of 10 GB exceeded for Free Trial. Upgrade to continue uploading.'
        ELSE 
          'Storage limit exceeded for current plan'
      END,
      'storage_limit_exceeded', true,
      'current_usage_bytes', company_data.current_storage_used_bytes,
      'file_size_bytes', file_size_bytes,
      'new_total_bytes', new_total_bytes,
      'limit_bytes', company_data.storage_limit_bytes
    );
  END IF;
  
  -- Upload permitido
  RETURN json_build_object(
    'allowed', true,
    'current_usage_bytes', company_data.current_storage_used_bytes,
    'new_total_bytes', new_total_bytes,
    'limit_bytes', company_data.storage_limit_bytes,
    'plan_name', company_data.plan_name,
    'is_trial', company_data.is_trial_active
  );
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- FUNÇÃO PARA LIMPEZA AUTOMÁTICA DE ARQUIVOS APÓS TRIAL
-- =====================================================

-- Função para marcar arquivos de trial expirado para exclusão
CREATE OR REPLACE FUNCTION cleanup_expired_trial_files()
RETURNS INTEGER AS $$
DECLARE
  files_marked INTEGER := 0;
  company_record RECORD;
BEGIN
  -- Buscar empresas com trial expirado há mais de 7 dias
  FOR company_record IN 
    SELECT id, name, trial_ends_at
    FROM companies 
    WHERE is_trial_active = false 
    AND trial_ends_at IS NOT NULL
    AND trial_ends_at < (NOW() - INTERVAL '7 days')
    AND EXISTS (
      SELECT 1 FROM files WHERE company_id = companies.id
    )
  LOOP
    -- Marcar arquivos para exclusão (ou deletar diretamente)
    UPDATE files 
    SET 
      status = 'pending_deletion',
      updated_at = NOW()
    WHERE company_id = company_record.id
    AND status != 'pending_deletion';
    
    GET DIAGNOSTICS files_marked = ROW_COUNT;
    
    -- Log da ação
    INSERT INTO user_action_logs (
      company_id,
      action_type,
      action_description,
      created_at
    ) VALUES (
      company_record.id,
      'trial_cleanup',
      format('Marked %s files for deletion after trial expiration', files_marked),
      NOW()
    );
    
  END LOOP;
  
  RETURN files_marked;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- CONFIGURAR TRIAL PADRÃO PARA NOVAS EMPRESAS
-- =====================================================

-- Trigger para configurar Free Trial automaticamente para novas empresas
CREATE OR REPLACE FUNCTION setup_free_trial_for_new_company()
RETURNS TRIGGER AS $$
DECLARE
  trial_plan_id UUID;
BEGIN
  -- Buscar ID do plano Free Trial
  SELECT id INTO trial_plan_id 
  FROM plans 
  WHERE name = 'Free Trial' 
  AND is_active = true 
  LIMIT 1;
  
  IF trial_plan_id IS NOT NULL THEN
    -- Configurar empresa com Free Trial
    UPDATE companies 
    SET 
      plan_id = trial_plan_id,
      is_trial_active = true,
      trial_ends_at = NOW() + INTERVAL '7 days',
      subscription_status = 'trial'
    WHERE id = NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Criar trigger para configurar trial automaticamente
DROP TRIGGER IF EXISTS setup_trial_trigger ON companies;
CREATE TRIGGER setup_trial_trigger
  AFTER INSERT ON companies
  FOR EACH ROW
  EXECUTE FUNCTION setup_free_trial_for_new_company();

-- =====================================================
-- FUNÇÃO PARA SCHEDULER DE LIMPEZA (EXECUTAR DIARIAMENTE)
-- =====================================================

-- Esta função deve ser chamada por um cron job ou scheduler
-- SELECT cleanup_expired_trial_files();

COMMENT ON FUNCTION cleanup_expired_trial_files() IS 
'Função para limpeza automática de arquivos de trials expirados. 
Execute diariamente via cron: SELECT cleanup_expired_trial_files();';

COMMENT ON FUNCTION can_upload_file(UUID, BIGINT, TEXT) IS 
'Validação de upload com limites específicos do Free Trial:
- 250 MB por arquivo
- 500 arquivos máximo  
- 2 GB upload diário
- 10 GB total de armazenamento';

-- =====================================================
-- CONFIRMAR CRIAÇÃO DO PLANO
-- =====================================================
SELECT 
  name,
  price_brl,
  storage_limit_gb,
  download_limit_gb,
  max_users,
  created_at
FROM plans 
WHERE name = 'Free Trial';
