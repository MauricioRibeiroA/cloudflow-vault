-- Script para limpar registros órfãos e permitir exclusão de usuários
-- Execute este script no Supabase Dashboard -> SQL Editor

-- 1. Identificar usuários órfãos (que não têm profile mas existem em auth.users)
SELECT 
  au.id,
  au.email,
  au.created_at,
  'auth_user_without_profile' as issue
FROM auth.users au
LEFT JOIN public.profiles p ON p.user_id = au.id
WHERE p.user_id IS NULL;

-- 2. Identificar registros órfãos em folders
SELECT 
  f.id,
  f.name,
  f.created_by,
  'folder_with_deleted_user' as issue
FROM public.folders f
LEFT JOIN auth.users au ON au.id = f.created_by
WHERE au.id IS NULL;

-- 3. Identificar registros órfãos em files
SELECT 
  f.id,
  f.name,
  f.uploaded_by,
  'file_with_deleted_user' as issue
FROM public.files f
LEFT JOIN auth.users au ON au.id = f.uploaded_by
WHERE au.id IS NULL;

-- 4. Identificar registros órfãos em settings
SELECT 
  s.id,
  s.key,
  s.updated_by,
  'setting_with_deleted_user' as issue
FROM public.settings s
LEFT JOIN auth.users au ON au.id = s.updated_by
WHERE au.id IS NULL;

-- 5. Identificar registros órfãos em permissions
SELECT 
  p.id,
  p.user_id,
  p.folder_id,
  'permission_with_deleted_user' as issue
FROM public.permissions p
LEFT JOIN auth.users au ON au.id = p.user_id
WHERE au.id IS NULL;

-- 6. Identificar registros órfãos em logs
SELECT 
  l.id,
  l.action,
  l.user_id,
  'log_with_deleted_user' as issue
FROM public.logs l
LEFT JOIN auth.users au ON au.id = l.user_id
WHERE au.id IS NULL;

-- ============================================
-- LIMPEZA DOS REGISTROS ÓRFÃOS
-- ============================================

-- ATENÇÃO: Execute os comandos de limpeza apenas se tiver certeza!

-- Deletar folders órfãos
-- DELETE FROM public.folders 
-- WHERE created_by NOT IN (SELECT id FROM auth.users);

-- Deletar files órfãos
-- DELETE FROM public.files 
-- WHERE uploaded_by NOT IN (SELECT id FROM auth.users);

-- Deletar settings órfãos (ou atualizar para um usuário válido)
-- DELETE FROM public.settings 
-- WHERE updated_by NOT IN (SELECT id FROM auth.users);

-- Deletar permissions órfãos
-- DELETE FROM public.permissions 
-- WHERE user_id NOT IN (SELECT id FROM auth.users);

-- Deletar logs órfãos
-- DELETE FROM public.logs 
-- WHERE user_id NOT IN (SELECT id FROM auth.users);

-- ============================================
-- COMANDO PARA DELETAR USUÁRIO ESPECÍFICO
-- ============================================
-- Substitua 'USER_EMAIL_HERE' pelo email do usuário que quer deletar
/*
DO $$
DECLARE
    user_id UUID;
BEGIN
    -- Encontrar o ID do usuário pelo email
    SELECT id INTO user_id 
    FROM auth.users 
    WHERE email = 'feitoaforma@gmail.com';
    
    IF user_id IS NOT NULL THEN
        -- Deletar registros relacionados primeiro
        DELETE FROM public.folders WHERE created_by = user_id;
        DELETE FROM public.files WHERE uploaded_by = user_id;
        DELETE FROM public.settings WHERE updated_by = user_id;
        DELETE FROM public.permissions WHERE user_id = user_id;
        DELETE FROM public.logs WHERE user_id = user_id;
        DELETE FROM public.profiles WHERE user_id = user_id;
        
        -- Deletar usuário do auth
        DELETE FROM auth.users WHERE id = user_id;
        
        RAISE NOTICE 'Usuário % deletado com sucesso', 'feitoaforma@gmail.com';
    ELSE
        RAISE NOTICE 'Usuário % não encontrado', 'feitoaforma@gmail.com';
    END IF;
END $$;
*/
