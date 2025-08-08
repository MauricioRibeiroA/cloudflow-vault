-- =====================================================
-- SCRIPT PARA DEBUGAR E VERIFICAR DADOS DA EMPRESA
-- Execute este SQL no Dashboard do Supabase > SQL Editor
-- =====================================================

-- 1. Verificar se os planos existem
SELECT 'PLANOS EXISTENTES:' as info;
SELECT 
  id,
  name,
  price_brl,
  storage_limit_gb,
  download_limit_gb,
  max_users,
  created_at
FROM plans 
ORDER BY price_brl;

-- 2. Verificar estrutura da tabela companies
SELECT 'ESTRUTURA DA TABELA COMPANIES:' as info;
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'companies' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- 3. Verificar dados da empresa 3dpine
SELECT 'DADOS DA EMPRESA 3DPINE:' as info;
SELECT 
  c.*,
  p.name as plan_name,
  p.price_brl,
  p.storage_limit_gb,
  p.download_limit_gb,
  p.max_users
FROM companies c
LEFT JOIN plans p ON c.plan_id = p.id
WHERE c.name ILIKE '%3dpine%' OR c.name ILIKE '%pine%';

-- 4. Verificar todas as empresas sem plano
SELECT 'EMPRESAS SEM PLANO:' as info;
SELECT 
  c.id,
  c.name,
  c.plan_id,
  c.created_at
FROM companies c
WHERE c.plan_id IS NULL
ORDER BY c.created_at DESC;

-- 5. Testar a função get_company_usage para a empresa 3dpine
SELECT 'TESTE DA FUNÇÃO GET_COMPANY_USAGE:' as info;

-- Primeiro, pegar o ID da empresa 3dpine
DO $$
DECLARE
  company_id_var UUID;
  usage_result JSON;
BEGIN
  -- Buscar ID da empresa 3dpine
  SELECT id INTO company_id_var 
  FROM companies 
  WHERE name ILIKE '%3dpine%' OR name ILIKE '%pine%'
  LIMIT 1;
  
  IF company_id_var IS NOT NULL THEN
    RAISE NOTICE 'Empresa encontrada: %', company_id_var;
    
    -- Testar função get_company_usage
    SELECT get_company_usage(company_id_var) INTO usage_result;
    RAISE NOTICE 'Resultado da função: %', usage_result;
  ELSE
    RAISE NOTICE 'Empresa 3dpine não encontrada';
  END IF;
END $$;

-- 6. Atribuir plano Free Trial manualmente para a empresa 3dpine
UPDATE companies 
SET 
  plan_id = (SELECT id FROM plans WHERE name = 'Free Trial' LIMIT 1),
  is_trial_active = COALESCE(is_trial_active, true),
  trial_ends_at = COALESCE(trial_ends_at, NOW() + INTERVAL '7 days'),
  subscription_status = COALESCE(subscription_status, 'trial'),
  current_storage_used_bytes = COALESCE(current_storage_used_bytes, 0),
  current_download_used_bytes = COALESCE(current_download_used_bytes, 0),
  active_users_count = COALESCE(active_users_count, 1)
WHERE (name ILIKE '%3dpine%' OR name ILIKE '%pine%')
AND (SELECT id FROM plans WHERE name = 'Free Trial' LIMIT 1) IS NOT NULL;

-- 7. Verificar se a atualização funcionou
SELECT 'DADOS APÓS ATUALIZAÇÃO:' as info;
SELECT 
  c.id,
  c.name,
  c.plan_id,
  p.name as plan_name,
  p.price_brl,
  p.storage_limit_gb,
  p.download_limit_gb,
  p.max_users,
  c.is_trial_active,
  c.trial_ends_at,
  c.subscription_status,
  c.current_storage_used_bytes,
  c.current_download_used_bytes,
  c.active_users_count
FROM companies c
LEFT JOIN plans p ON c.plan_id = p.id
WHERE c.name ILIKE '%3dpine%' OR c.name ILIKE '%pine%';

-- 8. Testar novamente a função após a atualização
SELECT 'TESTE FINAL DA FUNÇÃO:' as info;

-- Função de teste
CREATE OR REPLACE FUNCTION test_company_usage()
RETURNS TABLE(
  company_name TEXT,
  plan_name TEXT,
  usage_data JSON
) AS $$
DECLARE
  company_record RECORD;
BEGIN
  FOR company_record IN 
    SELECT c.id, c.name 
    FROM companies c 
    WHERE c.name ILIKE '%3dpine%' OR c.name ILIKE '%pine%'
  LOOP
    RETURN QUERY
    SELECT 
      company_record.name,
      COALESCE(p.name, 'Sem Plano'),
      get_company_usage(company_record.id)
    FROM companies c
    LEFT JOIN plans p ON c.plan_id = p.id
    WHERE c.id = company_record.id;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Executar teste
SELECT * FROM test_company_usage();

-- Limpar função de teste
DROP FUNCTION IF EXISTS test_company_usage();
