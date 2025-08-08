const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Read environment variables
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhrbGtub3lidm9udnp3Zmp2cWpsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MzM5NzcyNywiZXhwIjoyMDY4OTczNzI3fQ.wpPnkUsZN6_OO7ykP4qfHqe6fHaZdaDjRW3lvKe-VQI'; // Service role key

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function executeSQLFile(filePath) {
  try {
    const sqlContent = fs.readFileSync(filePath, 'utf8');
    console.log(`Executing migration: ${path.basename(filePath)}`);
    
    const { data, error } = await supabase.rpc('exec_sql', { 
      sql: sqlContent 
    });

    if (error) {
      console.error(`Error in ${filePath}:`, error);
      return false;
    }

    console.log(`✅ Successfully executed: ${path.basename(filePath)}`);
    return true;
  } catch (err) {
    console.error(`Failed to read or execute ${filePath}:`, err);
    return false;
  }
}

async function applyMigrations() {
  console.log('Starting add-ons system migrations...\n');

  const migrations = [
    'supabase/migrations/20250808_addons_system.sql',
    'supabase/migrations/20250808_addons_seed_data.sql'
  ];

  for (const migration of migrations) {
    const success = await executeSQLFile(migration);
    if (!success) {
      console.error('Migration failed. Stopping...');
      process.exit(1);
    }
    console.log(''); // Add spacing
  }

  console.log('🎉 All migrations applied successfully!');
  console.log('The add-ons system is now ready to use.');
}

applyMigrations();
