import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3';
import dotenv from 'dotenv';
dotenv.config();

// Configuração do cliente S3 para Backblaze B2
const s3Client = new S3Client({
  endpoint: process.env.VITE_B2_ENDPOINT || 'https://s3.us-east-005.backblazeb2.com',
  region: process.env.VITE_B2_REGION || 'us-east-005',
  credentials: {
    accessKeyId: process.env.VITE_B2_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.VITE_B2_SECRET_ACCESS_KEY || '',
  },
  forcePathStyle: true,
  maxAttempts: 3,
});

const BUCKET_NAME = process.env.VITE_B2_BUCKET_NAME || 'cloud-clients-cloudflow';

async function testConnection() {
  try {
    console.log('🔍 Testando conexão Backblaze B2...');
    console.log('📋 Configurações:');
    console.log('   Endpoint:', process.env.VITE_B2_ENDPOINT);
    console.log('   Region:', process.env.VITE_B2_REGION);
    console.log('   Bucket:', BUCKET_NAME);
    console.log('   Key ID:', process.env.VITE_B2_ACCESS_KEY_ID);
    console.log('   Has Secret:', !!process.env.VITE_B2_SECRET_ACCESS_KEY);

    const command = new ListObjectsV2Command({
      Bucket: BUCKET_NAME,
      MaxKeys: 1,
    });

    const response = await s3Client.send(command);
    console.log('✅ Conexão bem-sucedida!');
    console.log('📁 Objetos encontrados:', response.Contents?.length || 0);
    return true;
  } catch (error) {
    console.error('❌ Erro na conexão:', error.message);
    console.error('🔧 Detalhes do erro:', error);
    return false;
  }
}

testConnection();
