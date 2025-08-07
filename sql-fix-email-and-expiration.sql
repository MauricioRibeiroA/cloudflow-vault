-- ==================================================
-- CORREÇÃO FINAL: EMAIL + EXPIRAÇÃO 24H
-- ==================================================
-- Este SQL corrige dois problemas:
-- 1. Emails não estão sendo enviados (mesmo com RESEND_API_KEY)
-- 2. Expiração ainda está em 7 dias (deve ser 24 horas)
-- ==================================================

-- 1. HABILITAR EXTENSÃO HTTP (necessária para enviar emails)
-- ==================================================
CREATE EXTENSION IF NOT EXISTS http;

-- 2. ATUALIZAR FUNÇÃO PARA EXPIRAÇÃO 24H E ENVIO DE EMAIL
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
  email_response jsonb;
  project_url TEXT;
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

  -- Criar convite com expiração de 24 HORAS (não 7 dias)
  INSERT INTO public.user_invitations (
    email, full_name, group_name, company_id, department_id, position_id,
    status, invited_by, expires_at
  ) VALUES (
    p_email, p_full_name, p_group_name, target_company_id, 
    p_department_id, p_position_id, 'pending', auth.uid(), 
    NOW() + INTERVAL '24 hours'  -- ✅ CORRIGIDO: 24 HORAS EM VEZ DE 7 DIAS
  ) RETURNING id INTO invitation_id;

  -- Definir URLs do projeto
  project_url := 'https://hklknoybvonvzwfjvqjl.supabase.co';
  invite_link := 'https://cloudflow-vault.vercel.app/complete-signup?email=' || p_email;

  -- Tentar enviar email via Edge Function
  BEGIN
    SELECT content::jsonb INTO email_response
    FROM http_post(
      project_url || '/functions/v1/send-invitation-email',
      json_build_object(
        'email', p_email,
        'fullName', p_full_name,
        'companyName', COALESCE(company_name, 'CloudFlow Vault'),
        'inviteLink', invite_link
      )::text,
      'application/json',
      ARRAY[
        http_header('Authorization', 'Bearer ' || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhrbGtub3lidm9udnp3Zmp2cWpsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzAyMjc0MDEsImV4cCI6MjA0NTgwMzQwMX0.WXJFR3iWKPv8T0YZNaSDx5dvGV9Q4w-gAJzfHgNGOA0'),
        http_header('Content-Type', 'application/json'),
        http_header('apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhrbGtub3lidm9udnp3Zmp2cWpsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzAyMjc0MDEsImV4cCI6MjA0NTgwMzQwMX0.WXJFR3iWKPv8T0YZNaSDx5dvGV9Q4w-gAJzfHgNGOA0')
      ]
    );
    
    -- Verificar resposta do email
    IF email_response->>'success' = 'true' OR email_response->>'status' = 'success' THEN
      -- Email enviado com sucesso
      UPDATE public.user_invitations 
      SET status = 'email_sent'
      WHERE id = invitation_id;
      
      result := jsonb_build_object(
        'success', true,
        'email', p_email,
        'full_name', p_full_name,
        'message', 'Usuário criado e email de convite enviado com sucesso!',
        'email_sent', true,
        'status', 'email_sent',
        'expires_in_hours', 24
      );
    ELSE
      -- Email falhou
      result := jsonb_build_object(
        'success', true,
        'email', p_email,
        'full_name', p_full_name,
        'message', 'Usuário criado, mas falha ao enviar email. Verifique a configuração do RESEND_API_KEY.',
        'email_sent', false,
        'invite_link', invite_link,
        'status', 'pending',
        'expires_in_hours', 24,
        'email_error', COALESCE(email_response->>'error', 'Email service error')
      );
    END IF;
    
  EXCEPTION WHEN OTHERS THEN
    -- Erro na chamada HTTP
    result := jsonb_build_object(
      'success', true,
      'email', p_email,
      'full_name', p_full_name,
      'message', 'Usuário criado, mas falha na conexão com serviço de email. Link manual: ' || invite_link,
      'email_sent', false,
      'invite_link', invite_link,
      'status', 'pending',
      'expires_in_hours', 24,
      'email_error', 'HTTP Error: ' || SQLERRM
    );
  END;

  RETURN result;

EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'Error creating user invitation: %', SQLERRM;
END;
$$;

-- 3. GARANTIR QUE TABELA SUPORTE O STATUS EMAIL_SENT
-- ==================================================
ALTER TABLE public.user_invitations 
DROP CONSTRAINT IF EXISTS user_invitations_status_check;

ALTER TABLE public.user_invitations 
ADD CONSTRAINT user_invitations_status_check 
CHECK (status IN ('pending', 'email_sent', 'accepted', 'expired'));

-- 4. CONFIGURAR PERMISSÕES
-- ==================================================
GRANT EXECUTE ON FUNCTION public.admin_create_user_with_email TO authenticated;

-- 5. COMENTÁRIOS E DOCUMENTAÇÃO
-- ==================================================
COMMENT ON FUNCTION public.admin_create_user_with_email IS 
'Cria convite de usuário com expiração de 24 horas e envia email automaticamente via Edge Function. Requer RESEND_API_KEY configurada no Supabase Secrets.';

-- ==================================================
-- INSTRUÇÕES PÓS-EXECUÇÃO
-- ==================================================

-- ✅ TESTE A FUNÇÃO:
-- SELECT public.admin_create_user_with_email('teste@exemplo.com', 'Usuario Teste', 'user');

-- ✅ VERIFIQUE OS CONVITES:
-- SELECT id, email, full_name, status, expires_at, 
--        (expires_at > NOW()) as is_valid,
--        EXTRACT(EPOCH FROM (expires_at - created_at))/3600 as hours_to_expire
-- FROM user_invitations 
-- ORDER BY created_at DESC;

-- ✅ TESTE A LIMPEZA DE EXPIRADOS:
-- SELECT cleanup_expired_invitations();

-- ==================================================
