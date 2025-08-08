-- =====================================================
-- DEBUG SCRIPT: INVESTIGAR PROBLEMA DE QUOTA DE DOWNLOAD
-- =====================================================

-- 1. Verificar logs de download recentes
SELECT 
    l.id,
    l.user_id,
    l.company_id,
    l.action,
    l.target_name,
    l.details->'file_size' as file_size_bytes,
    l.created_at,
    c.name as company_name
FROM logs l
LEFT JOIN companies c ON l.company_id = c.id
WHERE l.action = 'file_download'
    AND l.created_at > NOW() - INTERVAL '1 day'
ORDER BY l.created_at DESC
LIMIT 10;

-- 2. Verificar estado atual dos contadores da empresa
SELECT 
    c.id,
    c.name,
    c.current_storage_used_bytes,
    c.current_download_used_bytes,
    c.download_reset_date,
    p.name as plan_name,
    p.download_limit_gb
FROM companies c
LEFT JOIN plans p ON c.plan_id = p.id
WHERE c.name LIKE '%3dpine%' OR c.id IN (
    SELECT DISTINCT company_id FROM logs WHERE action = 'file_download'
);

-- 3. Testar a função update_download_usage manualmente
-- Primeiro buscar uma empresa que tem downloads recentes
DO $$
DECLARE
    test_company_id UUID;
    test_file_size BIGINT := 1048576; -- 1MB para teste
BEGIN
    -- Pegar ID da empresa que fez downloads
    SELECT DISTINCT company_id INTO test_company_id
    FROM logs 
    WHERE action = 'file_download' 
        AND company_id IS NOT NULL
        AND created_at > NOW() - INTERVAL '1 day'
    LIMIT 1;
    
    IF test_company_id IS NOT NULL THEN
        RAISE NOTICE 'Testando update_download_usage para empresa: %', test_company_id;
        
        -- Mostrar estado anterior
        RAISE NOTICE 'Estado antes:';
        PERFORM (
            SELECT RAISE(NOTICE, 'Download usado: % bytes', current_download_used_bytes)
            FROM companies WHERE id = test_company_id
        );
        
        -- Executar função de update
        PERFORM update_download_usage(test_company_id, test_file_size);
        
        -- Mostrar estado posterior
        RAISE NOTICE 'Estado depois:';
        PERFORM (
            SELECT RAISE(NOTICE, 'Download usado: % bytes', current_download_used_bytes)
            FROM companies WHERE id = test_company_id
        );
    ELSE
        RAISE NOTICE 'Nenhuma empresa com downloads recentes encontrada';
    END IF;
END $$;

-- 4. Verificar se a função update_download_usage existe e está correta
SELECT 
    proname as function_name,
    pg_get_function_result(oid) as return_type,
    pg_get_function_arguments(oid) as arguments
FROM pg_proc 
WHERE proname = 'update_download_usage';

-- 5. Simular um download real para debug
INSERT INTO logs (
    user_id,
    company_id,
    action,
    target_type,
    target_name,
    details
) 
SELECT 
    p.user_id,
    p.company_id,
    'file_download',
    'file',
    'debug_test_file.pdf',
    json_build_object(
        'file_size', 2097152,
        'backblaze_key', 'debug/test.pdf',
        'download_method', 'debug_test'
    )
FROM profiles p
WHERE p.company_id IS NOT NULL
    AND p.group_name = 'company_admin'
LIMIT 1;

-- 6. Testar chamada da função para essa simulação
DO $$
DECLARE
    test_company_id UUID;
    test_user_id UUID;
    result JSON;
BEGIN
    -- Buscar empresa e usuário do log de debug
    SELECT 
        company_id, user_id 
    INTO test_company_id, test_user_id
    FROM logs 
    WHERE target_name = 'debug_test_file.pdf'
        AND action = 'file_download'
    ORDER BY created_at DESC
    LIMIT 1;
    
    IF test_company_id IS NOT NULL THEN
        RAISE NOTICE 'Executando update_download_usage para: %', test_company_id;
        
        SELECT update_download_usage(test_company_id, 2097152) INTO result;
        
        RAISE NOTICE 'Resultado da função: %', result;
        
        -- Verificar se foi atualizado
        SELECT current_download_used_bytes 
        FROM companies 
        WHERE id = test_company_id;
    END IF;
END $$;

-- 7. Limpar dados de debug
DELETE FROM logs WHERE target_name = 'debug_test_file.pdf' AND details->>'download_method' = 'debug_test';
