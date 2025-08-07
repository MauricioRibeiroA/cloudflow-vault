# Fix Final para Criação de Usuários - Sem Extensões

Execute este SQL no editor SQL do seu projeto Supabase (Lovable) - esta versão usa apenas funções nativas do PostgreSQL/Supabase:

```sql
-- Função final para criar usuários - SEM extensões externas
CREATE OR REPLACE FUNCTION public.admin_create_user_simple_final(
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

  -- Gerar ID usando função nativa do PostgreSQL
  temp_user_id := gen_random_uuid();

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

  -- Log da ação (se a tabela existir)
  BEGIN
    INSERT INTO public.security_audit (
      user_id,
      action,
      target_table,
      target_id,
      company_id,
      new_values
    ) VALUES (
      auth.uid(),
      'user_profile_created',
      'profiles',
      temp_user_id,
      target_company_id,
      jsonb_build_object(
        'email', p_email,
        'group_name', p_group_name,
        'status', 'pending_activation'
      )
    );
  EXCEPTION WHEN OTHERS THEN
    -- Ignorar se tabela de audit não existir
    NULL;
  END;

  result := jsonb_build_object(
    'success', true,
    'user_id', temp_user_id,
    'email', p_email,
    'full_name', p_full_name,
    'message', 'User profile created successfully. User must complete signup using the same email.',
    'requires_signup', true,
    'status', 'pending_activation'
  );

  RETURN result;

EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'Error creating user profile: %', SQLERRM;
END;
$$;

-- Conceder permissões para a função
GRANT EXECUTE ON FUNCTION public.admin_create_user_simple_final TO authenticated;

-- Comentário da função
COMMENT ON FUNCTION public.admin_create_user_simple_final IS 'Creates user profile only - user completes auth signup separately';

-- Função adicional para listar usuários com status pending_activation
CREATE OR REPLACE FUNCTION public.get_pending_users()
RETURNS TABLE (
  user_id UUID,
  full_name TEXT,
  email TEXT,
  group_name TEXT,
  department_name TEXT,
  position_name TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE SQL
SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT 
    p.user_id,
    p.full_name,
    p.email,
    p.group_name,
    d.name as department_name,
    pos.name as position_name,
    p.created_at
  FROM public.profiles p
  LEFT JOIN public.departments d ON p.department_id = d.id
  LEFT JOIN public.positions pos ON p.position_id = pos.id
  WHERE p.status = 'pending_activation'
    AND (
      (public.is_super_admin()) OR 
      (public.is_company_admin() AND p.company_id = public.get_user_company_id())
    )
  ORDER BY p.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_pending_users TO authenticated;

-- Função para ativar usuários após eles se registrarem
CREATE OR REPLACE FUNCTION public.activate_user_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Quando um usuário é criado na tabela auth.users, ativar perfil correspondente
  UPDATE public.profiles 
  SET 
    status = 'active',
    updated_at = NOW()
  WHERE email = NEW.email 
    AND status = 'pending_activation'
    AND user_id != NEW.id; -- Evitar conflito se já existir
    
  -- Atualizar o user_id do perfil para o ID real do auth
  UPDATE public.profiles
  SET user_id = NEW.id
  WHERE email = NEW.email 
    AND status = 'active';
    
  RETURN NEW;
END;
$$;

-- Criar trigger para ativação automática (cuidado - só execute se não existir)
DO $$
BEGIN
  -- Verificar se trigger já existe
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'activate_user_profile_trigger'
  ) THEN
    -- Criar o trigger
    CREATE TRIGGER activate_user_profile_trigger
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.activate_user_profile();
  END IF;
END;
$$;
```

## Como usar esta versão simplificada:

### No Frontend:
```typescript
// Sempre usar a função simples
const { data, error } = await supabase.rpc('admin_create_user_simple_final', {
  p_email: formData.email,
  p_full_name: formData.full_name,
  p_group_name: formData.group_name,
  p_department_id: formData.department_id || null,
  p_position_id: formData.position_id || null
});
```

### Fluxo de trabalho:
1. **Admin cria perfil** → Status `pending_activation`
2. **Admin informa o usuário** → Usuário deve se registrar com o mesmo email
3. **Usuário faz signup normal** → Trigger ativa automaticamente o perfil
4. **Perfil fica ativo** → Usuário pode usar o sistema normalmente

## Vantagens desta abordagem:

✅ **Sem dependências**: Usa apenas `gen_random_uuid()` (função nativa do PostgreSQL 13+)  
✅ **Sem extensões**: Não precisa de uuid-ossp, pgcrypto ou outras  
✅ **Ativação automática**: Trigger conecta auth.users com profiles automaticamente  
✅ **Simples e confiável**: Menos pontos de falha  
✅ **Auditoria**: Ainda registra logs quando possível  
✅ **Gestão de pendentes**: Função para listar usuários aguardando ativação  

## Se gen_random_uuid() também não funcionar:

Adicione este bloco alternativo no final do SQL:

```sql
-- Fallback se gen_random_uuid() não estiver disponível
CREATE OR REPLACE FUNCTION public.simple_uuid_generate()
RETURNS UUID
LANGUAGE SQL
AS $$
  SELECT (
    md5(random()::text || clock_timestamp()::text)::uuid
  );
$$;

-- Substituir gen_random_uuid() por simple_uuid_generate() na função principal se necessário
```
