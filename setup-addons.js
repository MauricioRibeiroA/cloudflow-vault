const { createClient } = require('@supabase/supabase-js');

// Read environment variables
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhrbGtub3lidm9udnp3Zmp2cWpsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MzM5NzcyNywiZXhwIjoyMDY4OTczNzI3fQ.wpPnkUsZN6_OO7ykP4qfHqe6fHaZdaDjRW3lvKe-VQI';

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function createAddonsTable() {
  console.log('Creating addons table...');
  
  const { error } = await supabase.rpc('sql', {
    query: `
      CREATE TABLE IF NOT EXISTS addons (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        description TEXT,
        type VARCHAR(50) NOT NULL,
        category VARCHAR(50) NOT NULL DEFAULT 'addon',
        price_brl DECIMAL(10,2) NOT NULL,
        billing_type VARCHAR(20) NOT NULL DEFAULT 'monthly',
        storage_gb INTEGER DEFAULT 0,
        download_gb INTEGER DEFAULT 0,
        additional_users INTEGER DEFAULT 0,
        is_active BOOLEAN DEFAULT true,
        is_stackable BOOLEAN DEFAULT false,
        requires_plan_tier VARCHAR(50),
        display_order INTEGER DEFAULT 0,
        icon_name VARCHAR(50),
        color_class VARCHAR(50),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `
  });

  if (error) {
    console.error('Error creating addons table:', error);
    return false;
  }
  
  console.log('✅ Addons table created');
  return true;
}

async function createComboPackagesTable() {
  console.log('Creating combo_packages table...');
  
  const { error } = await supabase.rpc('sql', {
    query: `
      CREATE TABLE IF NOT EXISTS combo_packages (
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
        requires_plan_tier VARCHAR(50),
        display_order INTEGER DEFAULT 0,
        icon_name VARCHAR(50),
        color_class VARCHAR(50),
        is_popular BOOLEAN DEFAULT false,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `
  });

  if (error) {
    console.error('Error creating combo_packages table:', error);
    return false;
  }
  
  console.log('✅ Combo packages table created');
  return true;
}

async function insertSeedData() {
  console.log('Inserting seed data...');
  
  // Insert addons
  const { error: addonsError } = await supabase
    .from('addons')
    .insert([
      {
        name: '100 GB Extra de Armazenamento',
        description: 'Adicione 100 GB ao seu limite de armazenamento',
        type: 'storage',
        price_brl: 14.90,
        billing_type: 'monthly',
        storage_gb: 100,
        is_stackable: true,
        display_order: 1,
        icon_name: 'HardDrive',
        color_class: 'bg-blue-500'
      },
      {
        name: '50 GB Extra de Download',
        description: 'Adicione 50 GB ao seu limite mensal de download',
        type: 'download',
        price_brl: 7.90,
        billing_type: 'monthly',
        download_gb: 50,
        is_stackable: true,
        display_order: 2,
        icon_name: 'Download',
        color_class: 'bg-green-500'
      },
      {
        name: 'Usuário Adicional',
        description: 'Adicione mais um usuário à sua equipe',
        type: 'users',
        price_brl: 4.90,
        billing_type: 'monthly',
        additional_users: 1,
        is_stackable: true,
        display_order: 3,
        icon_name: 'Users',
        color_class: 'bg-purple-500'
      },
      {
        name: 'Backup Diário Automático',
        description: 'Backup automático diário dos seus arquivos com retenção de 30 dias',
        type: 'backup_daily',
        price_brl: 9.90,
        billing_type: 'monthly',
        display_order: 4,
        icon_name: 'Shield',
        color_class: 'bg-orange-500'
      },
      {
        name: 'Backup Sob Demanda',
        description: 'Execute backup manual quando precisar - cobrado por execução',
        type: 'backup_ondemand',
        price_brl: 2.90,
        billing_type: 'per_use',
        display_order: 5,
        icon_name: 'Zap',
        color_class: 'bg-yellow-500'
      }
    ]);

  if (addonsError) {
    console.error('Error inserting addons:', addonsError);
    return false;
  }

  // Insert combo packages
  const { error: combosError } = await supabase
    .from('combo_packages')
    .insert([
      {
        name: 'Pacote Expansão',
        description: '100 GB de armazenamento + 50 GB de download extra',
        price_brl: 22.90,
        discount_percentage: 10.00,
        total_storage_gb: 100,
        total_download_gb: 50,
        display_order: 2,
        icon_name: 'TrendingUp',
        color_class: 'bg-blue-500',
        is_popular: true
      },
      {
        name: 'Pacote Backup Completo',
        description: 'Backup diário automático + 2 backups sob demanda inclusos mensalmente',
        price_brl: 11.90,
        discount_percentage: 12.50,
        includes_daily_backup: true,
        ondemand_backups_included: 2,
        display_order: 1,
        icon_name: 'Shield',
        color_class: 'bg-orange-500'
      }
    ]);

  if (combosError) {
    console.error('Error inserting combo packages:', combosError);
    return false;
  }

  console.log('✅ Seed data inserted');
  return true;
}

async function setup() {
  console.log('🚀 Setting up Add-ons System...\n');

  const steps = [
    createAddonsTable,
    createComboPackagesTable,
    insertSeedData
  ];

  for (const step of steps) {
    const success = await step();
    if (!success) {
      console.error('❌ Setup failed');
      process.exit(1);
    }
  }

  console.log('\n🎉 Add-ons system setup complete!');
  console.log('You can now access the Upgrades page.');
}

setup();
