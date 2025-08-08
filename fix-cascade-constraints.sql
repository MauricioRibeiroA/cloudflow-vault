-- Migration para adicionar ON DELETE CASCADE nas constraints que estão faltando
-- Execute este script no Supabase Dashboard -> SQL Editor

-- 1. Remover constraints antigas e adicionar novas com CASCADE

-- Folders: created_by
ALTER TABLE public.folders DROP CONSTRAINT IF EXISTS folders_created_by_fkey;
ALTER TABLE public.folders ADD CONSTRAINT folders_created_by_fkey 
    FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Files: uploaded_by  
ALTER TABLE public.files DROP CONSTRAINT IF EXISTS files_uploaded_by_fkey;
ALTER TABLE public.files ADD CONSTRAINT files_uploaded_by_fkey 
    FOREIGN KEY (uploaded_by) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Settings: updated_by
ALTER TABLE public.settings DROP CONSTRAINT IF EXISTS settings_updated_by_fkey;
ALTER TABLE public.settings ADD CONSTRAINT settings_updated_by_fkey 
    FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Verificar se todas as constraints estão com CASCADE agora
SELECT 
    tc.table_name,
    tc.constraint_name,
    tc.constraint_type,
    rc.delete_rule,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
JOIN information_schema.referential_constraints AS rc
    ON tc.constraint_name = rc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY' 
    AND tc.table_schema = 'public'
    AND ccu.table_name = 'users'
    AND ccu.table_schema = 'auth'
ORDER BY tc.table_name, tc.constraint_name;
