import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function testTables() {
  console.log('🧪 Testing add-ons tables...\n');
  
  try {
    // Test addons table
    console.log('Testing addons table...');
    const { data: addons, error: addonsError } = await supabase
      .from('addons')
      .select('id, name, price_brl, type')
      .limit(5);
    
    if (addonsError) {
      console.error('❌ Addons table error:', addonsError);
      return false;
    }
    
    console.log(`✅ Found ${addons.length} add-ons:`);
    addons.forEach(addon => {
      console.log(`   - ${addon.name} (${addon.type}) - R$ ${addon.price_brl}`);
    });
    
    console.log('');
    
    // Test combo packages table
    console.log('Testing combo_packages table...');
    const { data: combos, error: combosError } = await supabase
      .from('combo_packages')
      .select('id, name, price_brl, discount_percentage')
      .limit(5);
    
    if (combosError) {
      console.error('❌ Combo packages table error:', combosError);
      return false;
    }
    
    console.log(`✅ Found ${combos.length} combo packages:`);
    combos.forEach(combo => {
      console.log(`   - ${combo.name} - R$ ${combo.price_brl} (${combo.discount_percentage}% desconto)`);
    });
    
    console.log('\n🎉 All tables are working correctly!');
    console.log('The Upgrades page should now display properly.');
    return true;
    
  } catch (error) {
    console.error('❌ Unexpected error:', error);
    return false;
  }
}

testTables();
