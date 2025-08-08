-- Script para debugar o problema das cotas não aparecendo no dashboard
-- Execute no Supabase Dashboard -> SQL Editor

-- 1. Verificar se as empresas existem e têm dados
SELECT 
    id,
    name,
    plan_id,
    current_storage_used_bytes,
    current_download_used_bytes,
    active_users_count,
    status
FROM public.companies
ORDER BY name;

-- 2. Verificar se existem planos criados
SELECT * FROM plans ORDER BY price_brl;

-- 3. Verificar se existe um plano "Free Trial"
SELECT * FROM plans WHERE name ILIKE '%trial%' OR name ILIKE '%free%';

-- 4. Verificar se as empresas têm arquivos uploadados
SELECT 
    c.name as company_name,
    COUNT(f.id) as total_files,
    SUM(f.file_size) as total_bytes,
    ROUND(SUM(f.file_size)::NUMERIC / 1073741824, 2) as total_gb
FROM public.companies c
LEFT JOIN public.files f ON f.company_id = c.id
GROUP BY c.id, c.name
ORDER BY c.name;

-- 5. Testar a função get_company_usage para cada empresa
DO $$
DECLARE
    company_rec RECORD;
    usage_result JSON;
BEGIN
    FOR company_rec IN SELECT id, name FROM public.companies ORDER BY name LOOP
        SELECT get_company_usage(company_rec.id) INTO usage_result;
        RAISE NOTICE 'Empresa: % | Resultado: %', company_rec.name, usage_result::TEXT;
    END LOOP;
END $$;

-- 6. Verificar se as empresas estão em trial e os limites
SELECT 
    c.name,
    c.plan_id,
    c.is_trial_active,
    c.trial_started_at,
    c.trial_ends_at,
    c.current_storage_used_bytes,
    c.current_download_used_bytes,
    p.name as plan_name,
    p.storage_limit_gb,
    p.download_limit_gb
FROM public.companies c
LEFT JOIN plans p ON c.plan_id = p.id
ORDER BY c.name;

-- 7. Verificar se há um plano "Free Trial" criado - se não, criar
INSERT INTO plans (name, price_brl, storage_limit_gb, download_limit_gb, max_users)
SELECT 'Free Trial', 0.00, 10, 3, 2
WHERE NOT EXISTS (
    SELECT 1 FROM plans WHERE name = 'Free Trial'
);

-- 8. Atualizar empresas que não têm plano para usar Free Trial
UPDATE public.companies 
SET plan_id = (SELECT id FROM plans WHERE name = 'Free Trial' LIMIT 1)
WHERE plan_id IS NULL;

-- 9. Verificar se a atualização funcionou
SELECT 
    c.name,
    c.plan_id,
    p.name as plan_name,
    p.storage_limit_gb,
    p.download_limit_gb,
    p.price_brl
FROM public.companies c
LEFT JOIN plans p ON c.plan_id = p.id
ORDER BY c.name;
