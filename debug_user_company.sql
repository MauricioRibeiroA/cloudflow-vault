-- Debug: Verificar company_id do usuário
-- Substitua o user_id pelo ID do usuário que está fazendo upload

SELECT 
  'Profiles table' as source,
  p.user_id,
  p.email,
  p.full_name,
  p.company_id,
  p.group_name,
  c.name as company_name
FROM profiles p
LEFT JOIN companies c ON p.company_id = c.id
WHERE p.user_id = '7722cdd1-35fc-4fca-a207-bceba6c7dc39';

-- Testar a função get_user_company_id
SELECT 
  'Function result' as source,
  get_user_company_id('7722cdd1-35fc-4fca-a207-bceba6c7dc39') as company_id_from_function;

-- Ver todos os profiles para debug
SELECT 
  'All profiles' as source,
  user_id,
  email,
  company_id,
  group_name
FROM profiles
LIMIT 10;
