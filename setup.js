// Setup script para configurar o sistema inicial
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://hklknoybvonvzwfjvqjl.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhrbGtub3lidm9udnp3Zmp2cWpsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMzOTc3MjcsImV4cCI6MjA2ODk3MzcyN30.TfjGqM9jprdWkOUfxeJYiE9CFTud01UjCN8Yngd5LJQ";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function setupSystem() {
  console.log('🚀 Configurando sistema inicial...');
  
  try {
    // Verificar se há usuários
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('*');
    
    if (profilesError) {
      console.error('❌ Erro ao verificar profiles:', profilesError.message);
      return;
    }

    if (profiles && profiles.length === 0) {
      console.log('\n⚠️  Nenhum usuário encontrado no sistema.');
      console.log('   Você precisa criar um usuário primeiro.');
      console.log('\n📝 Para criar um usuário:');
      console.log('   1. Acesse: http://localhost:8080');
      console.log('   2. Vá para a página de cadastro/login');
      console.log('   3. Crie uma conta');
      console.log('   4. Ou use o painel do Supabase para criar um usuário manualmente');
      return;
    }

    console.log('✅ Usuários encontrados:', profiles.length);
    
    // Testar Edge Functions com um usuário real
    if (profiles.length > 0) {
      console.log('\n🔧 Para testar as Edge Functions, você precisa:');
      console.log('   1. Fazer login no sistema');
      console.log('   2. Usar o token de autenticação');
      console.log('   3. Configurar as variáveis do Backblaze no Supabase');
      
      console.log('\n📋 Variáveis necessárias no Supabase Dashboard:');
      console.log('   - B2_ACCESS_KEY_ID');
      console.log('   - B2_SECRET_ACCESS_KEY');
      console.log('   - B2_REGION');
      console.log('   - B2_ENDPOINT');
      console.log('   - B2_BUCKET_NAME');
      
      console.log('\n🌐 URL do Dashboard: https://supabase.com/dashboard/project/hklknoybvonvzwfjvqjl/settings/functions');
    }

  } catch (error) {
    console.error('❌ Erro durante setup:', error.message);
  }
}

setupSystem();
