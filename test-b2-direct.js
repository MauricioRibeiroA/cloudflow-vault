// Teste direto do Backblaze B2 via Edge Functions
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://hklknoybvonvzwfjvqjl.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhrbGtub3lidm9udnp3Zmp2cWpsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMzOTc3MjcsImV4cCI6MjA2ODk3MzcyN30.TfjGqM9jprdWkOUfxeJYiE9CFTud01UjCN8Yngd5LJQ";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function testB2Operations() {
  console.log('🚀 Testando operações Backblaze B2...');
  
  try {
    // 1. Login primeiro
    console.log('\n1. Fazendo login...');
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: 'mauricioribeiro61@gmail.com',
      password: '123456'
    });
    
    if (authError) {
      console.error('❌ Erro no login:', authError.message);
      return;
    }
    
    console.log('✅ Login realizado');
    const token = authData.session.access_token;
    
    // 2. Teste POST - Upload de arquivo JSON
    console.log('\n2. Testando POST (Upload JSON)...');
    
    // Criar JSON de teste
    const testData = {
      message: "Teste Backblaze B2",
      timestamp: new Date().toISOString(),
      user: "mauricioribeiro61@gmail.com",
      test: true
    };
    
    // Converter para Blob
    const jsonBlob = new Blob([JSON.stringify(testData, null, 2)], { 
      type: 'application/json' 
    });
    
    // Simular File object
    const testFile = new File([jsonBlob], 'test-b2.json', { 
      type: 'application/json' 
    });
    
    // Obter URL assinada para upload
    console.log('   Obtendo URL assinada...');
    const { data: uploadData, error: uploadError } = await supabase.functions.invoke(
      'b2-upload-url',
      {
        headers: { Authorization: `Bearer ${token}` },
        body: {
          fileName: testFile.name,
          fileSize: testFile.size,
          fileType: testFile.type,
          folderId: null,
          company_id: null,
          group_name: 'super_admin'
        }
      }
    );
    
    if (uploadError) {
      console.error('❌ Erro ao obter URL de upload:', uploadError);
      return;
    }
    
    console.log('✅ URL assinada obtida');
    console.log('   Signed URL:', uploadData.signedUrl);
    
    // Fazer upload direto para B2
    console.log('   Fazendo upload para B2...');
    const uploadResponse = await fetch(uploadData.signedUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': testFile.type
      },
      body: testFile
    });
    
    console.log('📊 Status do POST:', uploadResponse.status);
    if (uploadResponse.status === 200) {
      console.log('✅ POST realizado com sucesso!');
      
      // Salvar metadados
      console.log('   Salvando metadados...');
      const { error: metaError } = await supabase.functions.invoke(
        'b2-file-manager',
        {
          headers: { Authorization: `Bearer ${token}` },
          body: {
            action: 'save_metadata',
            fileName: testFile.name,
            filePath: uploadData.filePath,
            fileSize: testFile.size,
            fileType: testFile.type,
            folderId: null,
            company_id: null,
            group_name: 'super_admin'
          }
        }
      );
      
      if (metaError) {
        console.error('⚠️  Erro ao salvar metadados:', metaError);
      } else {
        console.log('✅ Metadados salvos');
      }
      
      // 3. Teste GET - Download do arquivo
      console.log('\n3. Testando GET (Download)...');
      
      const { data: downloadData, error: downloadError } = await supabase.functions.invoke(
        'b2-file-manager',
        {
          headers: { Authorization: `Bearer ${token}` },
          body: {
            action: 'get_download_url',
            file_path: uploadData.filePath,
            company_id: null,
            group_name: 'super_admin'
          }
        }
      );
      
      if (downloadError) {
        console.error('❌ Erro ao obter URL de download:', downloadError);
        return;
      }
      
      console.log('✅ URL de download obtida');
      
      // Fazer download
      const downloadResponse = await fetch(downloadData.downloadUrl);
      console.log('📊 Status do GET:', downloadResponse.status);
      
      if (downloadResponse.status === 200) {
        console.log('✅ GET realizado com sucesso!');
        
        const downloadedContent = await downloadResponse.text();
        const parsedData = JSON.parse(downloadedContent);
        
        console.log('📄 Conteúdo baixado:');
        console.log(JSON.stringify(parsedData, null, 2));
        
        // Verificar se é o mesmo conteúdo
        if (parsedData.message === testData.message) {
          console.log('✅ Conteúdo íntegro - Teste completo realizado com sucesso!');
          console.log('\n🎉 BACKBLAZE B2 FUNCIONANDO 100%!');
          console.log('   ✅ POST: Status 200');
          console.log('   ✅ GET: Status 200');
          console.log('   ✅ Integridade: Confirmada');
        } else {
          console.log('❌ Conteúdo não confere');
        }
        
      } else {
        console.log('❌ GET falhou com status:', downloadResponse.status);
      }
      
    } else {
      console.log('❌ POST falhou com status:', uploadResponse.status);
      console.log('   Resposta:', await uploadResponse.text());
    }
    
  } catch (error) {
    console.error('❌ Erro geral:', error.message);
    console.error('Stack:', error.stack);
  }
}

testB2Operations();
