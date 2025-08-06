import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://hklknoybvonvzwfjvqjl.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhrbGtub3lidm9udnp3Zmp2cWpsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMzOTc3MjcsImV4cCI6MjA2ODk3MzcyN30.TfjGqM9jprdWkOUfxeJYiE9CFTud01UjCN8Yngd5LJQ';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function testDeleteFolder() {
  console.log('🗑️ Testando delete recursivo de pasta...\n');
  
  // Primeiro vamos criar uma pasta de teste com alguns arquivos
  try {
    console.log('1️⃣ Criando pasta de teste...');
    await supabase.functions.invoke('b2-proxy', {
      body: { action: 'createFolder', folderPath: 'test-delete-folder' }
    });
    
    console.log('2️⃣ Simulando criação de arquivo na pasta (via upload simulado)...');
    // Aqui poderíamos criar um arquivo, mas para o teste vamos apenas deletar uma pasta existente
    
    console.log('3️⃣ Listando pastas existentes para escolher uma para testar...');
    const { data: listData } = await supabase.functions.invoke('b2-proxy', {
      body: { action: 'list', path: '' }
    });
    
    console.log('📂 Pastas encontradas:', listData?.files?.filter(f => f.isFolder).map(f => f.name));
    
    // Vamos tentar deletar uma pasta específica que sabemos que existe
    const folderToDelete = 'teste3'; // Uma das pastas que vimos nos testes anteriores
    
    console.log(`4️⃣ Testando delete recursivo da pasta: ${folderToDelete}`);
    
    const { data: deleteData, error: deleteError } = await supabase.functions.invoke('b2-proxy', {
      body: { 
        action: 'deleteFolder',
        folderPath: folderToDelete
      }
    });
    
    if (deleteError) {
      console.error('❌ Erro no delete:', deleteError);
      return;
    }
    
    console.log('✅ Resultado do delete:', deleteData);
    console.log(`🗑️ Pasta deletada: ${deleteData.folderPath}`);
    console.log(`📊 Objetos deletados: ${deleteData.totalDeleted}`);
    console.log('🔍 Objetos deletados:', deleteData.deletedObjects);
    
    // Verificar se a pasta realmente foi deletada
    console.log('5️⃣ Verificando se a pasta foi realmente deletada...');
    const { data: verifyData } = await supabase.functions.invoke('b2-proxy', {
      body: { action: 'list', path: '' }
    });
    
    const folderStillExists = verifyData?.files?.some(f => f.isFolder && f.name === folderToDelete);
    
    if (folderStillExists) {
      console.log('❌ FALHA: Pasta ainda existe após delete!');
    } else {
      console.log('✅ SUCESSO: Pasta foi completamente deletada!');
    }
    
  } catch (error) {
    console.error('💥 Erro no teste:', error);
  }
}

testDeleteFolder();
