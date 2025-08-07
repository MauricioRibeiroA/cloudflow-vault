// Script para diagnosticar o erro 403 da Resend API
// Vamos testar ambas as API keys que funcionaram localmente

const ONBOARDING_API_KEY = 're_123456789_abcdefghijklmnopqrstuvwxyz1234567890'; // Substitua pela key real
const PERSONALIZED_API_KEY = 're_987654321_zyxwvutsrqponmlkjihgfedcba0987654321'; // Substitua pela key real

async function testResendAPI(apiKey, description) {
  console.log(`\n🧪 Testando ${description}:`);
  console.log(`- API Key: ${apiKey.substring(0, 15)}...${apiKey.substring(apiKey.length - 5)}`);
  
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'CloudFlow Vault <onboarding@resend.dev>',
        to: ['mauricio@cloudflow-vault.com'], // Substitua por um email válido
        subject: '🧪 Teste de API Key - CloudFlow Vault',
        html: `
          <h1>🧪 Teste de API Key</h1>
          <p>Este é um teste da API key: <strong>${description}</strong></p>
          <p>Se você recebeu este email, a API key está funcionando!</p>
          <hr>
          <p>Prefixo da Key: <code>${apiKey.substring(0, 15)}...</code></p>
          <p>Data/Hora: ${new Date().toISOString()}</p>
        `,
      }),
    });

    const result = await response.json();
    
    console.log(`📊 Resultado:`);
    console.log(`- Status: ${response.status}`);
    console.log(`- Success: ${response.ok}`);
    
    if (response.ok) {
      console.log(`✅ Sucesso! Email ID: ${result.id}`);
      return { success: true, emailId: result.id, status: response.status };
    } else {
      console.log(`❌ Falhou!`);
      console.log(`- Error: ${JSON.stringify(result, null, 2)}`);
      return { success: false, error: result, status: response.status };
    }
    
  } catch (error) {
    console.log(`💥 Exceção: ${error.message}`);
    return { success: false, exception: error.message };
  }
}

async function main() {
  console.log('🚀 Iniciando diagnóstico do erro 403 da Resend API...\n');
  
  console.log('⚠️ IMPORTANTE: Substitua as API keys pelos valores reais antes de executar!');
  console.log('📝 As keys devem começar com "re_" e ter aproximadamente 51 caracteres');
  console.log('🔗 URL da Resend API: https://api.resend.com/emails');
  
  // Teste com a API key "onboarding"
  const onboardingResult = await testResendAPI(ONBOARDING_API_KEY, 'API Key Onboarding');
  
  // Teste com a API key "personalized"
  const personalizedResult = await testResendAPI(PERSONALIZED_API_KEY, 'API Key Personalized');
  
  console.log('\n📋 RESUMO DOS TESTES:');
  console.log('='.repeat(50));
  console.log(`Onboarding Key: ${onboardingResult.success ? '✅ Funcionou' : '❌ Falhou'} (Status: ${onboardingResult.status || 'N/A'})`);
  console.log(`Personalized Key: ${personalizedResult.success ? '✅ Funcionou' : '❌ Falhou'} (Status: ${personalizedResult.status || 'N/A'})`);
  
  console.log('\n🔍 PRÓXIMOS PASSOS:');
  if (onboardingResult.success || personalizedResult.success) {
    const workingKey = onboardingResult.success ? ONBOARDING_API_KEY : PERSONALIZED_API_KEY;
    const workingDescription = onboardingResult.success ? 'Onboarding' : 'Personalized';
    
    console.log(`✅ A API key ${workingDescription} está funcionando!`);
    console.log(`🔧 Configure esta key no Supabase como RESEND_API_KEY:`);
    console.log(`   Key: ${workingKey.substring(0, 15)}...${workingKey.substring(workingKey.length - 5)}`);
    console.log(`   Comprimento: ${workingKey.length} caracteres`);
  } else {
    console.log('❌ Ambas as API keys falharam!');
    console.log('🔧 Possíveis soluções:');
    console.log('   1. Verificar se as keys estão corretas');
    console.log('   2. Verificar se as keys não expiraram');
    console.log('   3. Verificar se o domínio está verificado na Resend');
    console.log('   4. Verificar se há limites de envio atingidos');
  }
  
  console.log('\n🏁 Diagnóstico concluído!');
}

main().catch(console.error);
