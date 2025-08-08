-- Seed Data for Add-ons System
-- Populates the catalog with individual add-ons and combo packages

-- =============================================
-- 1. INDIVIDUAL ADD-ONS SEED DATA
-- =============================================

-- Storage Add-ons
INSERT INTO addons (name, description, type, price_brl, billing_type, storage_gb, is_stackable) VALUES
('100 GB Extra de Armazenamento', 'Adicione 100 GB ao seu limite de armazenamento', 'storage', 14.90, 'monthly', 100, true);

-- Download Add-ons
INSERT INTO addons (name, description, type, price_brl, billing_type, download_gb, is_stackable) VALUES
('50 GB Extra de Download', 'Adicione 50 GB ao seu limite mensal de download', 'download', 7.90, 'monthly', 50, true);

-- User Add-ons
INSERT INTO addons (name, description, type, price_brl, billing_type, additional_users, is_stackable) VALUES
('Usuário Adicional', 'Adicione mais um usuário à sua equipe', 'users', 4.90, 'monthly', 1, true);

-- Backup Add-ons
INSERT INTO addons (name, description, type, price_brl, billing_type) VALUES
('Backup Diário Automático', 'Backup automático diário dos seus arquivos com retenção de 30 dias', 'backup_daily', 9.90, 'monthly'),
('Backup Sob Demanda', 'Execute backup manual quando precisar - cobrado por execução', 'backup_ondemand', 2.90, 'per_use');

-- Premium Services Add-ons
INSERT INTO addons (name, description, type, price_brl, billing_type) VALUES
('Suporte Prioritário', 'Atendimento prioritário com SLA de 2 horas', 'support', 19.90, 'monthly'),
('API Avançada', 'Acesso completo à API com limites aumentados', 'api', 24.90, 'monthly'),
('Relatórios Personalizados', 'Relatórios detalhados de uso e analytics', 'reports', 12.90, 'monthly'),
('Integração Externa', 'Conecte com S3, Google Drive e outros serviços', 'integration', 8.90, 'monthly'),
('Marca Branca (White Label)', 'Remova nossa marca e use sua identidade visual', 'whitelabel', 49.90, 'monthly');

-- =============================================
-- 2. COMBO PACKAGES SEED DATA
-- =============================================

-- Combo Backup Completo
INSERT INTO combo_packages (
  name, 
  description, 
  price_brl, 
  discount_percentage,
  includes_daily_backup,
  ondemand_backups_included
) VALUES (
  'Pacote Backup Completo',
  'Backup diário automático + 2 backups sob demanda inclusos mensalmente',
  11.90,
  12.50,
  true,
  2
);

-- Combo Expansão
INSERT INTO combo_packages (
  name,
  description,
  price_brl,
  discount_percentage,
  total_storage_gb,
  total_download_gb
) VALUES (
  'Pacote Expansão',
  '100 GB de armazenamento + 50 GB de download extra',
  22.90,
  10.00,
  100,
  50
);

-- Combo Equipe
INSERT INTO combo_packages (
  name,
  description,
  price_brl,
  discount_percentage,
  total_additional_users,
  includes_priority_support
) VALUES (
  'Pacote Equipe',
  '2 usuários adicionais + suporte prioritário',
  29.90,
  15.00,
  2,
  true
);

-- Combo Empresarial
INSERT INTO combo_packages (
  name,
  description,
  price_brl,
  discount_percentage,
  total_storage_gb,
  total_download_gb,
  total_additional_users,
  includes_daily_backup,
  includes_priority_support,
  ondemand_backups_included
) VALUES (
  'Pacote Empresarial',
  'Combo completo: 200 GB storage + 100 GB download + 3 usuários + backup diário + suporte prioritário + 5 backups sob demanda',
  79.90,
  25.00,
  200,
  100,
  3,
  true,
  true,
  5
);

