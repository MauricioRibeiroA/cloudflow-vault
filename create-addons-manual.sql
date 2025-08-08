-- Add-ons System - Simplified Version
-- Run this SQL in Supabase Dashboard > SQL Editor

-- =============================================
-- 1. CREATE ADDONS TABLE
-- =============================================
CREATE TABLE addons (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  type VARCHAR(50) NOT NULL,
  price_brl DECIMAL(10,2) NOT NULL,
  billing_type VARCHAR(20) NOT NULL DEFAULT 'monthly',
  storage_gb INTEGER DEFAULT 0,
  download_gb INTEGER DEFAULT 0,
  additional_users INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  is_stackable BOOLEAN DEFAULT false,
  display_order INTEGER DEFAULT 0,
  icon_name VARCHAR(50),
  color_class VARCHAR(50),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- 2. CREATE COMBO PACKAGES TABLE
-- =============================================
CREATE TABLE combo_packages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  price_brl DECIMAL(10,2) NOT NULL,
  discount_percentage DECIMAL(5,2) DEFAULT 0,
  total_storage_gb INTEGER DEFAULT 0,
  total_download_gb INTEGER DEFAULT 0,
  total_additional_users INTEGER DEFAULT 0,
  includes_daily_backup BOOLEAN DEFAULT false,
  includes_priority_support BOOLEAN DEFAULT false,
  ondemand_backups_included INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  icon_name VARCHAR(50),
  color_class VARCHAR(50),
  is_popular BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- 3. ENABLE RLS (Row Level Security)
-- =============================================
ALTER TABLE addons ENABLE ROW LEVEL SECURITY;
ALTER TABLE combo_packages ENABLE ROW LEVEL SECURITY;

-- Allow public read for active add-ons
CREATE POLICY "Allow public read active addons" ON addons
  FOR SELECT USING (is_active = true);

-- Allow public read for active combo packages  
CREATE POLICY "Allow public read active combos" ON combo_packages
  FOR SELECT USING (is_active = true);

-- =============================================
-- 4. INSERT SAMPLE DATA
-- =============================================

-- Individual Add-ons
INSERT INTO addons (name, description, type, price_brl, billing_type, storage_gb, download_gb, additional_users, is_stackable, display_order, icon_name, color_class) VALUES
('100 GB Extra de Armazenamento', 'Adicione 100 GB ao seu limite de armazenamento', 'storage', 14.90, 'monthly', 100, 0, 0, true, 1, 'HardDrive', 'bg-blue-500'),
('50 GB Extra de Download', 'Adicione 50 GB ao seu limite mensal de download', 'download', 7.90, 'monthly', 0, 50, 0, true, 2, 'Download', 'bg-green-500'),
('Usuário Adicional', 'Adicione mais um usuário à sua equipe', 'users', 4.90, 'monthly', 0, 0, 1, true, 3, 'Users', 'bg-purple-500'),
('Backup Diário Automático', 'Backup automático diário dos seus arquivos com retenção de 30 dias', 'backup_daily', 9.90, 'monthly', 0, 0, 0, false, 4, 'Shield', 'bg-orange-500'),
('Backup Sob Demanda', 'Execute backup manual quando precisar - cobrado por execução', 'backup_ondemand', 2.90, 'per_use', 0, 0, 0, false, 5, 'Zap', 'bg-yellow-500'),
('Suporte Prioritário', 'Atendimento prioritário com SLA de 2 horas', 'support', 19.90, 'monthly', 0, 0, 0, false, 6, 'Headphones', 'bg-red-500'),
('API Avançada', 'Acesso completo à API com limites aumentados', 'api', 24.90, 'monthly', 0, 0, 0, false, 7, 'Code', 'bg-indigo-500');

-- Combo Packages
INSERT INTO combo_packages (name, description, price_brl, discount_percentage, total_storage_gb, total_download_gb, total_additional_users, includes_daily_backup, includes_priority_support, ondemand_backups_included, display_order, icon_name, color_class, is_popular) VALUES
('Pacote Backup Completo', 'Backup diário automático + 2 backups sob demanda inclusos mensalmente', 11.90, 12.50, 0, 0, 0, true, false, 2, 1, 'Shield', 'bg-orange-500', false),
('Pacote Expansão', '100 GB de armazenamento + 50 GB de download extra', 22.90, 10.00, 100, 50, 0, false, false, 0, 2, 'TrendingUp', 'bg-blue-500', true),
('Pacote Equipe', '2 usuários adicionais + suporte prioritário', 29.90, 15.00, 0, 0, 2, false, true, 0, 3, 'Users', 'bg-purple-500', false),
('Pacote Empresarial', 'Combo completo: 200 GB storage + 100 GB download + 3 usuários + backup diário + suporte prioritário + 5 backups sob demanda', 79.90, 25.00, 200, 100, 3, true, true, 5, 4, 'Crown', 'bg-gradient-to-r from-yellow-500 to-orange-500', false);

-- =============================================
-- 5. CREATE INDEXES FOR PERFORMANCE
-- =============================================
CREATE INDEX idx_addons_type ON addons(type);
CREATE INDEX idx_addons_active ON addons(is_active);
CREATE INDEX idx_addons_display_order ON addons(display_order);

CREATE INDEX idx_combo_packages_active ON combo_packages(is_active);
CREATE INDEX idx_combo_packages_display_order ON combo_packages(display_order);

-- =============================================
-- DONE! 
-- =============================================
-- The add-ons system is now ready to use.
-- You can access the Upgrades page at /upgrades
