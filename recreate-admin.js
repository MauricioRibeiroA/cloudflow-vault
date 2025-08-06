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

async function recreateAdmin() {
  console.log('🔍 Verificando usuário existente...');
  
  try {
    // Verifica se o usuário existe
    const { data: existingUser, error: checkError } = await supabase.auth.admin.listUsers();
    
    if (checkError) {
      console.error('❌ Erro ao verificar usuários:', checkError);
      return;
    }
    
    const userExists = existingUser.users.find(u => u.email === 'mauricioribeiro61@gmail.com');
    
    if (userExists) {
      console.log('👤 Usuário encontrado, atualizando senha...');
      
      // Atualiza a senha do usuário existente
      const { data: updateData, error: updateError } = await supabase.auth.admin.updateUserById(
        userExists.id,
        { 
          password: '123456',
          email_confirm: true
        }
      );
      
      if (updateError) {
        console.error('❌ Erro ao atualizar senha:', updateError);
        return;
      }
      
      console.log('✅ Senha atualizada com sucesso!');
      console.log('   Email:', updateData.user.email);
      console.log('   ID:', updateData.user.id);
      
    } else {
      console.log('👤 Usuário não encontrado, criando novo...');
      
      // Cria um novo usuário
      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        email: 'mauricioribeiro61@gmail.com',
        password: '123456',
        email_confirm: true
      });
      
      if (createError) {
        console.error('❌ Erro ao criar usuário:', createError);
        return;
      }
      
      console.log('✅ Usuário criado com sucesso!');
      console.log('   Email:', newUser.user.email);
      console.log('   ID:', newUser.user.id);
      
      // Criar perfil na tabela profiles
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          user_id: newUser.user.id,
          email: 'mauricioribeiro61@gmail.com',
          full_name: 'Mauricio Ribeiro',
          group_name: 'super_admin',
          status: 'active',
          company_id: null
        });
      
      if (profileError) {
        console.error('❌ Erro ao criar perfil:', profileError);
      } else {
        console.log('✅ Perfil criado com sucesso!');
      }
    }
    
    console.log('\n🎉 Pronto! Agora você pode fazer login com:');
    console.log('   Email: mauricioribeiro61@gmail.com');
    console.log('   Senha: 123456');
    
  } catch (error) {
    console.error('❌ Erro geral:', error);
  }
}

recreateAdmin();
