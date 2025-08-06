import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'http://127.0.0.1:54321';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

// Cliente admin
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

// Cliente como usuário autenticado
const supabaseUser = createClient(supabaseUrl, supabaseAnonKey);

async function debugRLS() {
  console.log('🔍 Debugando políticas RLS...');
  
  try {
    // 1. Verificar dados na tabela profiles (como admin)
    console.log('\n1. Verificando dados na tabela profiles (como admin)...');
    const { data: profilesAdmin, error: adminError } = await supabaseAdmin
      .from('profiles')
      .select('*');
    
    if (adminError) {
      console.error('❌ Erro ao buscar profiles como admin:', adminError);
    } else {
      console.log(`✅ Encontrados ${profilesAdmin.length} perfis como admin:`);
      profilesAdmin.forEach(profile => {
        console.log(`   👤 ${profile.email} - ID: ${profile.user_id} - Grupo: ${profile.group_name}`);
      });
    }
    
    // 2. Fazer login e testar acesso aos dados
    console.log('\n2. Fazendo login como usuário...');
    const { data: loginData, error: loginError } = await supabaseUser.auth.signInWithPassword({
      email: 'mauricioribeiro61@gmail.com',
      password: '123456'
    });
    
    if (loginError) {
      console.error('❌ Erro no login:', loginError);
      return;
    }
    
    console.log('✅ Login bem-sucedido!');
    console.log('   User ID:', loginData.user.id);
    
    // 3. Tentar buscar perfil como usuário autenticado
    console.log('\n3. Tentando buscar perfil como usuário autenticado...');
    const { data: userProfile, error: userError } = await supabaseUser
      .from('profiles')
      .select('*')
      .eq('user_id', loginData.user.id);
    
    if (userError) {
      console.error('❌ Erro ao buscar perfil como usuário:', userError);
    } else {
      console.log(`✅ Perfil encontrado como usuário: ${userProfile.length} registros`);
      if (userProfile.length > 0) {
        console.log('   Nome:', userProfile[0].full_name);
        console.log('   Grupo:', userProfile[0].group_name);
      }
    }
    
    // 4. Tentar buscar todos os perfis como usuário (deve falhar por RLS)
    console.log('\n4. Tentando buscar todos os perfis como usuário (teste RLS)...');
    const { data: allProfiles, error: allError } = await supabaseUser
      .from('profiles')
      .select('*');
    
    if (allError) {
      console.error('❌ Erro ao buscar todos os perfis (esperado por RLS):', allError);
    } else {
      console.log(`⚠️ Encontrados ${allProfiles.length} perfis (RLS pode não estar funcionando)`);
    }
    
    // 5. Verificar se o user_id no perfil corresponde ao ID do usuário logado
    if (profilesAdmin.length > 0) {
      console.log('\n5. Verificando correspondência de IDs...');
      const profile = profilesAdmin[0];
      console.log('   ID do usuário logado:', loginData.user.id);
      console.log('   ID no perfil:', profile.user_id);
      console.log('   IDs correspondem:', loginData.user.id === profile.user_id ? '✅ Sim' : '❌ Não');
    }
    
  } catch (error) {
    console.error('❌ Erro geral:', error);
  }
}

debugRLS();
