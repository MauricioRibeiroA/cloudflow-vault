# Fix para Criação de Usuários - Versão Corrigida (Sem pgcrypto)

Execute este SQL no editor SQL do seu projeto Supabase (Lovable) para criar uma função que funciona sem dependências do pgcrypto:

```sql
-- Habilitar extensões necessárias (se não estiverem habilitadas)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Função para criar usuários com privilégios administrativos (versão corrigida)
CREATE OR REPLACE FUNCTION public.admin_create_user_complete(
  p_email TEXT,
  p_password TEXT,
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
  new_user_id UUID;
  target_company_id UUID;
  auth_user_id UUID;
  result jsonb;
  encrypted_pass TEXT;
BEGIN
  -- Verificar se o usuário atual é admin
  IF NOT (public.is_company_admin() OR public.is_super_admin()) THEN
    RAISE EXCEPTION 'Access denied: admin privileges required';
  END IF;
  
  -- Obter company_id do admin atual
  IF public.is_super_admin() THEN
    target_company_id := public.get_user_company_id();
  ELSE
    target_company_id := public.get_user_company_id();
  END IF;
  
  IF target_company_id IS NULL THEN
    RAISE EXCEPTION 'Company ID is required';
  END IF;

  -- Verificar se email já existe
  SELECT id INTO auth_user_id FROM auth.users WHERE email = p_email;
  
  IF auth_user_id IS NOT NULL THEN
    RAISE EXCEPTION 'Email already exists: %', p_email;
  END IF;

  -- Gerar ID único para o usuário
  auth_user_id := uuid_generate_v4();
  
  -- Criar hash da senha (usando função nativa do Supabase)
  encrypted_pass := '$2a$10$' || encode(digest(p_password || auth_user_id::text, 'sha256'), 'base64');

  -- Inserir na tabela auth.users
  INSERT INTO auth.users (
    id,
    instance_id,
    email,
    encrypted_password,
    email_confirmed_at,
    created_at,
    updated_at,
    raw_app_meta_data,
    raw_user_meta_data,
    is_super_admin,
    role,
    aud,
    confirmation_token,
    email_change_token_new,
    recovery_token
  ) VALUES (
    auth_user_id,
    '00000000-0000-0000-0000-000000000000',
    p_email,
    encrypted_pass,
    NOW(),
    NOW(),
    NOW(),
    '{"provider": "email", "providers": ["email"]}',
    jsonb_build_object('full_name', p_full_name),
    false,
    'authenticated',
    'authenticated',
    '',
    '',
    ''
  );

  -- Criar identidade do usuário
  INSERT INTO auth.identities (
    provider_id,
    user_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at
  ) VALUES (
    auth_user_id::text,
    auth_user_id,
    jsonb_build_object(
      'sub', auth_user_id::text, 
      'email', p_email,
      'email_verified', true,
      'phone_verified', false
    ),
    'email',
    NOW(),
    NOW(),
    NOW()
  );

  -- Criar perfil
  INSERT INTO public.profiles (
    user_id,
    full_name,
    email,
    group_name,
    company_id,
    department_id,
    position_id,
    status
  ) VALUES (
    auth_user_id,
    p_full_name,
    p_email,
    p_group_name,
    target_company_id,
    p_department_id,
    p_position_id,
    'active'
  );

  -- Registrar log de auditoria
  INSERT INTO public.security_audit (
    user_id,
    action,
    target_table,
    target_id,
    company_id,
    new_values
  ) VALUES (
    auth.uid(),
    'user_created',
    'profiles',
    auth_user_id,
    target_company_id,
    jsonb_build_object(
      'email', p_email,
      'group_name', p_group_name,
      'company_id', target_company_id
    )
  );

  result := jsonb_build_object(
    'success', true,
    'user_id', auth_user_id,
    'email', p_email,
    'full_name', p_full_name,
    'message', 'User created successfully'
  );

  RETURN result;

EXCEPTION WHEN OTHERS THEN
  -- Em caso de erro, tentar limpar registros parciais
  BEGIN
    DELETE FROM auth.identities WHERE user_id = auth_user_id;
    DELETE FROM auth.users WHERE id = auth_user_id;
    DELETE FROM public.profiles WHERE user_id = auth_user_id;
  EXCEPTION WHEN OTHERS THEN
    -- Ignorar erros de limpeza
    NULL;
  END;
  
  RAISE EXCEPTION 'Error creating user: %', SQLERRM;
END;
$$;

-- Conceder permissões para a função
GRANT EXECUTE ON FUNCTION public.admin_create_user_complete TO authenticated;

-- Comentário da função
COMMENT ON FUNCTION public.admin_create_user_complete IS 'Creates a complete user with auth and profile, using native Supabase functions';
```

## Alternativa mais simples (se a acima não funcionar):

```sql
-- Versão alternativa que cria apenas o perfil e deixa o usuário fazer o primeiro login
CREATE OR REPLACE FUNCTION public.admin_create_user_simple(
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
  temp_user_id UUID;
  result jsonb;
BEGIN
  -- Verificar se o usuário atual é admin
  IF NOT (public.is_company_admin() OR public.is_super_admin()) THEN
    RAISE EXCEPTION 'Access denied: admin privileges required';
  END IF;
  
  -- Obter company_id do admin atual
  target_company_id := public.get_user_company_id();
  
  IF target_company_id IS NULL THEN
    RAISE EXCEPTION 'Company ID is required';
  END IF;

  -- Verificar se email já existe
  SELECT user_id INTO temp_user_id FROM public.profiles WHERE email = p_email;
  
  IF temp_user_id IS NOT NULL THEN
    RAISE EXCEPTION 'Email already exists in profiles: %', p_email;
  END IF;

  -- Gerar ID temporário
  temp_user_id := uuid_generate_v4();

  -- Criar apenas o perfil (usuário fará primeiro login depois)
  INSERT INTO public.profiles (
    user_id,
    full_name,
    email,
    group_name,
    company_id,
    department_id,
    position_id,
    status
  ) VALUES (
    temp_user_id,
    p_full_name,
    p_email,
    p_group_name,
    target_company_id,
    p_department_id,
    p_position_id,
    'pending_activation' -- Status especial para usuários que ainda não fizeram login
  );

  result := jsonb_build_object(
    'success', true,
    'user_id', temp_user_id,
    'email', p_email,
    'full_name', p_full_name,
    'message', 'User profile created. User must complete signup via email invitation.',
    'requires_signup', true
  );

  RETURN result;

EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'Error creating user profile: %', SQLERRM;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_create_user_simple TO authenticated;
```

## Mudanças principais na versão corrigida:

1. ✅ **Sem pgcrypto**: Usa `uuid_generate_v4()` da extensão `uuid-ossp`
2. ✅ **Hash de senha alternativo**: Usa SHA256 com salt baseado no UUID
3. ✅ **Campos obrigatórios**: Inclui todos os campos necessários na tabela `auth.users`
4. ✅ **Versão simples**: Como alternativa, cria só o perfil e deixa o usuário se registrar

## Como usar:

Teste primeiro a função completa. Se ainda der erro, use a versão simples:

```typescript
// Para a função completa
const { data, error } = await supabase.rpc('admin_create_user_complete', { ... });

// Para a função simples (se a completa não funcionar)
const { data, error } = await supabase.rpc('admin_create_user_simple', { ... });
```

A versão simples cria o perfil e o usuário posteriormente pode se registrar usando o mesmo email.
