# Fix para Políticas RLS da Tabela Profiles

Execute este SQL no editor SQL do seu projeto Supabase (Lovable) para corrigir as políticas RLS que estão causando o erro "new row violates row-level security policy for table profiles":

```sql
-- Primeiro, vamos remover as políticas existentes e recriar todas corretamente
DROP POLICY IF EXISTS "Super admins view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Company admins view company profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users view own profile only" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

-- 1. POLÍTICAS DE SELECT (READ)
CREATE POLICY "Super admins view all profiles" 
ON public.profiles 
FOR SELECT 
USING (public.is_super_admin());

CREATE POLICY "Company admins view company profiles" 
ON public.profiles 
FOR SELECT 
USING (company_id = public.get_user_company_id() AND public.is_company_admin());

CREATE POLICY "Users view own profile only" 
ON public.profiles 
FOR SELECT 
USING (auth.uid() = user_id);

-- 2. POLÍTICAS DE INSERT (CREATE)
CREATE POLICY "Super admins can create any profile" 
ON public.profiles 
FOR INSERT 
WITH CHECK (public.is_super_admin());

CREATE POLICY "Company admins can create company profiles" 
ON public.profiles 
FOR INSERT 
WITH CHECK (company_id = public.get_user_company_id() AND public.is_company_admin());

CREATE POLICY "Users can create their own profile" 
ON public.profiles 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- 3. POLÍTICAS DE UPDATE (MODIFY)
CREATE POLICY "Super admins can update any profile" 
ON public.profiles 
FOR UPDATE 
USING (public.is_super_admin()) 
WITH CHECK (public.is_super_admin());

CREATE POLICY "Company admins can update company profiles" 
ON public.profiles 
FOR UPDATE 
USING (company_id = public.get_user_company_id() AND public.is_company_admin()) 
WITH CHECK (company_id = public.get_user_company_id() AND public.is_company_admin());

CREATE POLICY "Users can update their own profile" 
ON public.profiles 
FOR UPDATE 
USING (auth.uid() = user_id) 
WITH CHECK (auth.uid() = user_id);

-- 4. POLÍTICAS DE DELETE (REMOVE)
CREATE POLICY "Super admins can delete any profile" 
ON public.profiles 
FOR DELETE 
USING (public.is_super_admin());

CREATE POLICY "Company admins can delete company profiles" 
ON public.profiles 
FOR DELETE 
USING (company_id = public.get_user_company_id() AND public.is_company_admin());

-- Não permitir que usuários comuns deletem profiles (apenas admins)
-- CREATE POLICY "Users can delete their own profile" 
-- ON public.profiles 
-- FOR DELETE 
-- USING (auth.uid() = user_id);
```

## O que este script corrige:

1. **Problema anterior**: As políticas RLS só tinham SELECT, faltavam INSERT, UPDATE e DELETE
2. **Erro específico**: "new row violates row-level security policy" ocorria porque não havia política de INSERT
3. **Hierarquia de permissões**:
   - Super admin: pode fazer tudo em qualquer profile
   - Company admin: pode gerenciar profiles da sua empresa
   - Usuário comum: pode apenas ver e editar seu próprio profile

## Após aplicar este script:
- Admins poderão criar usuários sem erros RLS
- A criação de profiles funcionará corretamente
- O sistema respeitará a hierarquia de permissões definida
