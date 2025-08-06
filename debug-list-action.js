import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://hklknoybvonvzwfjvqjl.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhrbGtub3lidm9udnp3Zmp2cWpsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMzOTc3MjcsImV4cCI6MjA2ODk3MzcyN30.TfjGqM9jprdWkOUfxeJYiE9CFTud01UjCN8Yngd5LJQ';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function testListAction() {
  console.log('🔍 Testando especificamente a ação "list"...\n');
  
  try {
    console.log('📋 Enviando request para listar arquivos...');
    const { data, error } = await supabase.functions.invoke('b2-proxy', {
      body: { action: 'list', path: '' }
    });
    
    if (error) {
      console.error('❌ Erro na ação list:', error.message);
      console.error('📄 Detalhes do erro:', JSON.stringify(error, null, 2));
      
      // Tentar capturar mais detalhes do erro
      if (error.context && error.context.response) {
        try {
          const errorText = await error.context.response.text();
          console.error('📄 Response text:', errorText);
        } catch (e) {
          console.error('❌ Não foi possível ler response text');
        }
      }
    } else {
      console.log('✅ Sucesso na ação list!');
      console.log('📁 Arquivos encontrados:', data?.files?.length || 0);
      console.log('📂 Pastas encontradas:', data?.folders?.length || 0);
      console.log('📄 Dados completos:', JSON.stringify(data, null, 2));
    }
  } catch (e) {
    console.error('💥 Exceção capturada:', e.message);
    console.error('📄 Stack trace:', e.stack);
  }
  
  console.log('\n' + '='.repeat(50) + '\n');
  
  // Teste via fetch direto
  try {
    console.log('📋 Testando list via fetch direto...');
    const response = await fetch(`${SUPABASE_URL}/functions/v1/b2-proxy`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'apikey': SUPABASE_ANON_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ action: 'list', path: '' })
    });
    
    console.log('📊 Status:', response.status);
    console.log('📊 Status Text:', response.statusText);
    
    const text = await response.text();
    console.log('📄 Response body (raw):', text);
    
    if (text) {
      try {
        const json = JSON.parse(text);
        console.log('✅ JSON parsed:', json);
      } catch (e) {
        console.log('❌ Não é JSON válido:', e.message);
      }
    }
    
  } catch (e) {
    console.error('💥 Exceção no fetch direto:', e.message);
  }
}

testListAction();
