// VERSÃO ULTRA-SIMPLIFICADA PARA DEBUG DO PROBLEMA
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  console.log('🎯 ULTRA-SIMPLE Edge Function iniciada')
  
  if (req.method === 'OPTIONS') {
    console.log('✅ CORS preflight - retornando headers')
    return new Response(null, { headers: corsHeaders })
  }
  
  console.log('📥 Method:', req.method)
  
  // SEMPRE RETORNA SUCESSO, SEM IMPORTAR O REQUEST
  const response = {
    success: true,
    message: 'Email enviado com sucesso (simulado)',
    emailId: `ultra_sim_${Date.now()}`,
    version: 'ultra-simplificada-v1',
    timestamp: new Date().toISOString()
  }
  
  console.log('✅ Retornando:', response)
  
  return new Response(
    JSON.stringify(response),
    { 
      status: 200, 
      headers: { 
        ...corsHeaders, 
        'Content-Type': 'application/json' 
      } 
    }
  )
})
