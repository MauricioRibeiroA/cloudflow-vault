// Teste direto do Backblaze B2 com credenciais
import crypto from 'crypto';

// Credenciais do Backblaze B2
const B2_ACCESS_KEY_ID = "005c579be2fa8160000000001";
const B2_SECRET_ACCESS_KEY = "0057af122e0b6d37654098b09c43b696fa338216a1";
const B2_REGION = "us-east-005";
const B2_ENDPOINT = "https://s3.us-east-005.backblazeb2.com";
const B2_BUCKET_NAME = "cloud-clients-cloudflow";

// Função para criar assinatura AWS4
function createSignature(method, path, queryParams, headers, payload, accessKey, secretKey, region, service, timestamp) {
  const dateStamp = timestamp.toISOString().slice(0, 10).replace(/-/g, '');
  const amzDate = timestamp.toISOString().replace(/[:\-]|\.\d{3}/g, '');
  
  // Canonical request
  const canonicalHeaders = Object.keys(headers)
    .sort()
    .map(key => `${key}:${headers[key]}\n`)
    .join('');
  
  const signedHeaders = Object.keys(headers).sort().join(';');
  
  const canonicalRequest = [
    method,
    path,
    queryParams,
    canonicalHeaders,
    signedHeaders,
    crypto.createHash('sha256').update(payload).digest('hex')
  ].join('\n');
  
  // String to sign
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    crypto.createHash('sha256').update(canonicalRequest).digest('hex')
  ].join('\n');
  
  // Signing key
  const kDate = crypto.createHmac('sha256', `AWS4${secretKey}`).update(dateStamp).digest();
  const kRegion = crypto.createHmac('sha256', kDate).update(region).digest();
  const kService = crypto.createHmac('sha256', kRegion).update(service).digest();
  const kSigning = crypto.createHmac('sha256', kService).update('aws4_request').digest();
  
  const signature = crypto.createHmac('sha256', kSigning).update(stringToSign).digest('hex');
  
  return {
    authorization: `AWS4-HMAC-SHA256 Credential=${accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
    amzDate
  };
}

async function testB2Direct() {
  console.log('🚀 Testando Backblaze B2 diretamente...');
  console.log(`📦 Bucket: ${B2_BUCKET_NAME}`);
  console.log(`🌍 Região: ${B2_REGION}`);
  console.log(`🔗 Endpoint: ${B2_ENDPOINT}`);
  
  try {
    // Criar arquivo JSON de teste
    const testData = {
      message: "Teste direto Backblaze B2",
      timestamp: new Date().toISOString(),
      user: "mauricioribeiro61@gmail.com",
      bucket: B2_BUCKET_NAME
    };
    
    const jsonContent = JSON.stringify(testData, null, 2);
    const fileName = 'cloud-vault/test-direct.json'; // Incluindo namePrefix
    const filePath = `/${B2_BUCKET_NAME}/${fileName}`;
    
    // 1. Teste POST (Upload)
    console.log('\n📤 Testando POST (Upload)...');
    
    const timestamp = new Date();
    const headers = {
      'host': 's3.us-east-005.backblazeb2.com',
      'content-type': 'application/json',
      'content-length': jsonContent.length.toString()
    };
    
    const { authorization, amzDate } = createSignature(
      'PUT',
      `/${fileName}`,
      '',
      headers,
      jsonContent,
      B2_ACCESS_KEY_ID,
      B2_SECRET_ACCESS_KEY,
      B2_REGION,
      's3',
      timestamp
    );
    
    const uploadUrl = `${B2_ENDPOINT}/${B2_BUCKET_NAME}/${fileName}`;
    console.log('   URL:', uploadUrl);
    
    const uploadResponse = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        ...headers,
        'Authorization': authorization,
        'X-Amz-Date': amzDate
      },
      body: jsonContent
    });
    
    console.log('📊 Status do POST:', uploadResponse.status);
    
    if (uploadResponse.status === 200) {
      console.log('✅ POST realizado com sucesso!');
      
      // 2. Teste GET (Download)
      console.log('\n📥 Testando GET (Download)...');
      
      const getTimestamp = new Date();
      const getHeaders = {
        'host': 's3.us-east-005.backblazeb2.com'
      };
      
      const { authorization: getAuth, amzDate: getAmzDate } = createSignature(
        'GET',
        `/${fileName}`,
        '',
        getHeaders,
        '',
        B2_ACCESS_KEY_ID,
        B2_SECRET_ACCESS_KEY,
        B2_REGION,
        's3',
        getTimestamp
      );
      
      const downloadResponse = await fetch(uploadUrl, {
        method: 'GET',
        headers: {
          ...getHeaders,
          'Authorization': getAuth,
          'X-Amz-Date': getAmzDate
        }
      });
      
      console.log('📊 Status do GET:', downloadResponse.status);
      
      if (downloadResponse.status === 200) {
        console.log('✅ GET realizado com sucesso!');
        
        const downloadedContent = await downloadResponse.text();
        const parsedData = JSON.parse(downloadedContent);
        
        console.log('📄 Conteúdo baixado:');
        console.log(JSON.stringify(parsedData, null, 2));
        
        if (parsedData.message === testData.message) {
          console.log('\n🎉 BACKBLAZE B2 FUNCIONANDO 100%!');
          console.log('   ✅ POST: Status 200');
          console.log('   ✅ GET: Status 200');
          console.log('   ✅ Integridade: Confirmada');
          console.log('   ✅ Credenciais: Válidas');
        } else {
          console.log('❌ Conteúdo não confere');
        }
      } else {
        console.log('❌ GET falhou');
        console.log('   Resposta:', await downloadResponse.text());
      }
      
    } else {
      console.log('❌ POST falhou');
      console.log('   Status:', uploadResponse.status);
      console.log('   Resposta:', await uploadResponse.text());
    }
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
}

testB2Direct();
