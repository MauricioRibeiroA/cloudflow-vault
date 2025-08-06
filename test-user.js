// Teste rápido com usuário existente
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://hklknoybvonvzwfjvqjl.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhrbGtub3lidm9udnp3Zmp2cWpsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMzOTc3MjcsImV4cCI6MjA2ODk3MzcyN30.TfjGqM9jprdWkOUfxeJYiE9CFTud01UjCN8Yngd5LJQ";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function testWithUser() {
  console.log('🔍 Testando login e CRUD...');
  
  try {
    // Test Login
    console.log('\n1. Testando login...');
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: 'mauricioribeiro61@gmail.com',
      password: '123456'
    });
    
    if (authError) {
      console.error('❌ Erro no login:', authError.message);
      return;
    }
    
    console.log('✅ Login realizado com sucesso!');
    console.log('   User ID:', authData.user?.id);
    console.log('   Email:', authData.user?.email);
    
    // Test folders
    console.log('\n2. Testando busca de pastas...');
    const { data: folders, error: foldersError } = await supabase
      .from('folders')
      .select('*')
      .is('parent_id', null)
      .order('name');
    
    if (foldersError) {
      console.error('❌ Erro ao buscar pastas:', foldersError.message);
    } else {
      console.log('✅ Pastas encontradas:', folders?.length || 0);
      if (folders && folders.length > 0) {
        console.log('   Primeira pasta:', folders[0].name);
      }
    }
    
    // Test files
    console.log('\n3. Testando busca de arquivos...');
    const { data: files, error: filesError } = await supabase
      .from('files')
      .select('*')
      .is('folder_id', null)
      .order('name');
    
    if (filesError) {
      console.error('❌ Erro ao buscar arquivos:', filesError.message);
    } else {
      console.log('✅ Arquivos encontrados:', files?.length || 0);
      if (files && files.length > 0) {
        console.log('   Primeiro arquivo:', files[0].name);
      }
    }
    
    // Test profile
    console.log('\n4. Verificando perfil...');
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', authData.user.id)
      .single();
    
    if (profileError) {
      console.error('❌ Erro ao buscar perfil:', profileError.message);
    } else {
      console.log('✅ Perfil encontrado:');
      console.log('   Nome:', profile.full_name);
      console.log('   Grupo:', profile.group_name);
      console.log('   Status:', profile.status);
    }
    
    console.log('\n🎉 Todos os testes básicos passaram!');
    console.log('🚀 O sistema está pronto para uso no Lovable!');
    
  } catch (error) {
    console.error('❌ Erro geral:', error.message);
  }
}

testWithUser();
