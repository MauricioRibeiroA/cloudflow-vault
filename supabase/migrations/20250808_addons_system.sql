-- Add-ons System Migration
-- Creates tables for add-ons catalog, combo packages, and company add-ons management

-- =============================================
-- 1. ADD-ONS CATALOG TABLE
-- =============================================
CREATE TABLE addons (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  type VARCHAR(50) NOT NULL, -- 'storage', 'download', 'users', 'backup_daily', 'backup_ondemand', 'support', 'api', 'reports', 'integration', 'whitelabel'
  category VARCHAR(50) NOT NULL DEFAULT 'addon', -- 'addon', 'combo'
  price_brl DECIMAL(10,2) NOT NULL,
  billing_type VARCHAR(20) NOT NULL DEFAULT 'monthly', -- 'monthly', 'per_use', 'one_time'
  
  -- Add-on specific values (what this add-on provides)
  storage_gb INTEGER DEFAULT 0,
  download_gb INTEGER DEFAULT 0,
  additional_users INTEGER DEFAULT 0,
  
  -- Metadata
  is_active BOOLEAN DEFAULT true,
  is_stackable BOOLEAN DEFAULT false, -- Can be purchased multiple times
  requires_plan_tier VARCHAR(50), -- minimum plan required, null = any plan
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- 2. COMBO PACKAGES TABLE
-- =============================================
CREATE TABLE combo_packages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  price_brl DECIMAL(10,2) NOT NULL,
  discount_percentage DECIMAL(5,2) DEFAULT 0, -- discount compared to individual add-ons
  
  -- What this combo includes (aggregated values)
  total_storage_gb INTEGER DEFAULT 0,
  total_download_gb INTEGER DEFAULT 0,
  total_additional_users INTEGER DEFAULT 0,
  includes_daily_backup BOOLEAN DEFAULT false,
  includes_priority_support BOOLEAN DEFAULT false,
  ondemand_backups_included INTEGER DEFAULT 0,
  
  -- Metadata
  is_active BOOLEAN DEFAULT true,
  requires_plan_tier VARCHAR(50),
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- 3. COMBO PACKAGE ITEMS (what add-ons are included)
-- =============================================
CREATE TABLE combo_package_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  combo_package_id UUID REFERENCES combo_packages(id) ON DELETE CASCADE,
  addon_id UUID REFERENCES addons(id) ON DELETE CASCADE,
  quantity INTEGER DEFAULT 1, -- how many of this add-on is included
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(combo_package_id, addon_id)
);

-- =============================================
-- 4. COMPANY ADD-ONS (active add-ons per company)
-- =============================================
CREATE TABLE company_addons (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  addon_id UUID REFERENCES addons(id) ON DELETE CASCADE,
  combo_package_id UUID REFERENCES combo_packages(id) ON DELETE CASCADE, -- if purchased as part of combo
  
  -- Purchase details
  quantity INTEGER DEFAULT 1, -- how many of this add-on (for stackable ones)
  monthly_price_brl DECIMAL(10,2) NOT NULL, -- price locked at purchase time
  
  -- Billing
  billing_cycle_start DATE,
  billing_cycle_end DATE,
  next_billing_date DATE,
  auto_renew BOOLEAN DEFAULT true,
  
  -- Status
  status VARCHAR(20) DEFAULT 'active', -- 'active', 'cancelled', 'suspended', 'expired'
  
  -- Usage tracking (for per-use add-ons)
  current_period_usage INTEGER DEFAULT 0,
  total_usage INTEGER DEFAULT 0,
  
  -- Timestamps
  activated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  cancelled_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  CHECK (addon_id IS NOT NULL OR combo_package_id IS NOT NULL),
  CHECK (NOT (addon_id IS NOT NULL AND combo_package_id IS NOT NULL)) -- either addon OR combo, not both
);