-- =============================================
-- 3. COMBO PACKAGE ITEMS RELATIONSHIPS
-- =============================================

-- Get IDs for the relationships (we'll use the names to find them)
DO $$
DECLARE
  combo_backup_id UUID;
  combo_expansion_id UUID;
  combo_team_id UUID;
  combo_enterprise_id UUID;
  addon_storage_id UUID;
  addon_download_id UUID;
  addon_user_id UUID;
  addon_daily_backup_id UUID;
  addon_ondemand_backup_id UUID;
  addon_support_id UUID;
BEGIN
  -- Get combo package IDs
  SELECT id INTO combo_backup_id FROM combo_packages WHERE name = 'Pacote Backup Completo';
  SELECT id INTO combo_expansion_id FROM combo_packages WHERE name = 'Pacote Expansão';
  SELECT id INTO combo_team_id FROM combo_packages WHERE name = 'Pacote Equipe';
  SELECT id INTO combo_enterprise_id FROM combo_packages WHERE name = 'Pacote Empresarial';
  
  -- Get add-on IDs
  SELECT id INTO addon_storage_id FROM addons WHERE type = 'storage';
  SELECT id INTO addon_download_id FROM addons WHERE type = 'download';
  SELECT id INTO addon_user_id FROM addons WHERE type = 'users';
  SELECT id INTO addon_daily_backup_id FROM addons WHERE type = 'backup_daily';
  SELECT id INTO addon_ondemand_backup_id FROM addons WHERE type = 'backup_ondemand';
  SELECT id INTO addon_support_id FROM addons WHERE type = 'support';

  -- Combo Backup Completo items
  INSERT INTO combo_package_items (combo_package_id, addon_id, quantity) VALUES
  (combo_backup_id, addon_daily_backup_id, 1),
  (combo_backup_id, addon_ondemand_backup_id, 2);

  -- Combo Expansão items
  INSERT INTO combo_package_items (combo_package_id, addon_id, quantity) VALUES
  (combo_expansion_id, addon_storage_id, 1),
  (combo_expansion_id, addon_download_id, 1);

  -- Combo Equipe items
  INSERT INTO combo_package_items (combo_package_id, addon_id, quantity) VALUES
  (combo_team_id, addon_user_id, 2),
  (combo_team_id, addon_support_id, 1);

  -- Combo Empresarial items (2x storage, 2x download, 3x users, daily backup, support, 5x ondemand)
  INSERT INTO combo_package_items (combo_package_id, addon_id, quantity) VALUES
  (combo_enterprise_id, addon_storage_id, 2),
  (combo_enterprise_id, addon_download_id, 2),
  (combo_enterprise_id, addon_user_id, 3),
  (combo_enterprise_id, addon_daily_backup_id, 1),
  (combo_enterprise_id, addon_support_id, 1),
  (combo_enterprise_id, addon_ondemand_backup_id, 5);
END
$$;

-- =============================================
-- 4. ADD-ONS DISPLAY METADATA (for frontend)
-- =============================================

-- Add display order and icons for better UX
ALTER TABLE addons ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0;
ALTER TABLE addons ADD COLUMN IF NOT EXISTS icon_name VARCHAR(50);
ALTER TABLE addons ADD COLUMN IF NOT EXISTS color_class VARCHAR(50);

ALTER TABLE combo_packages ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0;
ALTER TABLE combo_packages ADD COLUMN IF NOT EXISTS icon_name VARCHAR(50);
ALTER TABLE combo_packages ADD COLUMN IF NOT EXISTS color_class VARCHAR(50);
ALTER TABLE combo_packages ADD COLUMN IF NOT EXISTS is_popular BOOLEAN DEFAULT false;

-- Update add-ons with display metadata
UPDATE addons SET 
  display_order = 1, 
  icon_name = 'HardDrive', 
  color_class = 'bg-blue-500' 
WHERE type = 'storage';

UPDATE addons SET 
  display_order = 2, 
  icon_name = 'Download', 
  color_class = 'bg-green-500' 
WHERE type = 'download';

UPDATE addons SET 
  display_order = 3, 
  icon_name = 'Users', 
  color_class = 'bg-purple-500' 
WHERE type = 'users';

UPDATE addons SET 
  display_order = 4, 
  icon_name = 'Shield', 
  color_class = 'bg-orange-500' 
WHERE type = 'backup_daily';

UPDATE addons SET 
  display_order = 5, 
  icon_name = 'Zap', 
  color_class = 'bg-yellow-500' 
WHERE type = 'backup_ondemand';

UPDATE addons SET 
  display_order = 6, 
  icon_name = 'Headphones', 
  color_class = 'bg-red-500' 
WHERE type = 'support';

UPDATE addons SET 
  display_order = 7, 
  icon_name = 'Code', 
  color_class = 'bg-indigo-500' 
WHERE type = 'api';

UPDATE addons SET 
  display_order = 8, 
  icon_name = 'BarChart', 
  color_class = 'bg-teal-500' 
WHERE type = 'reports';

UPDATE addons SET 
  display_order = 9, 
  icon_name = 'Link', 
  color_class = 'bg-cyan-500' 
WHERE type = 'integration';

UPDATE addons SET 
  display_order = 10, 
  icon_name = 'Palette', 
  color_class = 'bg-pink-500' 
WHERE type = 'whitelabel';

-- Update combo packages with display metadata
UPDATE combo_packages SET 
  display_order = 1,
  icon_name = 'Shield',
  color_class = 'bg-orange-500'
WHERE name = 'Pacote Backup Completo';

UPDATE combo_packages SET 
  display_order = 2,
  icon_name = 'TrendingUp',
  color_class = 'bg-blue-500',
  is_popular = true
WHERE name = 'Pacote Expansão';

UPDATE combo_packages SET 
  display_order = 3,
  icon_name = 'Users',
  color_class = 'bg-purple-500'
WHERE name = 'Pacote Equipe';

UPDATE combo_packages SET 
  display_order = 4,
  icon_name = 'Crown',
  color_class = 'bg-gradient-to-r from-yellow-500 to-orange-500'
WHERE name = 'Pacote Empresarial';

-- =============================================
-- 5. CREATE VIEW FOR EASY FRONTEND CONSUMPTION
-- =============================================

-- View that combines add-ons with their current active companies count
CREATE VIEW addons_with_stats AS
SELECT 
  a.*,
  COUNT(DISTINCT ca.company_id) FILTER (WHERE ca.status = 'active') as active_companies,
  SUM(ca.quantity) FILTER (WHERE ca.status = 'active') as total_quantity_sold
FROM addons a
LEFT JOIN company_addons ca ON a.id = ca.addon_id
GROUP BY a.id, a.name, a.description, a.type, a.category, a.price_brl, a.billing_type, 
         a.storage_gb, a.download_gb, a.additional_users, a.is_active, a.is_stackable, 
         a.requires_plan_tier, a.display_order, a.icon_name, a.color_class, 
         a.created_at, a.updated_at;

-- View that combines combo packages with their stats
CREATE VIEW combo_packages_with_stats AS
SELECT 
  cp.*,
  COUNT(DISTINCT ca.company_id) FILTER (WHERE ca.status = 'active') as active_companies
FROM combo_packages cp
LEFT JOIN company_addons ca ON cp.id = ca.combo_package_id
GROUP BY cp.id, cp.name, cp.description, cp.price_brl, cp.discount_percentage,
         cp.total_storage_gb, cp.total_download_gb, cp.total_additional_users,
         cp.includes_daily_backup, cp.includes_priority_support, cp.ondemand_backups_included,
         cp.is_active, cp.requires_plan_tier, cp.display_order, cp.icon_name, 
         cp.color_class, cp.is_popular, cp.created_at, cp.updated_at;
