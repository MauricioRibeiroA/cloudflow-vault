-- Função para deletar convites pendentes
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

-- Permitir que apenas usuários autenticados com as permissões adequadas executem esta função
REVOKE ALL ON FUNCTION delete_invitation FROM PUBLIC;
GRANT EXECUTE ON FUNCTION delete_invitation TO authenticated;

-- Comentário da função
COMMENT ON FUNCTION delete_invitation IS 'Função para deletar convites pendentes de usuários. Apenas convites com status pending ou email_sent podem ser deletados.';
