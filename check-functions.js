// Verificar status das Edge Functions
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://hklknoybvonvzwfjvqjl.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhrbGtub3lidm9udnp3Zmp2cWpsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMzOTc3MjcsImV4cCI6MjA2ODk3MzcyN30.TfjGqM9jprdWkOUfxeJYiE9CFTud01UjCN8Yngd5LJQ";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkFunctions() {
  console.log('🔍 Verificando Edge Functions...');
  
  try {
    // Login
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: 'mauricioribeiro61@gmail.com',
      password: '123456'
    });
    
    if (authError) {
      console.error('❌ Erro no login:', authError.message);
      return;
    }
    
    console.log('✅ Login realizado');
    const token = authData.session.access_token;
    
    // Testar cada Edge Function
    const functions = [
      'b2-upload-url',
      'b2-file-manager',
      'b2-download-url'
    ];
    
    for (const funcName of functions) {
      console.log(`\n📡 Testando função: ${funcName}`);
      
      try {
        const response = await fetch(`${SUPABASE_URL}/functions/v1/${funcName}`, {
          method: 'OPTIONS'
        });
        
        console.log(`   Status CORS: ${response.status}`);
        
        if (response.ok) {
          console.log('   ✅ Função está ativa');
        } else {
          console.log('   ❌ Função com problemas');
        }
        
      } catch (error) {
        console.log(`   ❌ Erro ao acessar função: ${error.message}`);
      }
    }
    
    // Testar função específica com dados mínimos
    console.log('\n🧪 Teste com dados mínimos...');
    
    try {
      const { data, error } = await supabase.functions.invoke('b2-file-manager', {
        headers: { Authorization: `Bearer ${token}` },
        body: {
          action: 'list_folders',
          parent: null,
          company_id: null,
          group_name: 'super_admin'
        }
      });
      
      if (error) {
        console.log('❌ Erro na função:', error);
        
        // Verificar se é erro de variáveis de ambiente
        if (error.message && error.message.includes('B2_')) {
          console.log('\n⚠️  PROBLEMA IDENTIFICADO:');
          console.log('   As variáveis do Backblaze não estão configuradas no Supabase!');
          console.log('\n📋 Para resolver:');
          console.log('   1. Acesse: https://supabase.com/dashboard/project/hklknoybvonvzwfjvqjl/settings/functions');
          console.log('   2. Adicione as variáveis:');
          console.log('      - B2_ACCESS_KEY_ID');
          console.log('      - B2_SECRET_ACCESS_KEY');
          console.log('      - B2_REGION');
          console.log('      - B2_ENDPOINT');
          console.log('      - B2_BUCKET_NAME');
        }
      } else {
        console.log('✅ Função funcionando:', data);
      }
      
    } catch (funcError) {
      console.log('❌ Erro na execução:', funcError.message);
    }
    
  } catch (error) {
    console.error('❌ Erro geral:', error.message);
  }
}

checkFunctions();