-- =============================================
-- 5. ADD-ON USAGE HISTORY
-- =============================================
CREATE TABLE addon_usage_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_addon_id UUID REFERENCES company_addons(id) ON DELETE CASCADE,
  usage_date DATE DEFAULT CURRENT_DATE,
  usage_amount INTEGER DEFAULT 1, -- how much was used (for backup executions, API calls, etc)
  usage_type VARCHAR(50), -- 'backup_execution', 'api_call', 'report_generation', etc
  description TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- 6. EXTEND COMPANIES TABLE
-- =============================================
-- Add fields to track expanded limits
ALTER TABLE companies 
ADD COLUMN IF NOT EXISTS expanded_storage_gb INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS expanded_download_gb INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS expanded_max_users INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS has_daily_backup BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS has_priority_support BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS ondemand_backup_credits INTEGER DEFAULT 0;

-- =============================================
-- 7. CREATE INDEXES
-- =============================================
CREATE INDEX idx_addons_type ON addons(type);
CREATE INDEX idx_addons_category ON addons(category);
CREATE INDEX idx_addons_active ON addons(is_active);

CREATE INDEX idx_combo_packages_active ON combo_packages(is_active);

CREATE INDEX idx_company_addons_company ON company_addons(company_id);
CREATE INDEX idx_company_addons_status ON company_addons(status);
CREATE INDEX idx_company_addons_billing ON company_addons(next_billing_date) WHERE status = 'active';

CREATE INDEX idx_addon_usage_company_addon ON addon_usage_history(company_addon_id);
CREATE INDEX idx_addon_usage_date ON addon_usage_history(usage_date);

-- =============================================
-- 8. ROW LEVEL SECURITY (RLS)
-- =============================================

-- Enable RLS
ALTER TABLE addons ENABLE ROW LEVEL SECURITY;
ALTER TABLE combo_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE combo_package_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_addons ENABLE ROW LEVEL SECURITY;
ALTER TABLE addon_usage_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies for addons (public read for active ones)
CREATE POLICY "Allow public read active addons" ON addons
  FOR SELECT USING (is_active = true);

CREATE POLICY "Allow super_admin full access addons" ON addons
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.user_id = auth.uid() 
      AND profiles.group_name = 'super_admin'
    )
  );

-- RLS Policies for combo_packages (public read for active ones)
CREATE POLICY "Allow public read active combos" ON combo_packages
  FOR SELECT USING (is_active = true);

CREATE POLICY "Allow super_admin full access combos" ON combo_packages
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.user_id = auth.uid() 
      AND profiles.group_name = 'super_admin'
    )
  );

-- RLS Policies for combo_package_items (public read)
CREATE POLICY "Allow public read combo items" ON combo_package_items
  FOR SELECT USING (true);

CREATE POLICY "Allow super_admin full access combo items" ON combo_package_items
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.user_id = auth.uid() 
      AND profiles.group_name = 'super_admin'
    )
  );

-- RLS Policies for company_addons (company access only)
CREATE POLICY "Allow company access their addons" ON company_addons
  FOR ALL USING (
    company_id IN (
      SELECT profiles.company_id 
      FROM profiles 
      WHERE profiles.user_id = auth.uid()
      AND profiles.group_name IN ('company_admin', 'super_admin')
    )
  );

-- RLS Policies for addon_usage_history (company access only)
CREATE POLICY "Allow company access their usage history" ON addon_usage_history
  FOR ALL USING (
    company_addon_id IN (
      SELECT ca.id FROM company_addons ca
      JOIN profiles p ON ca.company_id = p.company_id
      WHERE p.user_id = auth.uid()
      AND p.group_name IN ('company_admin', 'super_admin')
    )
  );

-- =============================================
-- 9. HELPER FUNCTIONS
-- =============================================

