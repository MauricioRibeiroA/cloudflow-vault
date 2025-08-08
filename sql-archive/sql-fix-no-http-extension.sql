-- ==================================================
-- CORREÇÃO: ALTERNATIVA SEM EXTENSÃO HTTP
-- ==================================================
-- A extensão HTTP não está disponível no Supabase
-- Vamos usar uma abordagem diferente
-- ==================================================

-- FUNÇÃO SIMPLIFICADA QUE CRIA CONVITE E RETORNA DADOS PARA O FRONTEND
-- O frontend então chama a Edge Function diretamente
-- ==================================================
CREATE OR REPLACE FUNCTION public.admin_create_user_with_email(
  p_email TEXT,
  p_full_name TEXT,
  p_group_name TEXT DEFAULT 'user',
  p_department_id UUID DEFAULT NULL,
  p_position_id UUID DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  target_company_id UUID;
  company_name TEXT;
  invite_link TEXT;
  result jsonb;
  invitation_id UUID;
BEGIN
  -- Verificar permissões
  IF NOT (public.is_company_admin() OR public.is_super_admin()) THEN
    RAISE EXCEPTION 'Access denied: admin privileges required';
  END IF;
  
  -- Obter company_id e nome da empresa
  SELECT id, name INTO target_company_id, company_name
  FROM public.companies 
  WHERE id = public.get_user_company_id();
  
  IF target_company_id IS NULL THEN
    RAISE EXCEPTION 'Company ID is required';
  END IF;

  -- Verificar se email já existe
  IF EXISTS (SELECT 1 FROM public.profiles WHERE email = p_email) THEN
    RAISE EXCEPTION 'Email already exists in profiles: %', p_email;
  END IF;

  IF EXISTS (SELECT 1 FROM public.user_invitations WHERE email = p_email AND status IN ('pending', 'email_sent')) THEN
    RAISE EXCEPTION 'Pending invitation already exists for email: %', p_email;
  END IF;

  -- Criar convite com expiração de 24 HORAS
  INSERT INTO public.user_invitations (
    email, full_name, group_name, company_id, department_id, position_id,
    status, invited_by, expires_at
  ) VALUES (
    p_email, p_full_name, p_group_name, target_company_id, 
    p_department_id, p_position_id, 'pending', auth.uid(), 
    NOW() + INTERVAL '24 hours'
  ) RETURNING id INTO invitation_id;

  -- Preparar dados para retorno (frontend fará a chamada do email)
  invite_link := 'https://cloudflow-vault.lovable.app/complete-signup?email=' || p_email;

  -- Retornar dados para que o frontend possa enviar o email
  result := jsonb_build_object(
    'success', true,
    'email', p_email,
    'full_name', p_full_name,
    'message', 'Convite criado. Preparando envio de email...',
    'email_sent', false,  -- Frontend vai mudar isso
    'status', 'pending',
    'expires_in_hours', 24,
    'invitation_id', invitation_id,
    'company_name', COALESCE(company_name, 'CloudFlow Vault'),
    'invite_link', invite_link,
    'should_send_email', true  -- Sinaliza para o frontend enviar email
  );

  RETURN result;

EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'Error creating user invitation: %', SQLERRM;
END;
$$;

-- FUNÇÃO PARA ATUALIZAR STATUS DO CONVITE APÓS ENVIO DE EMAIL
-- ==================================================
CREATE OR REPLACE FUNCTION public.update_invitation_email_status(
  p_invitation_id UUID,
  p_email_sent BOOLEAN,
  p_email_id TEXT DEFAULT NULL,
  p_error_message TEXT DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  invitation_record user_invitations%ROWTYPE;
BEGIN
  -- Buscar o convite
  SELECT * INTO invitation_record
  FROM public.user_invitations
  WHERE id = p_invitation_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Convite não encontrado'
    );
  END IF;
  
  -- Atualizar status
  IF p_email_sent THEN
    UPDATE public.user_invitations 
    SET status = 'email_sent',
        updated_at = NOW()
    WHERE id = p_invitation_id;
    
    RETURN jsonb_build_object(
      'success', true,
      'message', 'Status atualizado: email enviado',
      'email_id', p_email_id
    );
  ELSE
    -- Email falhou, manter como pending
    RETURN jsonb_build_object(
      'success', true,
      'message', 'Email falhou, convite permanece pendente',
      'error', p_error_message
    );
  END IF;
  
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM
  );
END;
$$;

-- CONFIGURAR PERMISSÕES
-- ==================================================
GRANT EXECUTE ON FUNCTION public.admin_create_user_with_email TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_invitation_email_status TO authenticated;

-- COMENTÁRIOS
-- ==================================================
COMMENT ON FUNCTION public.admin_create_user_with_email IS 
'Cria convite com expiração de 24h. Retorna dados para o frontend enviar email via Edge Function diretamente.';

COMMENT ON FUNCTION public.update_invitation_email_status IS 
'Atualiza status do convite após tentativa de envio de email pelo frontend.';

-- ==================================================
-- INSTRUÇÕES DE USO
-- ==================================================

-- 1. Esta função cria o convite e retorna should_send_email: true
-- 2. O frontend deve então chamar a Edge Function diretamente
-- 3. Após resultado do email, frontend chama update_invitation_email_status
-- 4. Assim evitamos o problema da extensão HTTP no PostgreSQL

-- ==================================================
