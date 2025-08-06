const { S3Client, ListObjectsV2Command, PutObjectCommand } = require('@aws-sdk/client-s3');
require('dotenv').config({ path: '.env.local' });

// Configuração do cliente S3 para Backblaze B2
const s3Client = new S3Client({
  endpoint: process.env.B2_ENDPOINT,
  region: process.env.B2_REGION,
  credentials: {
    accessKeyId: process.env.B2_ACCESS_KEY_ID,
    secretAccessKey: process.env.B2_SECRET_ACCESS_KEY,
  },
  forcePathStyle: true,
  // Configurações específicas para Backblaze B2
  signingEscapePath: false,
  useAccelerateEndpoint: false,
  useDualstackEndpoint: false,
  maxAttempts: 3,
  requestHandler: {
    requestTimeout: 30000,
  },
});

const BUCKET_NAME = process.env.B2_BUCKET_NAME;
const NAME_PREFIX = 'cloud-vault/';

async function testConnection() {
  console.log('🧪 Testando conexão com Backblaze B2...\n');
  
  console.log('📋 Configurações:');
  console.log(`   Endpoint: ${process.env.B2_ENDPOINT}`);
  console.log(`   Region: ${process.env.B2_REGION}`);
  console.log(`   Bucket: ${BUCKET_NAME}`);
  console.log(`   Prefix: ${NAME_PREFIX}`);
  console.log(`   Key ID: ${process.env.B2_ACCESS_KEY_ID}\n`);

  try {
    // Teste 1: Listar objetos
    console.log('🔍 Teste 1: Listando objetos...');
    const listCommand = new ListObjectsV2Command({
      Bucket: BUCKET_NAME,
      Prefix: NAME_PREFIX,
      MaxKeys: 5,
    });

    const listResponse = await s3Client.send(listCommand);
    console.log(`✅ Sucesso! Encontrados ${listResponse.Contents?.length || 0} objetos`);
    
    if (listResponse.Contents && listResponse.Contents.length > 0) {
      console.log('   Primeiros arquivos:');
      listResponse.Contents.slice(0, 3).forEach(obj => {
        console.log(`   - ${obj.Key} (${obj.Size} bytes)`);
      });
    }

    // Teste 2: Upload de arquivo de teste
    console.log('\n📤 Teste 2: Upload de arquivo de teste...');
    const testContent = JSON.stringify({
      test: true,
      timestamp: new Date().toISOString(),
      message: 'Teste de conexão Backblaze B2'
    }, null, 2);

    const putCommand = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: NAME_PREFIX + 'test-connection.json',
      Body: testContent,
      ContentType: 'application/json',
    });

    await s3Client.send(putCommand);
    console.log('✅ Upload realizado com sucesso!');
    console.log(`   Arquivo: ${NAME_PREFIX}test-connection.json`);
    console.log(`   Tamanho: ${testContent.length} bytes`);

    console.log('\n🎉 Todos os testes passaram! Backblaze B2 está funcionando corretamente.');
    return true;

  } catch (error) {
    console.error('\n❌ Erro nos testes:', error.message);
    
    if (error.Code) {
      console.error(`   Código: ${error.Code}`);
    }
    if (error.$metadata) {
      console.error(`   Status HTTP: ${error.$metadata.httpStatusCode}`);
    }
    
    return false;
  }
}

// Executa o teste
testConnection()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('Erro fatal:', error);
    process.exit(1);
  });
