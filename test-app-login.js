import { createClient } from '@supabase/supabase-js';

// Usar as mesmas configurações da aplicação
const SUPABASE_URL = "http://127.0.0.1:54321";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";

// Configurar cliente exatamente como na aplicação
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: {
      getItem: (key) => null, // Simular sem storage para teste
      setItem: (key, value) => {},
      removeItem: (key) => {},
    },
    persistSession: true,
    autoRefreshToken: true,
  }
});

async function testAppLogin() {
  console.log('🧪 Testando login com configuração exata da aplicação...');
  
  const email = 'mauricioribeiro61@gmail.com';
  const password = '123456';
  
  try {
    console.log('\n📋 Configurações:');
    console.log('   URL:', SUPABASE_URL);
    console.log('   Key:', SUPABASE_ANON_KEY.substring(0, 20) + '...');
    
    console.log('\n🔐 Tentando login...');
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    
    if (error) {
      console.error('❌ ERRO NO LOGIN:', error);
      console.error('   Código:', error.status);
      console.error('   Mensagem:', error.message);
      console.error('   Detalhes:', error.details);
      
      // Verificar se é problema de sessão
      console.log('\n🔍 Verificando sessão atual...');
      const { data: sessionData } = await supabase.auth.getSession();
      console.log('   Sessão:', sessionData.session ? 'Existe' : 'Não existe');
      
    } else {
      console.log('✅ LOGIN FUNCIONOU!');
      console.log('   Token:', data.session?.access_token ? 'Presente' : 'Ausente');
      console.log('   Usuário:', data.user?.email);
      console.log('   Sessão válida até:', data.session?.expires_at);
      
      // Testar busca do perfil
      console.log('\n👤 Testando busca do perfil...');
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', data.user.id)
        .single();
      
      if (profileError) {
        console.error('❌ Erro ao buscar perfil:', profileError);
      } else {
        console.log('✅ Perfil encontrado:');
        console.log('   Nome:', profile.full_name);
        console.log('   Grupo:', profile.group_name);
        console.log('   Status:', profile.status);
      }
    }
    
  } catch (error) {
    console.error('❌ Erro inesperado:', error);
  }
}

testAppLogin();
