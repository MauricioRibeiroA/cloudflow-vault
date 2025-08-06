import 'dotenv/config';
import { S3Client, PutObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';

const s3Client = new S3Client({
  region: process.env.VITE_B2_REGION,
  endpoint: process.env.VITE_B2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.VITE_B2_ACCESS_KEY_ID,
    secretAccessKey: process.env.VITE_B2_SECRET_ACCESS_KEY,
  },
  forcePathStyle: true,
});

// Diferentes caminhos para testar
const prefix = 'cloud-vault/';

const testPaths = [
  `${prefix}test.json`,
  `${prefix}uploads/test.json`,
  `${prefix}files/test.json`,
  `${prefix}documents/test.json`,
  `${prefix}temp/test.json`,
  `${prefix}public/test.json`
];

const testContent = JSON.stringify({
  message: 'Teste de upload CRUD',
  timestamp: new Date().toISOString(),
  success: true
}, null, 2);

async function testUploadPath(path) {
  console.log(`\n📤 Testando upload para: ${path}`);
  
  try {
    const command = new PutObjectCommand({
      Bucket: process.env.VITE_B2_BUCKET_NAME,
      Key: path,
      Body: testContent,
      ContentType: 'application/json',
    });

    const response = await s3Client.send(command);
    console.log('✅ Upload funcionou!');
    return { path, success: true };
  } catch (error) {
    console.log(`❌ Erro: ${error.message}`);
    return { path, success: false, error: error.message };
  }
}

async function testListWithPrefix(prefix = '') {
  console.log(`\n📁 Testando listagem com prefixo: '${prefix}'`);
  
  try {
    const command = new ListObjectsV2Command({
      Bucket: process.env.VITE_B2_BUCKET_NAME,
      MaxKeys: 5,
      Prefix: prefix
    });
    
    const response = await s3Client.send(command);
    console.log('✅ Listagem funcionou!');
    console.log(`📁 Encontrados ${response.KeyCount} objetos`);
    
    if (response.Contents && response.Contents.length > 0) {
      console.log('📊 Primeiros arquivos:');
      response.Contents.slice(0, 3).forEach(obj => {
        console.log(`   - ${obj.Key}`);
      });
    }
    
    return { prefix, success: true, count: response.KeyCount };
  } catch (error) {
    console.log(`❌ Erro: ${error.message}`);
    return { prefix, success: false, error: error.message };
  }
}

async function runTests() {
  console.log('🚀 Testando uploads e listagens com diferentes caminhos...');
  console.log(`📋 Bucket: ${process.env.VITE_B2_BUCKET_NAME}`);
  
  const results = [];
  
  // Teste 1: Tentar uploads em diferentes caminhos
  console.log('\n=== TESTE DE UPLOADS ===');
  for (const path of testPaths) {
    const result = await testUploadPath(path);
    results.push(result);
    
    if (result.success) {
      console.log(`🎉 UPLOAD FUNCIONOU EM: ${path}`);
      break; // Se um funcionou, não precisa testar todos
    }
  }
  
  // Teste 2: Tentar listagens com diferentes prefixos
  console.log('\n=== TESTE DE LISTAGENS ===');
const prefixes = [prefix, 'uploads/', 'files/', 'documents/', 'temp/', 'public/'];
  
  for (const testPrefix of prefixes) {
    const result = await testListWithPrefix(testPrefix);
    if (result.success) {
      console.log(`🎉 LISTAGEM FUNCIONOU COM PREFIXO: '${testPrefix}'`);
      break;
    }
  }
  
  console.log('\n📊 RESUMO:');
  const uploadSuccess = results.some(r => r.success);
  console.log(`Uploads: ${uploadSuccess ? '✅ Funcionaram' : '❌ Falharam'}`);
}

runTests();
