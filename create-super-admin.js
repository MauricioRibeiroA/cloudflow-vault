import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabaseUrl = 'http://127.0.0.1:54321';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

// Cliente admin (service key)
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Cliente para teste de login (anon key)
const supabaseClient = createClient(supabaseUrl, supabaseAnonKey);

async function createSuperAdmin() {
  console.log('🚀 Criando Super Admin do ZERO...');
  
  const adminEmail = 'mauricioribeiro61@gmail.com';
  const adminPassword = '123456';
  
  try {
    // 1. Limpar qualquer usuário existente
    console.log('\n1. Verificando usuários existentes...');
    const { data: existingUsers, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (listError) {
      console.error('❌ Erro ao listar usuários:', listError);
      return;
    }
    
    console.log(`📊 Encontrados ${existingUsers.users.length} usuários.`);
    
    // Deletar usuário existente se houver
    const existingUser = existingUsers.users.find(u => u.email === adminEmail);
    if (existingUser) {
      console.log('🗑️ Deletando usuário existente...');
      const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(existingUser.id);
      if (deleteError) {
        console.error('❌ Erro ao deletar usuário:', deleteError);
      } else {
        console.log('✅ Usuário existente deletado.');
      }
    }
    
    // 2. Criar novo usuário
    console.log('\n2. Criando novo Super Admin...');
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: adminEmail,
      password: adminPassword,
      email_confirm: true,
      user_metadata: {
        full_name: 'Mauricio Ribeiro',
        role: 'super_admin'
      }
    });
    
    if (createError) {
      console.error('❌ Erro ao criar usuário:', createError);
      return;
    }
    
    console.log('✅ Usuário criado com sucesso!');
    console.log('   ID:', newUser.user.id);
    console.log('   Email:', newUser.user.email);
    
    // 3. Aguardar um pouco para garantir que o usuário foi criado
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // 4. Criar perfil na tabela profiles
    console.log('\n3. Criando perfil do Super Admin...');
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .upsert({
        user_id: newUser.user.id,
        email: adminEmail,
        full_name: 'Mauricio Ribeiro',
        group_name: 'super_admin',
        status: 'active',
        company_id: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id'
      })
      .select();
    
    if (profileError) {
      console.error('❌ Erro ao criar perfil:', profileError);
    } else {
      console.log('✅ Perfil criado com sucesso!');
      console.log('   Nome:', profile[0].full_name);
      console.log('   Grupo:', profile[0].group_name);
      console.log('   Status:', profile[0].status);
    }
    
    // 5. Aguardar mais um pouco
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // 6. Testar login
    console.log('\n4. Testando login...');
    const { data: loginData, error: loginError } = await supabaseClient.auth.signInWithPassword({
      email: adminEmail,
      password: adminPassword
    });
    
    if (loginError) {
      console.error('❌ ERRO NO LOGIN:', loginError);
      console.error('   Código:', loginError.status);
      console.error('   Mensagem:', loginError.message);
      
      // Tentar atualizar senha novamente
      console.log('\n🔧 Tentando corrigir senha...');
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
        newUser.user.id,
        { 
          password: adminPassword,
          email_confirm: true
        }
      );
      
      if (!updateError) {
        console.log('✅ Senha atualizada. Tentando login novamente...');
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const { data: retryLogin, error: retryError } = await supabaseClient.auth.signInWithPassword({
          email: adminEmail,
          password: adminPassword
        });
        
        if (retryError) {
          console.error('❌ AINDA COM ERRO:', retryError);
        } else {
          console.log('✅ LOGIN FUNCIONOU NA SEGUNDA TENTATIVA!');
        }
      }
    } else {
      console.log('✅ LOGIN REALIZADO COM SUCESSO!');
      console.log('   Token:', loginData.session?.access_token ? 'Presente' : 'Ausente');
      console.log('   Usuário:', loginData.user?.email);
    }
    
    console.log('\n🎉 SUPER ADMIN CRIADO COMPLETAMENTE!');
    console.log('\n📝 CREDENCIAIS PARA LOGIN:');
    console.log('   📧 Email: mauricioribeiro61@gmail.com');
    console.log('   🔐 Senha: 123456');
    console.log('   👑 Grupo: super_admin');
    console.log('\n🌐 Aplicação disponível em: http://localhost:8080');
    
  } catch (error) {
    console.error('❌ Erro geral:', error);
  }
}

createSuperAdmin();
