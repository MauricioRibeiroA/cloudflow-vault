import { createClient } from '@supabase/supabase-js';

// Usar as credenciais de produção
const SUPABASE_URL = 'https://hklknoybvonvzwfjvqjl.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhrbGtub3lidm9udnp3Zmp2cWpsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMzOTc3MjcsImV4cCI6MjA2ODk3MzcyN30.TfjGqM9jprdWkOUfxeJYiE9CFTud01UjCN8Yngd5LJQ';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function testConnection() {
  try {
    console.log('🔄 Testando conexão com Supabase produção...');
    console.log('URL:', SUPABASE_URL);
    
    // Testar conexão básica
    const { data, error } = await supabase.auth.getSession();
    
    if (error) {
      console.error('❌ Erro na conexão:', error);
      return false;
    }
    
    console.log('✅ Conexão com Supabase funcionando!');
    console.log('📊 Sessão atual:', data.session ? 'Logado' : 'Não logado');
    
    // Testar função b2-proxy
    console.log('\n🔄 Testando Edge Function b2-proxy...');
    const { data: functionData, error: functionError } = await supabase.functions.invoke('b2-proxy', {
      body: { action: 'list', path: '' }
    });
    
    if (functionError) {
      console.error('❌ Erro na Edge Function:', functionError);
      return false;
    }
    
    console.log('✅ Edge Function b2-proxy funcionando!');
    console.log('📁 Arquivos encontrados:', functionData?.files?.length || 0);
    console.log('📂 Pastas encontradas:', functionData?.folders?.length || 0);
    
    return true;
    
  } catch (error) {
    console.error('💥 Erro inesperado:', error);
    return false;
  }
}

testConnection().then(success => {
  console.log('\n' + (success ? '🎉 Teste concluído com sucesso!' : '💔 Teste falhou'));
  process.exit(success ? 0 : 1);
});
