-- =====================================================
-- SCRIPT DE SEGURANÇA E ESTRUTURA DE PASTAS
-- =====================================================

-- Função para criar estrutura de pastas da empresa
CREATE OR REPLACE FUNCTION create_company_folder_structure(company_id_param UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result jsonb;
BEGIN
  -- Chamar a Edge Function para criar as pastas no Backblaze
  SELECT content::jsonb INTO result
  FROM http((
    'POST',
    current_setting('app.supabase_url') || '/functions/v1/b2-proxy',
    ARRAY[
      http_header('Authorization', 'Bearer ' || current_setting('app.service_role_key')),
      http_header('Content-Type', 'application/json')
    ],
    jsonb_build_object(
      'action', 'createCompanyStructure',
      'companyId', company_id_param::text
    )
  ));

  -- Log da operação
  INSERT INTO operation_logs (
    operation_type,
    resource_id,
    details,
    created_by,
    created_at
  ) VALUES (
    'create_company_structure',
    company_id_param::text,
    jsonb_build_object(
      'company_id', company_id_param,
      'result', result
    ),
    'system',
    NOW()
  );

  RETURN result;
EXCEPTION
  WHEN OTHERS THEN
    -- Log do erro
    INSERT INTO operation_logs (
      operation_type,
      resource_id,
      details,
      created_by,
      created_at
    ) VALUES (
      'create_company_structure_error',
      company_id_param::text,
      jsonb_build_object(
        'company_id', company_id_param,
        'error', SQLERRM
      ),
      'system',
      NOW()
    );
    
    RAISE EXCEPTION 'Erro ao criar estrutura de pastas: %', SQLERRM;
END;
$$;

-- Função para validar path de acesso
CREATE OR REPLACE FUNCTION validate_user_path_access(
  user_id_param UUID,
  requested_path TEXT
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_profile RECORD;
  company_base_path TEXT;
  user_personal_path TEXT;
  shared_path TEXT;
  admin_path TEXT;
  validation_result jsonb;
BEGIN
  -- Buscar perfil do usuário
  SELECT 
    up.company_id,
    up.role,
    up.email,
    c.name as company_name
  INTO user_profile
  FROM user_profiles up
  JOIN companies c ON c.id = up.company_id
  WHERE up.id = user_id_param;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'is_valid', false,
      'error_message', 'Usuário não encontrado',
      'allowed_path', ''
    );
  END IF;

  -- Construir paths
  company_base_path := 'company-' || user_profile.company_id || '/';
  user_personal_path := company_base_path || 'users/user-' || user_id_param || '/';
  shared_path := company_base_path || 'shared/';
  admin_path := company_base_path || 'admin/';

  -- Super admin pode tudo
  IF user_profile.role = 'super_admin' THEN
    RETURN jsonb_build_object(
      'is_valid', true,
      'allowed_path', requested_path,
      'user_role', user_profile.role,
      'default_path', ''
    );
  END IF;

  -- Normalizar path
  requested_path := TRIM(TRAILING '/' FROM requested_path) || '/';

  -- Verificar se está dentro da empresa
  IF NOT (requested_path LIKE company_base_path || '%') THEN
    RETURN jsonb_build_object(
      'is_valid', false,
      'error_message', 'Acesso negado: fora do escopo da empresa',
      'allowed_path', company_base_path,
      'user_role', user_profile.role
    );
  END IF;

  -- Validar por role
  CASE user_profile.role
    WHEN 'company_admin' THEN
      -- Admin da empresa pode acessar tudo da empresa
      IF requested_path LIKE company_base_path || '%' THEN
        validation_result := jsonb_build_object(
          'is_valid', true,
          'allowed_path', requested_path,
          'user_role', user_profile.role,
          'default_path', company_base_path
        );
      ELSE
        validation_result := jsonb_build_object(
          'is_valid', false,
          'error_message', 'Acesso negado',
          'allowed_path', company_base_path,
          'user_role', user_profile.role
        );
      END IF;

    WHEN 'user' THEN
      -- Usuário pode acessar pasta pessoal e compartilhada
      IF requested_path LIKE user_personal_path || '%' OR 
         requested_path LIKE shared_path || '%' THEN
        validation_result := jsonb_build_object(
          'is_valid', true,
          'allowed_path', requested_path,
          'user_role', user_profile.role,
          'default_path', user_personal_path
        );
      -- Não pode acessar admin
      ELSIF requested_path LIKE admin_path || '%' THEN
        validation_result := jsonb_build_object(
          'is_valid', false,
          'error_message', 'Acesso negado: área administrativa',
          'allowed_path', shared_path,
          'user_role', user_profile.role
        );
      -- Não pode acessar outros usuários
      ELSIF requested_path LIKE company_base_path || 'users/user-%' AND 
            NOT (requested_path LIKE user_personal_path || '%') THEN
        validation_result := jsonb_build_object(
          'is_valid', false,
          'error_message', 'Acesso negado: pasta de outro usuário',
          'allowed_path', user_personal_path,
          'user_role', user_profile.role
        );
      ELSE
        validation_result := jsonb_build_object(
          'is_valid', false,
          'error_message', 'Acesso negado',
          'allowed_path', user_personal_path,
          'user_role', user_profile.role
        );
      END IF;

    ELSE
      validation_result := jsonb_build_object(
        'is_valid', false,
        'error_message', 'Role inválido',
        'allowed_path', '',
        'user_role', user_profile.role
      );
  END CASE;

  RETURN validation_result;
END;
$$;

-- Função para obter paths disponíveis para o usuário
CREATE OR REPLACE FUNCTION get_user_available_paths(user_id_param UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_profile RECORD;
  available_paths jsonb := '[]'::jsonb;
  company_base_path TEXT;
  user_personal_path TEXT;
  shared_path TEXT;
  admin_path TEXT;
BEGIN
  -- Buscar perfil do usuário
  SELECT 
    up.company_id,
    up.role,
    up.email,
    c.name as company_name
  INTO user_profile
  FROM user_profiles up
  JOIN companies c ON c.id = up.company_id
  WHERE up.id = user_id_param;

  IF NOT FOUND THEN
    RETURN '[]'::jsonb;
  END IF;

  -- Construir paths
  company_base_path := 'company-' || user_profile.company_id || '/';
  user_personal_path := company_base_path || 'users/user-' || user_id_param || '/';
  shared_path := company_base_path || 'shared/';
  admin_path := company_base_path || 'admin/';

  CASE user_profile.role
    WHEN 'super_admin' THEN
      available_paths := available_paths || jsonb_build_object(
        'name', 'Todas as Empresas',
        'path', '',
        'description', 'Acesso completo a todos os dados',
        'icon', 'crown'
      );

    WHEN 'company_admin' THEN
      available_paths := available_paths || jsonb_build_object(
        'name', 'Raiz da Empresa',
        'path', company_base_path,
        'description', 'Pasta raiz da empresa ' || user_profile.company_name,
        'icon', 'building'
      );
      available_paths := available_paths || jsonb_build_object(
        'name', 'Arquivos Compartilhados',
        'path', shared_path,
        'description', 'Documentos compartilhados da empresa',
        'icon', 'users'
      );
      available_paths := available_paths || jsonb_build_object(
        'name', 'Administração',
        'path', admin_path,
        'description', 'Arquivos administrativos',
        'icon', 'shield'
      );

    WHEN 'user' THEN
      available_paths := available_paths || jsonb_build_object(
        'name', 'Meus Arquivos',
        'path', user_personal_path,
        'description', 'Seus arquivos pessoais',
        'icon', 'user'
      );
      available_paths := available_paths || jsonb_build_object(
        'name', 'Arquivos Compartilhados',
        'path', shared_path,
        'description', 'Documentos compartilhados da empresa',
        'icon', 'users'
      );
  END CASE;

  RETURN available_paths;
END;
$$;

-- Trigger para criar estrutura de pastas quando nova empresa é criada
CREATE OR REPLACE FUNCTION trigger_create_company_structure()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Executar assincronamente (não bloquear a criação da empresa)
  PERFORM pg_notify(
    'create_company_structure',
    json_build_object('company_id', NEW.id)::text
  );
  
  RETURN NEW;
END;
$$;

-- Criar trigger se não existir
DROP TRIGGER IF EXISTS on_company_created ON companies;
CREATE TRIGGER on_company_created
  AFTER INSERT ON companies
  FOR EACH ROW
  EXECUTE FUNCTION trigger_create_company_structure();

-- Trigger para criar pasta pessoal quando novo usuário é adicionado
CREATE OR REPLACE FUNCTION trigger_create_user_personal_folder()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Só criar pasta para usuários não super_admin
  IF NEW.role != 'super_admin' THEN
    -- Executar assincronamente
    PERFORM pg_notify(
      'create_user_personal_folder',
      json_build_object(
        'user_id', NEW.id,
        'company_id', NEW.company_id
      )::text
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Criar trigger se não existir
DROP TRIGGER IF EXISTS on_user_profile_created ON user_profiles;
CREATE TRIGGER on_user_profile_created
  AFTER INSERT ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION trigger_create_user_personal_folder();

-- Tabela para logs de operações de segurança
CREATE TABLE IF NOT EXISTS operation_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  operation_type TEXT NOT NULL,
  resource_id TEXT,
  user_id UUID REFERENCES auth.users(id),
  details jsonb,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_operation_logs_type ON operation_logs(operation_type);
CREATE INDEX IF NOT EXISTS idx_operation_logs_resource ON operation_logs(resource_id);
CREATE INDEX IF NOT EXISTS idx_operation_logs_user ON operation_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_operation_logs_created_at ON operation_logs(created_at);

-- RLS para logs
ALTER TABLE operation_logs ENABLE ROW LEVEL SECURITY;

-- Super admins podem ver todos os logs
CREATE POLICY "Super admins can view all operation logs" ON operation_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_profiles.id = auth.uid() 
      AND user_profiles.role = 'super_admin'
    )
  );

-- Usuários podem ver apenas logs relacionados à sua empresa
CREATE POLICY "Users can view company operation logs" ON operation_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_profiles up1
      JOIN user_profiles up2 ON up1.company_id = up2.company_id
      WHERE up1.id = auth.uid() 
      AND up2.id = operation_logs.user_id::uuid
    )
  );

-- Função para limpar logs antigos (executar periodicamente)
CREATE OR REPLACE FUNCTION cleanup_old_operation_logs()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM operation_logs 
  WHERE created_at < NOW() - INTERVAL '90 days';
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  RETURN deleted_count;
END;
$$;

-- Comentários para documentação
COMMENT ON FUNCTION create_company_folder_structure(UUID) IS 'Cria estrutura de pastas para nova empresa no Backblaze B2';
COMMENT ON FUNCTION validate_user_path_access(UUID, TEXT) IS 'Valida se usuário pode acessar determinado path';
COMMENT ON FUNCTION get_user_available_paths(UUID) IS 'Retorna paths disponíveis para o usuário baseado em seu role';
COMMENT ON TABLE operation_logs IS 'Log de operações de segurança e auditoria';

-- Grants de segurança
GRANT EXECUTE ON FUNCTION create_company_folder_structure(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION validate_user_path_access(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_available_paths(UUID) TO authenticated;
GRANT SELECT ON operation_logs TO authenticated;
