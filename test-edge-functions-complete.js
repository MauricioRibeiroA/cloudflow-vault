import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://hklknoybvonvzwfjvqjl.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhrbGtub3lidm9udnp3Zmp2cWpsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMzOTc3MjcsImV4cCI6MjA2ODk3MzcyN30.TfjGqM9jprdWkOUfxeJYiE9CFTud01UjCN8Yngd5LJQ";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function testEdgeFunctions() {
  console.log('🧪 TESTE COMPLETO - EDGE FUNCTIONS');
  console.log('');
  
  try {
    // 1. Login
    console.log('1. 🔐 Fazendo login...');
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: 'mauricioribeiro61@gmail.com',
      password: '123456'
    });
    
    if (authError) {
      console.error('❌ Erro no login:', authError.message);
      return;
    }
    
    console.log('✅ Login realizado com sucesso');
    const token = authData.session.access_token;
    
    // 2. Test b2-file-manager function with list_files action
    console.log('\n2. 📋 Testando b2-file-manager (list_files)...');
    try {
      const { data: listData, error: listError } = await supabase.functions.invoke('b2-file-manager', {
        headers: { Authorization: `Bearer ${token}` },
        body: {
          action: 'list_files',
          folder: null
        }
      });
      
      if (listError) {
        console.log('❌ Erro na função list_files:', listError);
        console.log('   Detalhes:', JSON.stringify(listError, null, 2));
      } else {
        console.log('✅ Função list_files funcionando!');
        console.log('   Resposta:', listData);
      }
    } catch (listErr) {
      console.log('❌ Erro na execução de list_files:', listErr.message);
    }
    
    // 3. Test b2-file-manager function with list_folders action
    console.log('\n3. 📁 Testando b2-file-manager (list_folders)...');
    try {
      const { data: foldersData, error: foldersError } = await supabase.functions.invoke('b2-file-manager', {
        headers: { Authorization: `Bearer ${token}` },
        body: {
          action: 'list_folders',
          parent: null
        }
      });
      
      if (foldersError) {
        console.log('❌ Erro na função list_folders:', foldersError);
      } else {
        console.log('✅ Função list_folders funcionando!');
        console.log('   Resposta:', foldersData);
      }
    } catch (foldersErr) {
      console.log('❌ Erro na execução de list_folders:', foldersErr.message);
    }
    
    // 4. Test b2-file-manager function with get_usage action
    console.log('\n4. 📊 Testando b2-file-manager (get_usage)...');
    try {
      const { data: usageData, error: usageError } = await supabase.functions.invoke('b2-file-manager', {
        headers: { Authorization: `Bearer ${token}` },
        body: {
          action: 'get_usage'
        }
      });
      
      if (usageError) {
        console.log('❌ Erro na função get_usage:', usageError);
      } else {
        console.log('✅ Função get_usage funcionando!');
        console.log('   Resposta:', usageData);
      }
    } catch (usageErr) {
      console.log('❌ Erro na execução de get_usage:', usageErr.message);
    }
    
    // 5. Test b2-upload-url function
    console.log('\n5. 📤 Testando b2-upload-url...');
    try {
      const { data: uploadData, error: uploadError } = await supabase.functions.invoke('b2-upload-url', {
        headers: { Authorization: `Bearer ${token}` },
        body: {
          fileName: 'test.txt',
          fileType: 'text/plain',
          fileSize: 100
        }
      });
      
      if (uploadError) {
        console.log('❌ Erro na função b2-upload-url:', uploadError);
      } else {
        console.log('✅ Função b2-upload-url funcionando!');
        console.log('   Resposta:', uploadData);
      }
    } catch (uploadErr) {
      console.log('❌ Erro na execução de b2-upload-url:', uploadErr.message);
    }
    
    // 6. Test b2-download-url function
    console.log('\n6. 📥 Testando b2-download-url...');
    try {
      const { data: downloadData, error: downloadError } = await supabase.functions.invoke('b2-download-url', {
        headers: { Authorization: `Bearer ${token}` },
        body: {
          fileId: 'test-file-id' // This will likely fail, but we want to see the error
        }
      });
      
      if (downloadError) {
        console.log('❌ Erro na função b2-download-url:', downloadError);
      } else {
        console.log('✅ Função b2-download-url funcionando!');
        console.log('   Resposta:', downloadData);
      }
    } catch (downloadErr) {
      console.log('❌ Erro na execução de b2-download-url:', downloadErr.message);
    }
    
    console.log('\n🎯 RESUMO DOS TESTES:');
    console.log('');
    console.log('Se as funções estão retornando erros de "B2_ACCESS_KEY_ID" ou variáveis');
    console.log('de ambiente, significa que as Edge Functions estão funcionando, mas');
    console.log('faltam as variáveis de ambiente do Backblaze B2.');
    console.log('');
    console.log('PRÓXIMO PASSO: Configure as variáveis no Supabase Dashboard!');
    console.log('URL: https://supabase.com/dashboard/project/hklknoybvonvzwfjvqjl/settings/functions');
    
  } catch (error) {
    console.error('❌ Erro geral:', error.message);
  }
}

testEdgeFunctions();
