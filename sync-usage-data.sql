-- Script para sincronizar dados reais de uso baseado nos arquivos
-- Execute no Supabase Dashboard -> SQL Editor

-- 1. Função para recalcular uso real de storage por empresa
CREATE OR REPLACE FUNCTION sync_company_storage_usage()
RETURNS TABLE(company_id UUID, company_name TEXT, files_count BIGINT, total_bytes BIGINT, updated BOOLEAN) AS $$
BEGIN
    RETURN QUERY
    WITH file_usage AS (
        SELECT 
            f.company_id,
            COUNT(f.id) as files_count,
            COALESCE(SUM(f.file_size), 0) as total_bytes
        FROM public.files f
        WHERE f.company_id IS NOT NULL
        GROUP BY f.company_id
    )
    UPDATE public.companies c
    SET current_storage_used_bytes = COALESCE(fu.total_bytes, 0)
    FROM file_usage fu
    WHERE c.id = fu.company_id
    RETURNING c.id, c.name, fu.files_count, fu.total_bytes, true;
END;
$$ LANGUAGE plpgsql;

-- 2. Executar sincronização
SELECT * FROM sync_company_storage_usage();

-- 3. Verificar empresas que não têm arquivos (zerar uso)
UPDATE public.companies 
SET current_storage_used_bytes = 0
WHERE id NOT IN (SELECT DISTINCT company_id FROM public.files WHERE company_id IS NOT NULL);

-- 4. Mostrar resultado da sincronização
SELECT 
    c.name as empresa,
    COUNT(f.id) as arquivos,
    COALESCE(SUM(f.file_size), 0) as bytes_reais,
    c.current_storage_used_bytes as bytes_registrados,
    ROUND(COALESCE(SUM(f.file_size), 0)::NUMERIC / 1073741824, 2) as gb_reais,
    ROUND(c.current_storage_used_bytes::NUMERIC / 1073741824, 2) as gb_registrados,
    CASE 
        WHEN COALESCE(SUM(f.file_size), 0) = c.current_storage_used_bytes THEN '✅ Sincronizado'
        ELSE '❌ Dessincronizado'
    END as status
FROM public.companies c
LEFT JOIN public.files f ON f.company_id = c.id
GROUP BY c.id, c.name, c.current_storage_used_bytes
ORDER BY c.name;

-- 5. Testar função get_company_usage após sincronização
DO $$
DECLARE
    company_rec RECORD;
    usage_result JSON;
BEGIN
    RAISE NOTICE '=== TESTE DA FUNÇÃO GET_COMPANY_USAGE APÓS SINCRONIZAÇÃO ===';
    FOR company_rec IN SELECT id, name FROM public.companies ORDER BY name LOOP
        SELECT get_company_usage(company_rec.id) INTO usage_result;
        RAISE NOTICE 'Empresa: % | Storage: % GB | Download: % GB | Limite Storage: % GB | Limite Download: % GB', 
            company_rec.name,
            (usage_result->>'storage_used_gb')::NUMERIC,
            (usage_result->>'download_used_gb')::NUMERIC,
            (usage_result->>'storage_limit_gb')::NUMERIC,
            (usage_result->>'download_limit_gb')::NUMERIC;
    END LOOP;
END $$;

-- 6. Limpar função temporária
DROP FUNCTION sync_company_storage_usage();
