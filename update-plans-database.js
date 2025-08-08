// Script para atualizar os planos no banco de dados
// Execute com: node update-plans-database.js

import { createClient } from '@supabase/supabase-js'

// Configure essas variáveis com os valores do seu projeto Lovable
const SUPABASE_URL = 'https://your-project-url.supabase.co'  // Substitua pela URL do seu projeto
const SUPABASE_SERVICE_ROLE_KEY = 'your-service-role-key'    // Substitua pela service role key

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

async function updatePlans() {
  console.log('🚀 Iniciando atualização dos planos...')
  
  try {
    // 1. Primeiro, vamos deletar os planos existentes
    console.log('🗑️ Removendo planos antigos...')
    const { error: deleteError } = await supabase
      .from('plans')
      .delete()
      .neq('id', 'null') // Delete all records
    
    if (deleteError) {
      console.error('❌ Erro ao deletar planos antigos:', deleteError)
      return
    }
    
    console.log('✅ Planos antigos removidos')
    
    // 2. Inserir os novos planos
    console.log('📝 Inserindo novos planos...')
    const newPlans = [
      {
        name: 'Starter',
        price_brl: 29.90,
        storage_limit_gb: 100,
        download_limit_gb: 30,
        max_users: 4
      },
      {
        name: 'Pro', 
        price_brl: 49.90,
        storage_limit_gb: 250,
        download_limit_gb: 75,
        max_users: 6
      },
      {
        name: 'Business',
        price_brl: 79.90,
        storage_limit_gb: 500,
        download_limit_gb: 150,
        max_users: 12
      }
    ]
    
    const { data, error: insertError } = await supabase
      .from('plans')
      .insert(newPlans)
      .select()
    
    if (insertError) {
      console.error('❌ Erro ao inserir novos planos:', insertError)
      return
    }
    
    console.log('✅ Novos planos inseridos com sucesso!')
    console.log('📊 Planos criados:')
    data.forEach(plan => {
      console.log(`  • ${plan.name}: R$ ${plan.price_brl} - ${plan.storage_limit_gb}GB - ${plan.max_users} usuários`)
    })
    
    // 3. Verificar os planos atualizados
    console.log('\n🔍 Verificando planos no banco...')
    const { data: allPlans, error: selectError } = await supabase
      .from('plans')
      .select('*')
      .order('price_brl', { ascending: true })
    
    if (selectError) {
      console.error('❌ Erro ao verificar planos:', selectError)
      return
    }
    
    console.log('📋 Planos atuais no banco de dados:')
    allPlans.forEach(plan => {
      console.log(`  📦 ${plan.name}:`)
      console.log(`     💰 Preço: R$ ${plan.price_brl}/mês`)
      console.log(`     💾 Armazenamento: ${plan.storage_limit_gb} GB`)
      console.log(`     📥 Download/mês: ${plan.download_limit_gb} GB`)
      console.log(`     👥 Usuários: ${plan.max_users}`)
      console.log(`     🆔 ID: ${plan.id}`)
      console.log('')
    })
    
    console.log('🎉 Atualização concluída com sucesso!')
    console.log('\n📝 PRÓXIMOS PASSOS:')
    console.log('1. Acesse sua landing page para verificar os novos valores')
    console.log('2. Teste a criação de um novo usuário para verificar os limites')
    console.log('3. Se ainda não configurou, adicione os DNS records da Resend')
    
  } catch (error) {
    console.error('💥 Erro geral:', error)
  }
}

// Executar o script
updatePlans()

console.log('\n⚠️ IMPORTANTE: Configure as variáveis SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no topo deste arquivo antes de executar!')
console.log('🔍 Você pode encontrar esses valores no painel do Lovable > Settings > API')
