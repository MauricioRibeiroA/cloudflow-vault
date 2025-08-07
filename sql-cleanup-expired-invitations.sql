-- Função para limpar convites expirados automaticamente
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

-- Permitir que apenas usuários autenticados executem esta função
REVOKE ALL ON FUNCTION cleanup_expired_invitations FROM PUBLIC;
GRANT EXECUTE ON FUNCTION cleanup_expired_invitations TO authenticated;

-- Comentário da função
COMMENT ON FUNCTION cleanup_expired_invitations IS 'Função para limpar automaticamente convites que expiraram (mais de 24 horas). Pode ser chamada manualmente ou configurada em um cron job.';