-- Function to calculate total company limits (base plan + add-ons)
CREATE OR REPLACE FUNCTION get_company_total_limits(company_uuid UUID)
RETURNS TABLE (
  total_storage_gb INTEGER,
  total_download_gb INTEGER,
  total_max_users INTEGER,
  has_daily_backup BOOLEAN,
  has_priority_support BOOLEAN,
  ondemand_backup_credits INTEGER
) 
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(p.storage_limit_gb, 0) + COALESCE(c.expanded_storage_gb, 0) as total_storage_gb,
    COALESCE(p.download_limit_gb, 0) + COALESCE(c.expanded_download_gb, 0) as total_download_gb,
    COALESCE(p.max_users, 0) + COALESCE(c.expanded_max_users, 0) as total_max_users,
    COALESCE(c.has_daily_backup, false) as has_daily_backup,
    COALESCE(c.has_priority_support, false) as has_priority_support,
    COALESCE(c.ondemand_backup_credits, 0) as ondemand_backup_credits
  FROM companies c
  LEFT JOIN plans p ON c.plan_id = p.id
  WHERE c.id = company_uuid;
END;
$$;

-- Function to refresh company expanded limits from active add-ons
CREATE OR REPLACE FUNCTION refresh_company_addon_limits(company_uuid UUID)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  total_storage INTEGER := 0;
  total_download INTEGER := 0;
  total_users INTEGER := 0;
  daily_backup BOOLEAN := false;
  priority_support BOOLEAN := false;
  backup_credits INTEGER := 0;
BEGIN
  -- Calculate totals from active add-ons
  SELECT 
    COALESCE(SUM(a.storage_gb * ca.quantity), 0),
    COALESCE(SUM(a.download_gb * ca.quantity), 0),
    COALESCE(SUM(a.additional_users * ca.quantity), 0),
    BOOL_OR(a.type = 'backup_daily'),
    BOOL_OR(a.type = 'support'),
    COALESCE(SUM(CASE WHEN a.type = 'backup_ondemand' THEN ca.quantity ELSE 0 END), 0)
  INTO total_storage, total_download, total_users, daily_backup, priority_support, backup_credits
  FROM company_addons ca
  JOIN addons a ON ca.addon_id = a.id
  WHERE ca.company_id = company_uuid 
  AND ca.status = 'active';
  
  -- Also add combo package benefits
  SELECT 
    total_storage + COALESCE(SUM(cp.total_storage_gb), 0),
    total_download + COALESCE(SUM(cp.total_download_gb), 0),
    total_users + COALESCE(SUM(cp.total_additional_users), 0),
    daily_backup OR BOOL_OR(cp.includes_daily_backup),
    priority_support OR BOOL_OR(cp.includes_priority_support),
    backup_credits + COALESCE(SUM(cp.ondemand_backups_included), 0)
  INTO total_storage, total_download, total_users, daily_backup, priority_support, backup_credits
  FROM company_addons ca
  JOIN combo_packages cp ON ca.combo_package_id = cp.id
  WHERE ca.company_id = company_uuid 
  AND ca.status = 'active';
  
  -- Update company limits
  UPDATE companies 
  SET 
    expanded_storage_gb = total_storage,
    expanded_download_gb = total_download,
    expanded_max_users = total_users,
    has_daily_backup = daily_backup,
    has_priority_support = priority_support,
    ondemand_backup_credits = backup_credits,
    updated_at = NOW()
  WHERE id = company_uuid;
END;
$$;

-- =============================================
-- 10. TRIGGERS
-- =============================================

-- Trigger to refresh company limits when add-ons change
CREATE OR REPLACE FUNCTION trigger_refresh_company_limits()
RETURNS trigger 
LANGUAGE plpgsql
AS $$
BEGIN
  -- Handle different trigger events
  IF TG_OP = 'DELETE' THEN
    PERFORM refresh_company_addon_limits(OLD.company_id);
    RETURN OLD;
  ELSE
    PERFORM refresh_company_addon_limits(NEW.company_id);
    RETURN NEW;
  END IF;
END;
$$;

CREATE TRIGGER company_addons_refresh_limits
  AFTER INSERT OR UPDATE OR DELETE ON company_addons
  FOR EACH ROW
  EXECUTE FUNCTION trigger_refresh_company_limits();

-- Update timestamp trigger for tables
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS trigger 
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_addons_updated_at 
  BEFORE UPDATE ON addons
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_combo_packages_updated_at 
  BEFORE UPDATE ON combo_packages
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_company_addons_updated_at 
  BEFORE UPDATE ON company_addons
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();
