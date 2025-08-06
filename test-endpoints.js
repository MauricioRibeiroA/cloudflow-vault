import 'dotenv/config';
import { S3Client, HeadBucketCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';

// Diferentes endpoints possíveis para testar
const endpoints = [
  'https://s3.us-east-005.backblazeb2.com',
  'https://s3.us-west-005.backblazeb2.com',
  'https://s3.eu-central-003.backblazeb2.com',
  // Endpoint genérico
  `https://s3.${process.env.VITE_B2_REGION}.backblazeb2.com`
];

const regions = [
  'us-east-005',
  'us-west-005', 
  'eu-central-003'
];

async function testEndpoint(endpoint, region) {
  console.log(`\n🔍 Testando endpoint: ${endpoint} (region: ${region})`);
  
  const s3Client = new S3Client({
    region: region,
    endpoint: endpoint,
    credentials: {
      accessKeyId: process.env.VITE_B2_ACCESS_KEY_ID,
      secretAccessKey: process.env.VITE_B2_SECRET_ACCESS_KEY,
    },
    forcePathStyle: true,
  });

  try {
    // Teste 1: Verificar se bucket existe
    const headCommand = new HeadBucketCommand({
      Bucket: process.env.VITE_B2_BUCKET_NAME,
    });
    
    await s3Client.send(headCommand);
    console.log('✅ Bucket acessível');
    
    // Teste 2: Tentar listar objetos
    const listCommand = new ListObjectsV2Command({
      Bucket: process.env.VITE_B2_BUCKET_NAME,
      MaxKeys: 1
    });
    
    const listResponse = await s3Client.send(listCommand);
    console.log('✅ Listagem funcionou!');
    console.log(`📁 Encontrados ${listResponse.KeyCount} objetos`);
    
    return { endpoint, region, success: true };
    
  } catch (error) {
    console.log(`❌ Erro: ${error.message}`);
    return { endpoint, region, success: false, error: error.message };
  }
}

async function testAllEndpoints() {
  console.log('🚀 Testando diferentes endpoints Backblaze...');
  console.log(`📋 Bucket: ${process.env.VITE_B2_BUCKET_NAME}`);
  console.log(`🔑 Key ID: ${process.env.VITE_B2_ACCESS_KEY_ID}`);
  
  const results = [];
  
  // Primeiro teste com o endpoint atual
  const currentResult = await testEndpoint(
    process.env.VITE_B2_ENDPOINT, 
    process.env.VITE_B2_REGION
  );
  results.push(currentResult);
  
  // Se o atual não funcionou, teste outros
  if (!currentResult.success) {
    for (let i = 0; i < endpoints.length; i++) {
      if (endpoints[i] !== process.env.VITE_B2_ENDPOINT) {
        const result = await testEndpoint(endpoints[i], regions[i] || 'us-east-005');
        results.push(result);
        
        if (result.success) {
          console.log(`\n🎉 ENCONTRADO ENDPOINT FUNCIONAL!`);
          console.log(`✅ Endpoint: ${result.endpoint}`);
          console.log(`✅ Region: ${result.region}`);
          break;
        }
      }
    }
  }
  
  console.log('\n📊 Resumo dos testes:');
  results.forEach(result => {
    console.log(`${result.success ? '✅' : '❌'} ${result.endpoint} (${result.region})`);
    if (!result.success) {
      console.log(`   Erro: ${result.error}`);
    }
  });
}

testAllEndpoints();
