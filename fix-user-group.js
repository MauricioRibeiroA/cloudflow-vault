import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabaseUrl = 'http://127.0.0.1:54321';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function fixUserGroup() {
  console.log('🔧 Corrigindo grupo do usuário...');
  
  try {
    // Atualizar o perfil para super_admin
    const { data, error } = await supabase
      .from('profiles')
      .update({ 
        group_name: 'super_admin',
        full_name: 'Mauricio Ribeiro'
      })
      .eq('email', 'mauricioribeiro61@gmail.com')
      .select();
    
    if (error) {
      console.error('❌ Erro ao atualizar perfil:', error);
      return;
    }
    
    console.log('✅ Perfil atualizado com sucesso!');
    console.log('   Nome:', data[0].full_name);
    console.log('   Grupo:', data[0].group_name);  
    console.log('   Status:', data[0].status);
    
    console.log('\n🎉 Agora você pode fazer login como super_admin com:');
    console.log('   Email: mauricioribeiro61@gmail.com');
    console.log('   Senha: 123456');
    
  } catch (error) {
    console.error('❌ Erro geral:', error);
  }
}

fixUserGroup();
