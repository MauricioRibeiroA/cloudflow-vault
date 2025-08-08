-- ==================================================
-- GERENCIAMENTO COMPLETO DE CONVITES - CLOUDFLOW VAULT
-- ==================================================
-- Este arquivo contém todas as funções necessárias para:
-- 1. Deletar convites pendentes individualmente
-- 2. Limpar convites expirados automaticamente
-- 3. Enviar emails de convite (já existe)
-- 4. Reenviar emails de convite (já existe)
-- ==================================================

-- 1. FUNÇÃO PARA DELETAR CONVITES PENDENTES
-- ==================================================
CREATE OR REPLACE FUNCTION delete_invitation(p_invitation_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    invitation_record user_invitations%ROWTYPE;
    result JSON;
BEGIN
    -- Verificar se o convite existe e capturar os dados antes de deletar
    SELECT * INTO invitation_record
    FROM user_invitations
    WHERE id = p_invitation_id
    AND status IN ('pending', 'email_sent');
    
    -- Se o convite não existe ou já foi usado
    IF NOT FOUND THEN
        RETURN json_build_object(
            'success', false,
            'message', 'Convite não encontrado ou já foi utilizado'
        );
    END IF;
    
    -- Deletar o convite
    DELETE FROM user_invitations
    WHERE id = p_invitation_id;
    
    -- Verificar se foi deletado
    IF NOT FOUND THEN
        RETURN json_build_object(
            'success', false,
            'message', 'Erro ao deletar o convite'
        );
    END IF;
    
    -- Retornar sucesso com informações do convite deletado
    RETURN json_build_object(
        'success', true,
        'message', 'Convite deletado com sucesso',
        'deleted_invitation', json_build_object(
            'id', invitation_record.id,
            'email', invitation_record.email,
            'full_name', invitation_record.full_name,
            'deleted_at', NOW()
        )
    );
    
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'success', false,
            'message', 'Erro interno: ' || SQLERRM
        );
END;
$$;

-- 2. FUNÇÃO PARA LIMPAR CONVITES EXPIRADOS AUTOMATICAMENTE
-- ==================================================
CREATE OR REPLACE FUNCTION cleanup_expired_invitations()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    expired_count INTEGER := 0;
    deleted_invitations JSON[];
    invitation_record user_invitations%ROWTYPE;
BEGIN
    -- Capturar todos os convites expirados antes de deletar
    FOR invitation_record IN
        SELECT * FROM user_invitations
        WHERE status IN ('pending', 'email_sent')
        AND expires_at < NOW()
    LOOP
        -- Adicionar ao array de convites deletados
        deleted_invitations := array_append(
            deleted_invitations,
            json_build_object(
                'id', invitation_record.id,
                'email', invitation_record.email,
                'full_name', invitation_record.full_name,
                'expired_at', invitation_record.expires_at,
                'deleted_at', NOW()
            )
        );
        expired_count := expired_count + 1;
    END LOOP;
    
    -- Deletar todos os convites expirados
    DELETE FROM user_invitations
    WHERE status IN ('pending', 'email_sent')
    AND expires_at < NOW();
    
    -- Retornar resultado
    RETURN json_build_object(
        'success', true,
        'message', 'Limpeza de convites expirados concluída',
        'deleted_count', expired_count,
        'deleted_invitations', array_to_json(deleted_invitations),
        'cleaned_at', NOW()
    );
    
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'success', false,
            'message', 'Erro ao limpar convites expirados: ' || SQLERRM,
            'cleaned_at', NOW()
        );
END;
$$;

-- 3. CONFIGURAR PERMISSÕES
-- ==================================================

-- Permitir que apenas usuários autenticados executem as funções
REVOKE ALL ON FUNCTION delete_invitation FROM PUBLIC;
GRANT EXECUTE ON FUNCTION delete_invitation TO authenticated;

REVOKE ALL ON FUNCTION cleanup_expired_invitations FROM PUBLIC;
GRANT EXECUTE ON FUNCTION cleanup_expired_invitations TO authenticated;

-- 4. ADICIONAR COMENTÁRIOS PARA DOCUMENTAÇÃO
-- ==================================================

COMMENT ON FUNCTION delete_invitation IS 'Função para deletar convites pendentes de usuários. Apenas convites com status pending ou email_sent podem ser deletados.';

COMMENT ON FUNCTION cleanup_expired_invitations IS 'Função para limpar automaticamente convites que expiraram (mais de 24 horas). Pode ser chamada manualmente ou configurada em um cron job.';

-- ==================================================
-- INSTRUÇÕES DE USO
-- ==================================================

-- Para deletar um convite específico:
-- SELECT delete_invitation('uuid-do-convite-aqui');

-- Para limpar todos os convites expirados:
-- SELECT cleanup_expired_invitations();

-- ==================================================
-- EXEMPLO DE CONFIGURAÇÃO DE LIMPEZA AUTOMÁTICA
-- ==================================================

-- Para configurar limpeza automática com pg_cron (se disponível):
-- SELECT cron.schedule('cleanup-expired-invitations', '0 2 * * *', 'SELECT cleanup_expired_invitations();');

-- Isso executará a limpeza todos os dias às 2:00 AM
-- ==================================================
