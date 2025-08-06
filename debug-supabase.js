// Debug script para testar conexão Supabase
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://hklknoybvonvzwfjvqjl.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhrbGtub3lidm9udnp3Zmp2cWpsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMzOTc3MjcsImV4cCI6MjA2ODk3MzcyN30.TfjGqM9jprdWkOUfxeJYiE9CFTud01UjCN8Yngd5LJQ";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function testConnection() {
  console.log('🔍 Testando conexão com Supabase...');
  
  try {
    // Test 1: Basic connection
    console.log('\n1. Testando conexão básica...');
    const { data, error } = await supabase.from('profiles').select('count').limit(1);
    if (error) {
      console.error('❌ Erro na conexão básica:', error.message);
    } else {
      console.log('✅ Conexão básica funcionando');
    }

    // Test 2: Test Edge Functions ping
    console.log('\n2. Testando Edge Functions...');
    const funcResponse = await fetch(`${SUPABASE_URL}/functions/v1/b2-file-manager`, {
      method: 'OPTIONS',
    });
    
    if (funcResponse.ok) {
      console.log('✅ Edge Functions respondendo (CORS OK)');
    } else {
      console.log('❌ Edge Functions não estão respondendo');
    }

    // Test 3: Test profiles table
    console.log('\n3. Testando tabela profiles...');
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('*')
      .limit(5);
    
    if (profilesError) {
      console.error('❌ Erro ao acessar tabela profiles:', profilesError.message);
    } else {
      console.log('✅ Tabela profiles acessível');
      console.log('   Profiles encontrados:', profiles?.length || 0);
      if (profiles && profiles.length > 0) {
        console.log('   Primeiro profile:', JSON.stringify(profiles[0], null, 2));
      }
    }

    // Test 4: Test folders table
    console.log('\n4. Testando tabela folders...');
    const { data: folders, error: foldersError } = await supabase
      .from('folders')
      .select('*')
      .limit(5);
    
    if (foldersError) {
      console.error('❌ Erro ao acessar tabela folders:', foldersError.message);
    } else {
      console.log('✅ Tabela folders acessível');
      console.log('   Folders encontrados:', folders?.length || 0);
    }

    // Test 5: Test files table
    console.log('\n5. Testando tabela files...');
    const { data: files, error: filesError } = await supabase
      .from('files')
      .select('*')
      .limit(5);
    
    if (filesError) {
      console.error('❌ Erro ao acessar tabela files:', filesError.message);
    } else {
      console.log('✅ Tabela files acessível');
      console.log('   Files encontrados:', files?.length || 0);
    }

  } catch (error) {
    console.error('❌ Erro geral:', error.message);
  }
}

testConnection();
