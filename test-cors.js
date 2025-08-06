import 'dotenv/config';
import fetch from 'node-fetch';

async function testCorsRequest() {
  console.log('🌍 Testando requisição CORS para Backblaze...');
  
  const url = `${process.env.VITE_B2_ENDPOINT}/${process.env.VITE_B2_BUCKET_NAME}/?list-type=2&max-keys=1`;
  
  console.log(`🔗 URL: ${url}`);
  
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Origin': 'http://localhost:8080',
        'Access-Control-Request-Method': 'GET',
        'Access-Control-Request-Headers': 'authorization,content-type',
      }
    });
    
    console.log('📊 Status:', response.status);
    console.log('📊 Headers CORS:');
    console.log('  Access-Control-Allow-Origin:', response.headers.get('access-control-allow-origin'));
    console.log('  Access-Control-Allow-Methods:', response.headers.get('access-control-allow-methods'));
    console.log('  Access-Control-Allow-Headers:', response.headers.get('access-control-allow-headers'));
    
    if (response.status === 200) {
      console.log('✅ Requisição funcionou!');
    } else {
      console.log('❌ Status não é 200');
    }
    
  } catch (error) {
    console.log('❌ Erro na requisição:', error.message);
  }
}

async function testOptionsRequest() {
  console.log('\n🔍 Testando requisição OPTIONS (preflight)...');
  
  const url = `${process.env.VITE_B2_ENDPOINT}/${process.env.VITE_B2_BUCKET_NAME}/`;
  
  try {
    const response = await fetch(url, {
      method: 'OPTIONS',
      headers: {
        'Origin': 'http://localhost:8080',
        'Access-Control-Request-Method': 'GET',
        'Access-Control-Request-Headers': 'authorization,content-type',
      }
    });
    
    console.log('📊 Status OPTIONS:', response.status);
    console.log('📊 Headers CORS OPTIONS:');
    console.log('  Access-Control-Allow-Origin:', response.headers.get('access-control-allow-origin'));
    console.log('  Access-Control-Allow-Methods:', response.headers.get('access-control-allow-methods'));
    console.log('  Access-Control-Allow-Headers:', response.headers.get('access-control-allow-headers'));
    
  } catch (error) {
    console.log('❌ Erro na requisição OPTIONS:', error.message);
  }
}

async function runCorsTests() {
  await testCorsRequest();
  await testOptionsRequest();
  
  console.log('\n📁 DICAS PARA CORRIGIR CORS:');
  console.log('1. No console da Backblaze, vá para o seu bucket');
  console.log('2. Acesse a seção "Bucket Settings" > "CORS Rules"');
  console.log('3. Adicione uma regra CORS como:');
  console.log('   {');
  console.log('     "corsRuleName": "downloadFromAnyOrigin",');
  console.log('     "allowedOrigins": [');
  console.log('       "http://localhost:8080",');
  console.log('       "http://192.168.0.114:8080",');
  console.log('       "https://your-production-domain.com"');
  console.log('     ],');
  console.log('     "allowedMethods": ["GET", "POST", "PUT", "DELETE", "HEAD"],');
  console.log('     "allowedHeaders": ["*"],');
  console.log('     "exposeHeaders": ["x-bz-file-name", "x-bz-file-id"],');
  console.log('     "maxAgeSeconds": 3600');
  console.log('   }');
}

runCorsTests();
