import 'dotenv/config';
import { S3Client, HeadBucketCommand } from '@aws-sdk/client-s3';

const s3Client = new S3Client({
  region: process.env.VITE_B2_REGION,
  endpoint: process.env.VITE_B2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.VITE_B2_ACCESS_KEY_ID,
    secretAccessKey: process.env.VITE_B2_SECRET_ACCESS_KEY,
  },
  forcePathStyle: true,
});

async function testBucketExists() {
  console.log('🔍 Testando se o bucket existe...');
  console.log('📋 Configurações:');
  console.log(`   Endpoint: ${process.env.VITE_B2_ENDPOINT}`);
  console.log(`   Region: ${process.env.VITE_B2_REGION}`);
  console.log(`   Bucket: ${process.env.VITE_B2_BUCKET_NAME}`);
  console.log(`   Key ID: ${process.env.VITE_B2_ACCESS_KEY_ID}`);
  console.log(`   Has Secret: ${!!process.env.VITE_B2_SECRET_ACCESS_KEY}`);

  try {
    const command = new HeadBucketCommand({
      Bucket: process.env.VITE_B2_BUCKET_NAME,
    });

    const response = await s3Client.send(command);
    console.log('✅ Bucket existe e é acessível!');
    console.log('📊 Resposta:', response);
    return true;
  } catch (error) {
    console.log('❌ Erro ao verificar bucket:', error.message);
    console.log('🔧 Detalhes do erro:', error);
    return false;
  }
}

testBucketExists();
