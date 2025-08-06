import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'http://127.0.0.1:54321';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testEdgeFunction() {
  console.log('🧪 Testando Edge Function b2-file-manager...');
  
  try {
    // 1. Fazer login
    console.log('\n1. Fazendo login...');
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: 'mauricioribeiro61@gmail.com',
      password: '123456'
    });
    
    if (authError) {
      console.error('❌ Erro no login:', authError);
      return;
    }
    
    console.log('✅ Login realizado com sucesso!');
    
    // 2. Testar Edge Function - List Folders
    console.log('\n2. Testando Edge Function - List Folders...');
    const { data: edgeData, error: edgeError } = await supabase.functions.invoke('b2-file-manager', {
      body: {
        action: 'list_folders',
        parent: null
      }
    });
    
    if (edgeError) {
      console.error('❌ Erro na Edge Function:', edgeError);
      console.error('   Status:', edgeError.status);
      console.error('   Context:', edgeError.context);
    } else {
      console.log('✅ Edge Function funcionando!');
      console.log('   Resposta:', edgeData);
    }
    
    // 3. Testar Edge Function - Get Usage
    console.log('\n3. Testando Edge Function - Get Usage...');
    const { data: usageData, error: usageError } = await supabase.functions.invoke('b2-file-manager', {
      body: {
        action: 'get_usage'
      }
    });
    
    if (usageError) {
      console.error('❌ Erro na Edge Function (usage):', usageError);
    } else {
      console.log('✅ Edge Function (usage) funcionando!');
      console.log('   Uso de armazenamento:', usageData);
    }
    
  } catch (error) {
    console.error('❌ Erro geral:', error);
  }
}

testEdgeFunction();
