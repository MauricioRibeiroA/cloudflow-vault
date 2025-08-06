import 'dotenv/config';

const B2_KEY_ID = process.env.VITE_B2_ACCESS_KEY_ID;
const B2_APP_KEY = process.env.VITE_B2_SECRET_ACCESS_KEY;

async function testB2Api() {
  console.log('🔐 Testando credenciais na API nativa do Backblaze...');
  console.log('Key ID:', B2_KEY_ID);
  console.log('App Key:', B2_APP_KEY ? `${B2_APP_KEY.substring(0, 8)}...` : 'não encontrada');
  
  try {
    // 1. Autorizar com a API B2
    console.log('\n📝 1. Testando autorização...');
    
    const authString = Buffer.from(`${B2_KEY_ID}:${B2_APP_KEY}`).toString('base64');
    
    const authResponse = await fetch('https://api.backblazeb2.com/b2api/v2/b2_authorize_account', {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${authString}`
      }
    });
    
    if (!authResponse.ok) {
      const error = await authResponse.text();
      console.log('❌ Falha na autorização:', authResponse.status, error);
      return;
    }
    
    const authData = await authResponse.json();
    console.log('✅ Autorização bem-sucedida!');
    console.log('   Account ID:', authData.accountId);
    console.log('   API URL:', authData.apiUrl);
    console.log('   Download URL:', authData.downloadUrl);
    console.log('   Allowed:', authData.allowed);
    
    // 2. Listar buckets
    console.log('\n📦 2. Listando buckets...');
    
    const bucketsResponse = await fetch(`${authData.apiUrl}/b2api/v2/b2_list_buckets`, {
      method: 'POST',
      headers: {
        'Authorization': authData.authorizationToken,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        accountId: authData.accountId
      })
    });
    
    if (!bucketsResponse.ok) {
      const error = await bucketsResponse.text();
      console.log('❌ Falha ao listar buckets:', bucketsResponse.status, error);
      return;
    }
    
    const bucketsData = await bucketsResponse.json();
    console.log('✅ Buckets encontrados:', bucketsData.buckets.length);
    
    bucketsData.buckets.forEach(bucket => {
      console.log(`   📁 ${bucket.bucketName} (${bucket.bucketId})`);
      console.log(`      Tipo: ${bucket.bucketType}`);
      console.log(`      Região: ${bucket.bucketInfo?.region || 'não especificada'}`);
    });
    
    // 3. Verificar bucket específico
    const targetBucket = bucketsData.buckets.find(b => b.bucketName === 'cloud-clients-cloudflow');
    if (targetBucket) {
      console.log('\n🎯 3. Bucket alvo encontrado!');
      console.log('   Nome:', targetBucket.bucketName);
      console.log('   ID:', targetBucket.bucketId);
      console.log('   Tipo:', targetBucket.bucketType);
      console.log('   Região:', targetBucket.bucketInfo?.region || 'não especificada');
      
      // Verificar as permissões permitidas
      console.log('\n🔑 4. Permissões da chave:');
      if (authData.allowed) {
        console.log('   Capabilities:', authData.allowed.capabilities);
        console.log('   Bucket ID:', authData.allowed.bucketId || 'todos os buckets');
        console.log('   Bucket Nome:', authData.allowed.bucketName || 'todos os buckets');
        console.log('   Name Prefix:', authData.allowed.namePrefix || 'sem restrição');
      }
      
      console.log('\n🎉 DIAGNÓSTICO COMPLETO!');
      console.log('✅ Credenciais válidas');
      console.log('✅ Bucket existe');
      console.log('✅ API funcionando');
      
    } else {
      console.log('\n❌ Bucket "cloud-clients-cloudflow" não encontrado!');
      console.log('Buckets disponíveis:', bucketsData.buckets.map(b => b.bucketName));
    }
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
}

testB2Api();
