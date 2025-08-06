import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabaseUrl = 'http://127.0.0.1:54321';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

// Cliente para login (anon key)
const supabaseClient = createClient(supabaseUrl, supabaseAnonKey);

// Cliente admin (service key)
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function debugLogin() {
  console.log('🔍 Diagnosticando problemas de login...');
  
  try {
    // 1. Listar todos os usuários
    console.log('\n1. Listando usuários existentes...');
    const { data: users, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (listError) {
      console.error('❌ Erro ao listar usuários:', listError);
      return;
    }
    
    console.log(`✅ Encontrados ${users.users.length} usuários:`);
    users.users.forEach(user => {
      console.log(`   📧 ${user.email} - ID: ${user.id} - Confirmado: ${user.email_confirmed_at ? 'Sim' : 'Não'}`);
    });
    
    // 2. Encontrar o usuário específico
    const targetUser = users.users.find(u => u.email === 'mauricioribeiro61@gmail.com');
    
    if (!targetUser) {
      console.log('\n❌ Usuário mauricioribeiro61@gmail.com não encontrado!');
      return;
    }
    
    console.log('\n2. Detalhes do usuário:');
    console.log('   ID:', targetUser.id);
    console.log('   Email:', targetUser.email);
    console.log('   Confirmado:', targetUser.email_confirmed_at ? 'Sim' : 'Não');
    console.log('   Criado em:', targetUser.created_at);
    console.log('   Último login:', targetUser.last_sign_in_at || 'Nunca');
    
    // 3. Verificar perfil na tabela profiles
    console.log('\n3. Verificando perfil...');
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('user_id', targetUser.id)
      .single();
    
    if (profileError) {
      console.error('❌ Erro ao buscar perfil:', profileError);
    } else {
      console.log('✅ Perfil encontrado:');
      console.log('   Nome:', profile.full_name);
      console.log('   Grupo:', profile.group_name);
      console.log('   Status:', profile.status);
      console.log('   Empresa:', profile.company_id || 'Nenhuma');
    }
    
    // 4. Forçar confirmação de email e redefinir senha
    console.log('\n4. Forçando confirmação de email e redefinindo senha...');
    const { data: updateData, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      targetUser.id,
      { 
        password: '123456',
        email_confirm: true
      }
    );
    
    if (updateError) {
      console.error('❌ Erro ao atualizar usuário:', updateError);
    } else {
      console.log('✅ Usuário atualizado com sucesso!');
    }
    
    // 5. Tentar fazer login
    console.log('\n5. Testando login...');
    const { data: loginData, error: loginError } = await supabaseClient.auth.signInWithPassword({
      email: 'mauricioribeiro61@gmail.com',
      password: '123456'
    });
    
    if (loginError) {
      console.error('❌ Erro no login:', loginError);
      console.error('   Código:', loginError.status);
      console.error('   Mensagem:', loginError.message);
    } else {
      console.log('✅ Login realizado com sucesso!');
      console.log('   Token:', loginData.session?.access_token ? 'Presente' : 'Ausente');
      console.log('   Usuário:', loginData.user?.email);
    }
    
  } catch (error) {
    console.error('❌ Erro geral:', error);
  }
}

debugLogin();
