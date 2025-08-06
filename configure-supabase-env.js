#!/usr/bin/env node

console.log('🔧 Configuração de Variáveis de Ambiente - Supabase Edge Functions');
console.log('');

// Read environment variables from .env file
import fs from 'fs';
import path from 'path';

const envPath = path.join(process.cwd(), '.env');

if (!fs.existsSync(envPath)) {
  console.error('❌ Arquivo .env não encontrado!');
  process.exit(1);
}

const envContent = fs.readFileSync(envPath, 'utf8');
const envVars = {};

envContent.split('\n').forEach(line => {
  const [key, value] = line.split('=');
  if (key && value) {
    envVars[key.trim()] = value.trim();
  }
});

console.log('📋 Variáveis encontradas no .env:');
console.log('');

const requiredVars = [
  'VITE_B2_ACCESS_KEY_ID',
  'VITE_B2_SECRET_ACCESS_KEY', 
  'VITE_B2_REGION',
  'VITE_B2_ENDPOINT',
  'VITE_B2_BUCKET_NAME'
];

const supabaseVars = {};
let allPresent = true;

requiredVars.forEach(key => {
  if (envVars[key]) {
    const supabaseKey = key.replace('VITE_', '');
    supabaseVars[supabaseKey] = envVars[key];
    console.log(`✅ ${key}: ${envVars[key]}`);
  } else {
    console.log(`❌ ${key}: NÃO ENCONTRADA`);
    allPresent = false;
  }
});

if (!allPresent) {
  console.log('');
  console.log('❌ Algumas variáveis estão faltando no arquivo .env');
  process.exit(1);
}

console.log('');
console.log('🎯 CONFIGURAÇÃO NECESSÁRIA NO SUPABASE:');
console.log('');
console.log('1. Acesse: https://supabase.com/dashboard/project/hklknoybvonvzwfjvqjl/settings/functions');
console.log('2. Vá na seção "Environment variables"');
console.log('3. Adicione as seguintes variáveis:');
console.log('');

Object.entries(supabaseVars).forEach(([key, value]) => {
  if (key.includes('SECRET')) {
    console.log(`   ${key} = [VALOR_SECRETO_DEFINIDO]`);
  } else {
    console.log(`   ${key} = ${value}`);
  }
});

console.log('');
console.log('📝 COMANDOS PARA USAR COM SUPABASE CLI (se tiver instalado):');
console.log('');
Object.entries(supabaseVars).forEach(([key, value]) => {
  console.log(`supabase secrets set ${key}="${value}"`);
});

console.log('');
console.log('⚠️  IMPORTANTE:');
console.log('- Após adicionar as variáveis, as Edge Functions precisam ser redeployadas');
console.log('- Pode levar alguns minutos para ficarem disponíveis');
console.log('- Teste novamente após a configuração');
