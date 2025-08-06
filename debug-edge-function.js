import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://hklknoybvonvzwfjvqjl.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhrbGtub3lidm9udnp3Zmp2cWpsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMzOTc3MjcsImV4cCI6MjA2ODk3MzcyN30.TfjGqM9jprdWkOUfxeJYiE9CFTud01UjCN8Yngd5LJQ';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function testFunction() {
  console.log('🔍 Testando Edge Function com diferentes payloads...\n');
  
  // Teste 1: Ação de teste simples
  try {
    console.log('1️⃣ Testando ação "test"...');
    const { data, error } = await supabase.functions.invoke('b2-proxy', {
      body: { action: 'test' }
    });
    
    if (error) {
      console.error('❌ Erro:', error.message);
      console.error('📄 Detalhes:', JSON.stringify(error, null, 2));
    } else {
      console.log('✅ Sucesso:', data);
    }
  } catch (e) {
    console.error('💥 Exceção:', e.message);
  }
  
  console.log('\n' + '='.repeat(50) + '\n');
  
  // Teste 2: Chamada via fetch direta
  try {
    console.log('2️⃣ Testando via fetch direto...');
    const response = await fetch(`${SUPABASE_URL}/functions/v1/b2-proxy`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'apikey': SUPABASE_ANON_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ action: 'test' })
    });
    
    console.log('📊 Status:', response.status);
    console.log('📋 Headers:', Object.fromEntries(response.headers.entries()));
    
    const text = await response.text();
    console.log('📄 Response body:', text);
    
    if (text) {
      try {
        const json = JSON.parse(text);
        console.log('✅ JSON parsed:', json);
      } catch (e) {
        console.log('❌ Não é JSON válido');
      }
    }
    
  } catch (e) {
    console.error('💥 Exceção no fetch:', e.message);
  }
}

testFunction();
