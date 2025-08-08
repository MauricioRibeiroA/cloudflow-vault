// Edge Function temporária para atualizar os planos
// Depois de executar uma vez, esta função pode ser removida

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  console.log('🚀 Iniciando atualização dos planos...')
  
  try {
    // Import Supabase client
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2')
    
    // Get Supabase URL and key from environment
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    
    // 1. Deletar planos antigos
    console.log('🗑️ Removendo planos antigos...')
    const { error: deleteError } = await supabase
      .from('plans')
      .delete()
      .neq('id', 'null') // Delete all records
    
    if (deleteError) {
      console.error('❌ Erro ao deletar planos antigos:', deleteError)
      throw deleteError
    }
    
    console.log('✅ Planos antigos removidos')
    
    // 2. Inserir novos planos
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
      throw insertError
    }
    
    console.log('✅ Novos planos inseridos com sucesso!')
    
    // 3. Verificar planos atualizados
    const { data: allPlans, error: selectError } = await supabase
      .from('plans')
      .select('*')
      .order('price_brl', { ascending: true })
    
    if (selectError) {
      throw selectError
    }
    
    console.log('📋 Planos atualizados:')
    allPlans.forEach(plan => {
      console.log(`  • ${plan.name}: R$ ${plan.price_brl} - ${plan.storage_limit_gb}GB - ${plan.max_users} usuários`)
    })
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Planos atualizados com sucesso!',
        plans: allPlans
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
    
  } catch (error) {
    console.error('💥 Erro:', error)
    
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message || 'Erro desconhecido',
        details: error
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
