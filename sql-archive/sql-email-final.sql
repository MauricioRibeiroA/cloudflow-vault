-- ===== SQL FINAL PARA ATIVAR ENVIO AUTOMÁTICO DE EMAIL =====

-- Primeiro, vamos obter a URL do seu projeto
-- Execute: npx supabase status para ver a URL remota
-- Seu projeto ID parece ser: hklknoybvonvzwfjvqjl

-- ===== FUNÇÃO ATUALIZADA COM URLs CORRETAS =====

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

  -- Criar convite
  INSERT INTO public.user_invitations (
    email, full_name, group_name, company_id, department_id, position_id,
    status, invited_by, expires_at
  ) VALUES (
    p_email, p_full_name, p_group_name, target_company_id, 
    p_department_id, p_position_id, 'pending', auth.uid(), NOW() + INTERVAL '7 days'
  );

  -- Definir URLs baseadas no ambiente
  -- Para produção, ajuste estas URLs conforme necessário
  project_url := 'https://hklknoybvonvzwfjvqjl.supabase.co';
  invite_link := 'https://cloudflow-vault.vercel.app/complete-signup?email=' || p_email;

  -- Tentar chamar Edge Function para enviar email
  BEGIN
    SELECT content::jsonb INTO email_response
    FROM http_post(
      project_url || '/functions/v1/send-invitation-email',
      json_build_object(
        'email', p_email,
        'fullName', p_full_name,
        'companyName', company_name,
        'inviteLink', invite_link
      )::text,
      'application/json',
      ARRAY[
        http_header('Authorization', 'Bearer ' || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhrbGtub3lidm9udnp3Zmp2cWpsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzAyMjc0MDEsImV4cCI6MjA0NTgwMzQwMX0.WXJFR3iWKPv8T0YZNaSDx5dvGV9Q4w-gAJzfHgNGOA0'),
        http_header('Content-Type', 'application/json')
      ]
    );
    
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
        'status', 'pending',
        'email_error', email_response->>'error'
      );
    END IF;
    
  EXCEPTION WHEN OTHERS THEN
    -- Se falhar completamente, ainda criar o convite
    result := jsonb_build_object(
      'success', true,
      'email', p_email,
      'full_name', p_full_name,
      'message', 'Usuário criado, mas falha ao enviar email. Link: ' || invite_link,
      'email_sent', false,
      'invite_link', invite_link,
      'status', 'pending',
      'email_error', SQLERRM
    );
  END;

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

-- ===== HABILITAR EXTENSÃO HTTP SE NÃO EXISTIR =====
CREATE EXTENSION IF NOT EXISTS http;

-- ===== PERMISSÕES =====
GRANT EXECUTE ON FUNCTION public.admin_create_user_with_email TO authenticated;

-- ===== COMENTÁRIOS =====
COMMENT ON FUNCTION public.admin_create_user_with_email IS 'Creates user invitation and automatically sends invitation email via Edge Function';

-- ===== INSTRUÇÕES =====
/*
IMPORTANTE: Para funcionar completamente, você precisa:

1. ✅ RESEND_API_KEY configurada no Supabase (FEITO)
2. ✅ Edge Function deployada (FEITO) 
3. ✅ Este SQL executado (FAZER AGORA)
4. ✅ Atualizar o frontend para usar a nova função (PRÓXIMO PASSO)

Após executar este SQL, o sistema enviará emails automaticamente!
*/
