import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'http://127.0.0.1:54321';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

// Cliente admin (service key)
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function resetUserPassword() {
  console.log('🔧 Resetando senha do usuário mauricioribeiro61@gmail.com...');
  
  try {
    // 1. Encontrar o usuário
    const { data: users, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (listError) {
      console.error('❌ Erro ao listar usuários:', listError);
      return;
    }
    
    const targetUser = users.users.find(u => u.email === 'mauricioribeiro61@gmail.com');
    
    if (!targetUser) {
      console.log('❌ Usuário não encontrado!');
      return;
    }
    
    console.log('✅ Usuário encontrado:', targetUser.id);
    
    // 2. Reset senha e confirmar email
    const { data: updateData, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      targetUser.id,
      { 
        password: '123456',
        email_confirm: true
      }
    );
    
    if (updateError) {
      console.error('❌ Erro ao resetar senha:', updateError);
    } else {
      console.log('✅ Senha resetada para "123456" e email confirmado!');
      console.log('🔑 O usuário pode agora fazer login com:');
      console.log('   Email: mauricioribeiro61@gmail.com');
      console.log('   Senha: 123456');
    }
    
  } catch (error) {
    console.error('❌ Erro geral:', error);
  }
}

resetUserPassword();