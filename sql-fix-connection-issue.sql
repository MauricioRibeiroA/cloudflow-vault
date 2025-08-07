-- ==================================================
-- CORREÇÃO: PROBLEMA DE CONEXÃO COM EDGE FUNCTION
-- ==================================================
-- Baseado no erro: "falha na conexão com serviço de email"
-- ==================================================

-- 1. GARANTIR QUE EXTENSÃO HTTP ESTÁ HABILITADA
-- ==================================================
CREATE EXTENSION IF NOT EXISTS http;

-- 2. FUNÇÃO CORRIGIDA COM MELHOR TRATAMENTO DE CONEXÃO
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
  auth_header TEXT;
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

  -- URLs e configurações
  project_url := 'https://hklknoybvonvzwfjvqjl.supabase.co';
  invite_link := 'https://cloudflow-vault.vercel.app/complete-signup?email=' || p_email;
  
  -- Token de autorização (anon key)
  auth_header := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhrbGtub3lidm9udnp3Zmp2cWpsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzAyMjc0MDEsImV4cCI6MjA0NTgwMzQwMX0.WXJFR3iWKPv8T0YZNaSDx5dvGV9Q4w-gAJzfHgNGOA0';

  -- Tentar enviar email via Edge Function com timeout aumentado
  BEGIN
    RAISE NOTICE 'Tentando enviar email para: %', p_email;
    RAISE NOTICE 'URL da função: %', project_url || '/functions/v1/send-invitation-email';
    
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
        http_header('Authorization', 'Bearer ' || auth_header),
        http_header('Content-Type', 'application/json'),
        http_header('apikey', auth_header)
      ],
      30000  -- Timeout de 30 segundos
    );
    
    RAISE NOTICE 'Resposta do email service: %', email_response;
    
    -- Verificar resposta do email
    IF email_response->>'success' = 'true' OR email_response->>'message' = 'Email sent successfully' THEN
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
        'expires_in_hours', 24,
        'email_id', email_response->>'emailId'
      );
    ELSE
      -- Email falhou
      result := jsonb_build_object(
        'success', true,
        'email', p_email,
        'full_name', p_full_name,
        'message', 'Usuário criado, mas falha ao enviar email: ' || COALESCE(email_response->>'error', 'Erro desconhecido'),
        'email_sent', false,
        'invite_link', invite_link,
        'status', 'pending',
        'expires_in_hours', 24,
        'email_error', email_response,
        'debug_info', 'Email service response received but indicates failure'
      );
    END IF;
    
  EXCEPTION 
    WHEN http_request_failed THEN
      -- Erro específico de HTTP
      result := jsonb_build_object(
        'success', true,
        'email', p_email,
        'full_name', p_full_name,
        'message', 'Usuário criado, mas erro na requisição HTTP para envio de email. Link: ' || invite_link,
        'email_sent', false,
        'invite_link', invite_link,
        'status', 'pending',
        'expires_in_hours', 24,
        'email_error', 'HTTP_REQUEST_FAILED: Verifique se a Edge Function está deployada',
        'debug_info', 'HTTP request to Edge Function failed'
      );
    WHEN OTHERS THEN
      -- Outros erros
      result := jsonb_build_object(
        'success', true,
        'email', p_email,
        'full_name', p_full_name,
        'message', 'Usuário criado, mas erro na conexão com serviço de email. Link: ' || invite_link,
        'email_sent', false,
        'invite_link', invite_link,
        'status', 'pending',
        'expires_in_hours', 24,
        'email_error', 'CONNECTION_ERROR: ' || SQLERRM,
        'debug_info', 'Exception occurred during HTTP request'
      );
  END;

  RETURN result;

EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'Error creating user invitation: %', SQLERRM;
END;
$$;

-- 3. GARANTIR PERMISSÕES CORRETAS
-- ==================================================
GRANT EXECUTE ON FUNCTION public.admin_create_user_with_email TO authenticated;

-- 4. FUNÇÃO DE TESTE PARA DEBUG
-- ==================================================
CREATE OR REPLACE FUNCTION public.test_edge_function_connection()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  test_response jsonb;
  project_url TEXT := 'https://hklknoybvonvzwfjvqjl.supabase.co';
  auth_header TEXT := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhrbGtub3lidm9udnp3Zmp2cWpsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzAyMjc0MDEsImV4cCI6MjA0NTgwMzQwMX0.WXJFR3iWKPv8T0YZNaSDx5dvGV9Q4w-gAJzfHgNGOA0';
BEGIN
  SELECT content::jsonb INTO test_response
  FROM http_post(
    project_url || '/functions/v1/send-invitation-email',
    '{"email":"delivered@resend.dev","fullName":"Teste","companyName":"Teste","inviteLink":"https://teste.com"}',
    'application/json',
    ARRAY[
      http_header('Authorization', 'Bearer ' || auth_header),
      http_header('Content-Type', 'application/json'),
      http_header('apikey', auth_header)
    ],
    10000
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Conexão com Edge Function OK',
    'response', test_response
  );
  
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM,
    'message', 'Falha na conexão com Edge Function'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.test_edge_function_connection TO authenticated;

-- ==================================================
-- INSTRUÇÕES DE TESTE
-- ==================================================

-- 1. Primeiro teste a conexão:
-- SELECT public.test_edge_function_connection();

-- 2. Se o teste passar, teste a criação de usuário:
-- SELECT public.admin_create_user_with_email('teste@exemplo.com', 'Usuario Teste', 'user');

-- 3. Verifique os logs no Supabase Dashboard > Edge Functions > Logs

-- ==================================================
