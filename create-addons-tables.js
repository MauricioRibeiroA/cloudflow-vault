import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function createTables() {
  console.log('Creating add-ons tables...');
  
  try {
    // First check if tables exist by trying to query them
    const { error: testError } = await supabase
      .from('addons')
      .select('count')
      .limit(1);
    
    if (!testError) {
      console.log('✅ Tables already exist');
      return;
    }
    
    console.log('Tables do not exist, you need to create them manually in Supabase Dashboard.');
    console.log('Go to https://supabase.com/dashboard/project/hklknoybvonvzwfjvqjl/editor');
    console.log('And run the SQL from the migration files.');
    
  } catch (error) {
    console.error('Error:', error);
  }
}

createTables();
