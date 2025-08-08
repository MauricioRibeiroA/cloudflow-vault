import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { supabase } from '@/integrations/supabase/client'
import { Shield, AlertTriangle, CheckCircle2, XCircle, RefreshCw } from 'lucide-react'

export default function UpdatePlans() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  const updatePlans = async () => {
    setLoading(true)
    setResult(null)
    setError(null)

    try {
      console.log('🚀 Chamando Edge Function update-plans...')
      
      const { data, error: functionError } = await supabase.functions.invoke('update-plans', {
        body: {}
      })

      if (functionError) {
        console.error('❌ Erro da Edge Function:', functionError)
        setError(`Erro da Edge Function: ${functionError.message}`)
        return
      }

      if (data && data.success) {
        console.log('✅ Planos atualizados com sucesso:', data)
        setResult(data)
      } else {
        console.error('❌ Falha na atualização:', data)
        setError(data?.error || 'Falha na atualização dos planos')
      }

    } catch (err: any) {
      console.error('💥 Erro geral:', err)
      setError(err.message || 'Erro desconhecido')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-surface p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 text-3xl font-bold text-primary mb-4">
            <Shield className="h-8 w-8" />
            CloudFlow Vault - Atualização de Planos
          </div>
          <p className="text-muted-foreground">
            Use esta página para atualizar os valores dos planos no banco de dados
          </p>
        </div>

        {/* Warning Card */}
        <Card className="mb-6 border-orange-200 bg-orange-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-orange-800">
              <AlertTriangle className="h-5 w-5" />
              ⚠️ Atenção
            </CardTitle>
          </CardHeader>
          <CardContent className="text-orange-700">
            <p className="mb-3">Esta operação irá:</p>
            <ul className="list-disc list-inside space-y-1 mb-4">
              <li>Deletar todos os planos existentes no banco de dados</li>
              <li>Inserir os novos planos com valores atualizados</li>
              <li>Atualizar automaticamente a landing page</li>
            </ul>
            <p className="text-sm font-semibold">
              ⚠️ Execute apenas uma vez! Após a atualização, os novos valores aparecerão na landing page.
            </p>
          </CardContent>
        </Card>

        {/* New Plans Preview */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>📊 Novos Valores dos Planos</CardTitle>
            <CardDescription>
              Estes valores serão inseridos no banco de dados:
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="border rounded-lg p-4 bg-blue-50">
                <h3 className="font-bold text-lg text-blue-800">Starter</h3>
                <p className="text-2xl font-bold text-blue-600">R$ 29,90/mês</p>
                <ul className="text-sm text-blue-700 mt-2 space-y-1">
                  <li>• 100 GB armazenamento</li>
                  <li>• 4 usuários</li>
                  <li>• 30 GB download/mês</li>
                </ul>
              </div>

              <div className="border rounded-lg p-4 bg-green-50 border-green-200">
                <h3 className="font-bold text-lg text-green-800">Pro</h3>
                <p className="text-2xl font-bold text-green-600">R$ 49,90/mês</p>
                <ul className="text-sm text-green-700 mt-2 space-y-1">
                  <li>• 250 GB armazenamento</li>
                  <li>• 6 usuários</li>
                  <li>• 75 GB download/mês</li>
                  <li>• Backup semanal</li>
                </ul>
              </div>

              <div className="border rounded-lg p-4 bg-purple-50">
                <h3 className="font-bold text-lg text-purple-800">Business</h3>
                <p className="text-2xl font-bold text-purple-600">R$ 79,90/mês</p>
                <ul className="text-sm text-purple-700 mt-2 space-y-1">
                  <li>• 500 GB armazenamento</li>
                  <li>• 12 usuários</li>
                  <li>• 150 GB download/mês</li>
                  <li>• Recursos avançados</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Action Card */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>🚀 Executar Atualização</CardTitle>
            <CardDescription>
              Clique no botão abaixo para atualizar os planos no banco de dados
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={updatePlans} 
              disabled={loading}
              className="w-full text-lg py-3"
              variant="default"
            >
              {loading ? (
                <>
                  <RefreshCw className="mr-2 h-5 w-5 animate-spin" />
                  Atualizando Planos...
                </>
              ) : (
                <>
                  🔄 Atualizar Planos no Banco de Dados
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Success Result */}
        {result && result.success && (
          <Card className="mb-6 border-green-200 bg-green-50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-green-800">
                <CheckCircle2 className="h-5 w-5" />
                ✅ Atualização Concluída!
              </CardTitle>
            </CardHeader>
            <CardContent className="text-green-700">
              <p className="mb-4 font-semibold">{result.message}</p>
              <div className="space-y-2">
                <h4 className="font-semibold">Planos atualizados:</h4>
                {result.plans && result.plans.map((plan: any) => (
                  <div key={plan.id} className="bg-white p-3 rounded border">
                    <p className="font-semibold">{plan.name}</p>
                    <p>R$ {plan.price_brl} • {plan.storage_limit_gb}GB • {plan.max_users} usuários • {plan.download_limit_gb}GB/mês</p>
                  </div>
                ))}
              </div>
              <div className="mt-4 p-3 bg-green-100 rounded">
                <p className="font-semibold text-green-800">🎉 Próximos passos:</p>
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>Acesse a landing page para ver os novos valores</li>
                  <li>Teste a funcionalidade de planos no sistema</li>
                  <li>Esta página pode ser removida ou desabilitada</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Error Result */}
        {error && (
          <Card className="mb-6 border-red-200 bg-red-50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-red-800">
                <XCircle className="h-5 w-5" />
                ❌ Erro na Atualização
              </CardTitle>
            </CardHeader>
            <CardContent className="text-red-700">
              <p className="font-semibold mb-2">Erro encontrado:</p>
              <pre className="bg-white p-3 rounded border text-sm overflow-x-auto">
                {error}
              </pre>
              <div className="mt-4 p-3 bg-red-100 rounded">
                <p className="font-semibold text-red-800">🔧 Soluções:</p>
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>Verifique se a Edge Function foi deployada corretamente</li>
                  <li>Execute o SQL manualmente no Dashboard do Supabase</li>
                  <li>Verifique as permissões do banco de dados</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Back Link */}
        <div className="text-center">
          <a 
            href="/" 
            className="text-primary hover:underline"
          >
            ← Voltar para a Landing Page
          </a>
        </div>
      </div>
    </div>
  )
}
