-- ===== FUNÇÃO ATUALIZADA PARA CRIAR USUÁRIO E ENVIAR EMAIL =====

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
  email_response jsonb;
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

  IF EXISTS (SELECT 1 FROM public.user_invitations WHERE email = p_email AND status = 'pending') THEN
    RAISE EXCEPTION 'Pending invitation already exists for email: %', p_email;
  END IF;

  -- Criar convite
  INSERT INTO public.user_invitations (
    email, full_name, group_name, company_id, department_id, position_id,
    status, invited_by, expires_at
  ) VALUES (
    p_email, p_full_name, p_group_name, target_company_id, 
    p_department_id, p_position_id, 'pending', auth.uid(), NOW() + INTERVAL '7 days'
  );

  -- Gerar link de convite
  invite_link := 'https://seu-dominio.com/complete-signup?email=' || encode(p_email::bytea, 'base64');

  -- Chamar Edge Function para enviar email
  SELECT INTO email_response
    net.http_post(
      url := 'https://seu-projeto.supabase.co/functions/v1/send-invitation-email',
      headers := json_build_object(
        'Authorization', 'Bearer ' || current_setting('app.supabase_service_role_key', true),
        'Content-Type', 'application/json'
      )::jsonb,
      body := json_build_object(
        'email', p_email,
        'fullName', p_full_name,
        'companyName', company_name,
        'inviteLink', invite_link
      )::jsonb
    ) as response;

  -- Verificar se o email foi enviado com sucesso
  IF email_response->>'success' = 'true' THEN
    -- Atualizar status do convite para indicar que o email foi enviado
    UPDATE public.user_invitations 
    SET status = 'email_sent'
    WHERE email = p_email AND status = 'pending';
    
    result := jsonb_build_object(
      'success', true,
      'email', p_email,
      'full_name', p_full_name,
      'message', 'Usuário criado e email de convite enviado com sucesso!',
      'email_sent', true,
      'status', 'email_sent'
    );
  ELSE
    -- Email falhou, mas convite foi criado
    result := jsonb_build_object(
      'success', true,
      'email', p_email,
      'full_name', p_full_name,
      'message', 'Usuário criado, mas falha ao enviar email. Link: ' || invite_link,
      'email_sent', false,
      'invite_link', invite_link,
      'status', 'pending'
    );
  END IF;

  RETURN result;

EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'Error creating user invitation: %', SQLERRM;
END;
$$;

-- ===== ATUALIZAR TABELA DE CONVITES PARA INCLUIR STATUS DE EMAIL =====

ALTER TABLE public.user_invitations 
DROP CONSTRAINT IF EXISTS user_invitations_status_check;

ALTER TABLE public.user_invitations 
ADD CONSTRAINT user_invitations_status_check 
CHECK (status IN ('pending', 'email_sent', 'accepted', 'expired'));

-- ===== FUNÇÃO PARA REENVIAR EMAIL DE CONVITE =====

CREATE OR REPLACE FUNCTION public.resend_invitation_email(p_email TEXT)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  invitation_record RECORD;
  company_name TEXT;
  invite_link TEXT;
  email_response jsonb;
  result jsonb;
BEGIN
  -- Verificar permissões
  IF NOT (public.is_company_admin() OR public.is_super_admin()) THEN
    RAISE EXCEPTION 'Access denied: admin privileges required';
  END IF;
  
  -- Buscar convite pendente
  SELECT ui.*, c.name as company_name 
  INTO invitation_record
  FROM public.user_invitations ui
  JOIN public.companies c ON ui.company_id = c.id
  WHERE ui.email = p_email 
    AND ui.status IN ('pending', 'email_sent')
    AND ui.expires_at > NOW()
    AND ui.company_id = public.get_user_company_id();
    
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No valid invitation found for email: %', p_email;
  END IF;

  -- Gerar novo link de convite
  invite_link := 'https://seu-dominio.com/complete-signup?email=' || encode(p_email::bytea, 'base64');

  -- Chamar Edge Function para enviar email
  SELECT INTO email_response
    net.http_post(
      url := 'https://seu-projeto.supabase.co/functions/v1/send-invitation-email',
      headers := json_build_object(
        'Authorization', 'Bearer ' || current_setting('app.supabase_service_role_key', true),
        'Content-Type', 'application/json'
      )::jsonb,
      body := json_build_object(
        'email', p_email,
        'fullName', invitation_record.full_name,
        'companyName', invitation_record.company_name,
        'inviteLink', invite_link
      )::jsonb
    ) as response;

  -- Atualizar timestamp do convite
  UPDATE public.user_invitations 
  SET 
    status = 'email_sent',
    updated_at = NOW()
  WHERE email = p_email AND company_id = public.get_user_company_id();

  result := jsonb_build_object(
    'success', true,
    'message', 'Email de convite reenviado com sucesso!',
    'email', p_email
  );

  RETURN result;

EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'Error resending invitation: %', SQLERRM;
END;
$$;

-- ===== PERMISSÕES =====

GRANT EXECUTE ON FUNCTION public.admin_create_user_with_email TO authenticated;
GRANT EXECUTE ON FUNCTION public.resend_invitation_email TO authenticated;

-- ===== COMENTÁRIOS =====

COMMENT ON FUNCTION public.admin_create_user_with_email IS 'Creates user invitation and automatically sends invitation email';
COMMENT ON FUNCTION public.resend_invitation_email IS 'Resends invitation email for pending invitations';
