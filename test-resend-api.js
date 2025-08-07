// Script de teste para APIs do Resend
// Para testar: node test-resend-api.js

const testResendAPI = async (apiKey, fromEmail, description) => {
  console.log(`\n🧪 TESTANDO: ${description}`);
  console.log(`📧 From: ${fromEmail}`);
  console.log(`🔑 API Key: ${apiKey.substring(0, 10)}...`);
  
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromEmail,
        to: ['delivered@resend.dev'], // Email de teste do Resend
        subject: `🧪 Teste CloudFlow Vault - ${description}`,
        html: `
          <h2>🧪 Teste de Email</h2>
          <p><strong>API:</strong> ${description}</p>
          <p><strong>From:</strong> ${fromEmail}</p>
          <p><strong>Horário:</strong> ${new Date().toLocaleString()}</p>
          <p>Se você recebeu este email, a API está funcionando! ✅</p>
        `,
      }),
    });

    const result = await response.json();
    
    if (response.ok) {
      console.log(`✅ SUCESSO: Email enviado!`);
      console.log(`📨 ID do email: ${result.id}`);
      return true;
    } else {
      console.log(`❌ ERRO: ${response.status}`);
      console.log(`💬 Mensagem: ${result.message || 'Erro desconhecido'}`);
      return false;
    }
    
  } catch (error) {
    console.log(`💥 ERRO DE CONEXÃO: ${error.message}`);
    return false;
  }
};

const runTests = async () => {
  console.log('🚀 INICIANDO TESTES DE API DO RESEND');
  console.log('=' * 50);
  
  // API Keys
  const onboardingKey = 're_UfpLNwAw_JeoV8LowPLKN5vuMtAKeDLtZ';
  const personalizedKey = 're_2x6oeYd8_NL7wh5bCHp85rVihEEwSwcZL';
  
  // Teste 1: API de Onboarding
  const test1 = await testResendAPI(
    onboardingKey,
    'CloudFlow Vault <onboarding@resend.dev>',
    'API Onboarding'
  );
  
  // Aguardar um pouco entre os testes
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Teste 2: API Personalizada com domínio onboarding
  const test2 = await testResendAPI(
    personalizedKey,
    'CloudFlow Vault <onboarding@resend.dev>',
    'API Personalizada (com domínio onboarding)'
  );
  
  // Aguardar um pouco entre os testes
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Teste 3: API Personalizada com domínio próprio (deve falhar)
  const test3 = await testResendAPI(
    personalizedKey,
    'CloudFlow Vault <noreply@cloudflowvault.com>',
    'API Personalizada (com domínio próprio - deve falhar)'
  );
  
  console.log('\n📊 RESUMO DOS TESTES:');
  console.log('=' * 50);
  console.log(`🧪 Teste 1 (Onboarding Key + Onboarding Domain): ${test1 ? '✅ PASSOU' : '❌ FALHOU'}`);
  console.log(`🧪 Teste 2 (Personal Key + Onboarding Domain): ${test2 ? '✅ PASSOU' : '❌ FALHOU'}`);
  console.log(`🧪 Teste 3 (Personal Key + Custom Domain): ${test3 ? '✅ PASSOU' : '❌ FALHOU'}`);
  
  console.log('\n🎯 RECOMENDAÇÃO:');
  if (test1) {
    console.log('✅ Use a API Key de ONBOARDING no Supabase');
    console.log(`🔑 Chave: ${onboardingKey}`);
  } else if (test2) {
    console.log('✅ Use a API Key PERSONALIZADA no Supabase');
    console.log(`🔑 Chave: ${personalizedKey}`);
  } else {
    console.log('❌ Nenhuma API funcionou. Verifique suas configurações no Resend.');
  }
};

// Executar os testes
runTests().catch(console.error);
