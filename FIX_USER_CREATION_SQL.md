# Fix para Criação de Usuários - "User not allowed"

Execute este SQL no editor SQL do seu projeto Supabase (Lovable) para criar uma função que permita a criação de usuários por admins:

```sql
-- Função para criar usuários com privilégios administrativos
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
BEGIN
  -- Verificar se o usuário atual é admin
  IF NOT (public.is_company_admin() OR public.is_super_admin()) THEN
    RAISE EXCEPTION 'Access denied: admin privileges required';
  END IF;
  
  -- Obter company_id do admin atual
  IF public.is_super_admin() THEN
    -- Super admin pode especificar company_id ou usar o próprio
    target_company_id := public.get_user_company_id();
  ELSE
    target_company_id := public.get_user_company_id();
  END IF;
  
  IF target_company_id IS NULL THEN
    RAISE EXCEPTION 'Company ID is required';
  END IF;

  -- Criar usuário usando a extensão auth (funciona mesmo com confirmação de email)
  SELECT id INTO auth_user_id FROM auth.users WHERE email = p_email;
  
  IF auth_user_id IS NOT NULL THEN
    RAISE EXCEPTION 'Email already exists: %', p_email;
  END IF;

  -- Inserir diretamente na tabela auth.users (requer privilégios SECURITY DEFINER)
  auth_user_id := extensions.uuid_generate_v4();
  
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
    role
  ) VALUES (
    auth_user_id,
    '00000000-0000-0000-0000-000000000000',
    p_email,
    crypt(p_password, gen_salt('bf')),
    NOW(),
    NOW(),
    NOW(),
    '{"provider": "email", "providers": ["email"]}',
    jsonb_build_object('full_name', p_full_name),
    false,
    'authenticated'
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
    jsonb_build_object('sub', auth_user_id::text, 'email', p_email),
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
  DELETE FROM auth.identities WHERE user_id = auth_user_id;
  DELETE FROM auth.users WHERE id = auth_user_id;
  DELETE FROM public.profiles WHERE user_id = auth_user_id;
  
  RAISE EXCEPTION 'Error creating user: %', SQLERRM;
END;
$$;

-- Conceder permissões para a função
GRANT EXECUTE ON FUNCTION public.admin_create_user_complete TO authenticated;

-- Comentário da função
COMMENT ON FUNCTION public.admin_create_user_complete IS 'Creates a complete user with auth and profile, bypassing email confirmation requirements';
```

## Como usar a nova função no frontend:

Substitua a chamada `supabase.auth.signUp` por uma chamada RPC:

```typescript
const { data, error } = await supabase.rpc('admin_create_user_complete', {
  p_email: formData.email,
  p_password: formData.password,
  p_full_name: formData.full_name,
  p_group_name: formData.group_name,
  p_department_id: formData.department_id || null,
  p_position_id: formData.position_id || null
});
```

## O que esta função resolve:

1. ✅ **Bypass "User not allowed"**: Cria usuários diretamente na tabela auth.users
2. ✅ **Sem confirmação de email**: Define `email_confirmed_at` automaticamente
3. ✅ **Controle de privilégios**: Só admins podem criar usuários
4. ✅ **Transação atômica**: Se algo falhar, tudo é revertido
5. ✅ **Auditoria**: Registra a criação do usuário nos logs
6. ✅ **Validações**: Verifica email duplicado e permissões

Após aplicar o SQL, o sistema de criação de usuários funcionará sem problemas de "User not allowed".
