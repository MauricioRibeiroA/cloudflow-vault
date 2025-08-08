-- =====================================================
-- CORREÇÃO LIMPA DA FUNÇÃO update_download_usage 
-- =====================================================

-- Recriar a função com debug e verificações mais robustas
CREATE OR REPLACE FUNCTION update_download_usage(company_uuid UUID, bytes_downloaded BIGINT)
RETURNS JSON AS $$
DECLARE
    company_data RECORD;
    update_result INTEGER := 0;
    current_user_company_id UUID;
BEGIN
    -- Debug: Log da entrada
    RAISE NOTICE 'update_download_usage chamada com: company_uuid=%, bytes_downloaded=%', company_uuid, bytes_downloaded;
    
    -- Verificar se a empresa existe
    SELECT current_download_used_bytes, download_reset_date, name
    INTO company_data
    FROM public.companies
    WHERE id = company_uuid;
    
    IF NOT FOUND THEN
        RAISE NOTICE 'Empresa não encontrada: %', company_uuid;
        RETURN json_build_object(
            'success', false, 
            'error', 'Company not found',
            'company_uuid', company_uuid
        );
    END IF;
    
    RAISE NOTICE 'Empresa encontrada: % | Download atual: % bytes | Reset date: %', 
        company_data.name, company_data.current_download_used_bytes, company_data.download_reset_date;
    
    -- Reset download mensal se necessário
    IF company_data.download_reset_date < DATE_TRUNC('month', NOW())::DATE THEN
        RAISE NOTICE 'Reset mensal necessário. Data atual: %, Reset date: %', 
            DATE_TRUNC('month', NOW())::DATE, company_data.download_reset_date;
            
        UPDATE public.companies
        SET 
            current_download_used_bytes = bytes_downloaded,
            download_reset_date = DATE_TRUNC('month', NOW())::DATE
        WHERE id = company_uuid;
        
        GET DIAGNOSTICS update_result = ROW_COUNT;
        RAISE NOTICE 'Reset mensal executado. Linhas afetadas: %', update_result;
    ELSE
        RAISE NOTICE 'Adicionando % bytes aos % bytes existentes', bytes_downloaded, company_data.current_download_used_bytes;
        
        UPDATE public.companies
        SET current_download_used_bytes = COALESCE(current_download_used_bytes, 0) + bytes_downloaded
        WHERE id = company_uuid;
        
        GET DIAGNOSTICS update_result = ROW_COUNT;
        RAISE NOTICE 'Update incremental executado. Linhas afetadas: %', update_result;
    END IF;
    
    -- Verificar o resultado
    IF update_result = 0 THEN
        RAISE NOTICE 'ERRO: Nenhuma linha foi atualizada!';
        
        -- Verificar RLS
        SELECT get_user_company_id() INTO current_user_company_id;
        RAISE NOTICE 'Company ID do usuário atual (RLS): %', current_user_company_id;
        
        RETURN json_build_object(
            'success', false,
            'error', 'No rows updated - possible RLS issue',
            'company_uuid', company_uuid,
            'user_company_id', current_user_company_id,
            'update_result', update_result
        );
    END IF;
    
    -- Verificar estado final
    SELECT current_download_used_bytes INTO company_data.current_download_used_bytes
    FROM public.companies
    WHERE id = company_uuid;
    
    RAISE NOTICE 'Estado final: % bytes de download usados', company_data.current_download_used_bytes;
    
    RETURN json_build_object(
        'success', true, 
        'bytes_downloaded', bytes_downloaded,
        'new_total', company_data.current_download_used_bytes,
        'update_result', update_result
    );
    
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'ERRO na função update_download_usage: %', SQLERRM;
    RETURN json_build_object(
        'success', false,
        'error', SQLERRM,
        'company_uuid', company_uuid,
        'bytes_downloaded', bytes_downloaded
    );
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- VERIFICAR POLICIES RLS EXISTENTES
-- =====================================================

SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename = 'companies';

-- =====================================================
-- CRIAR POLICY PARA UPDATES NA TABELA COMPANIES
-- =====================================================

DO $$
BEGIN
    -- Primeiro, dropar policy se existir
    BEGIN
        DROP POLICY IF EXISTS "Companies can update own data" ON public.companies;
        RAISE NOTICE 'Policy antiga removida (se existia)';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Nenhuma policy anterior para remover';
    END;
    
    -- Criar nova policy
    CREATE POLICY "Companies can update own data" ON public.companies
    FOR UPDATE USING (
        id = public.get_user_company_id() OR public.is_super_admin()
    );
    
    RAISE NOTICE 'Policy "Companies can update own data" criada com sucesso';
END $$;

-- =====================================================
-- TESTE SIMPLES DA FUNÇÃO
-- =====================================================

DO $$
DECLARE
    test_company_id UUID := '4eded551-af8f-40f0-b983-67d804ee2d11';
    result JSON;
    before_bytes BIGINT;
    after_bytes BIGINT;
    company_name TEXT;
BEGIN
    RAISE NOTICE '=== TESTE DA FUNÇÃO CORRIGIDA ===';
    
    -- Estado antes
    SELECT name, current_download_used_bytes 
    INTO company_name, before_bytes
    FROM companies 
    WHERE id = test_company_id;
    
    RAISE NOTICE 'Estado ANTES: Empresa % tinha % bytes de download usados', 
        company_name, before_bytes;
    
    -- Executar função
    RAISE NOTICE 'Executando update_download_usage com 1MB...';
    SELECT update_download_usage(test_company_id, 1000000) INTO result;
    
    RAISE NOTICE 'Resultado: %', result;
    
    -- Estado depois
    SELECT current_download_used_bytes 
    INTO after_bytes
    FROM companies 
    WHERE id = test_company_id;
    
    RAISE NOTICE 'Estado DEPOIS: Empresa % agora tem % bytes de download usados', 
        company_name, after_bytes;
    
    IF after_bytes > before_bytes THEN
        RAISE NOTICE '✅ SUCESSO: Download foi contabilizado!';
    ELSE
        RAISE NOTICE '❌ FALHA: Download NÃO foi contabilizado!';
    END IF;
END $$;
