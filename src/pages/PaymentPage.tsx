import React from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Shield, CreditCard, Clock, CheckCircle2, ArrowLeft, Banknote, QrCode } from 'lucide-react'

export default function PaymentPage() {
  const navigate = useNavigate()
  const { planName } = useParams<{ planName: string }>()
  const location = useLocation()
  
  const { plan, price, companyData } = location.state || {}

  return (
    <div className="min-h-screen bg-gradient-surface">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 text-3xl font-bold text-primary mb-4">
            <Shield className="h-8 w-8" />
            CloudFlow Vault
          </div>
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Finalizar Pagamento
          </h1>
          <p className="text-muted-foreground">
            Complete o pagamento para ativar seu plano {plan}
          </p>
        </div>

        <div className="max-w-4xl mx-auto">
          <Card>
            <CardHeader className="text-center">
              <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Clock className="h-8 w-8 text-yellow-600" />
              </div>
              <CardTitle className="text-2xl">Funcionalidade em Desenvolvimento</CardTitle>
              <CardDescription>
                O sistema de pagamento será implementado em breve
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Resumo do Pedido */}
              <div className="bg-card/50 rounded-lg p-6">
                <h3 className="font-bold text-lg mb-4">📋 Resumo do Pedido</h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Plano:</span>
                    <span className="font-semibold">{plan}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Empresa:</span>
                    <span className="font-semibold">{companyData?.companyName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Administrador:</span>
                    <span className="font-semibold">{companyData?.adminName}</span>
                  </div>
                  <div className="flex justify-between text-xl font-bold text-primary pt-2 border-t">
                    <span>Total:</span>
                    <span>R$ {price?.toFixed(2)}/mês</span>
                  </div>
                </div>
              </div>

              {/* Opções de Pagamento Futuras */}
              <div className="space-y-4">
                <h3 className="font-bold text-lg">🚀 Em Breve - Métodos de Pagamento</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card className="opacity-50">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <CreditCard className="h-6 w-6 text-blue-600" />
                        <div>
                          <h4 className="font-semibold">Cartão de Crédito</h4>
                          <p className="text-sm text-muted-foreground">Via Stripe - Seguro e confiável</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  
                  <Card className="opacity-50">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <QrCode className="h-6 w-6 text-green-600" />
                        <div>
                          <h4 className="font-semibold">PIX</h4>
                          <p className="text-sm text-muted-foreground">Pagamento instantâneo</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>

              {/* Status de Desenvolvimento */}
              <div className="bg-blue-50 dark:bg-blue-950/20 rounded-lg p-6">
                <div className="flex items-center gap-3 mb-3">
                  <CheckCircle2 className="h-6 w-6 text-blue-600" />
                  <h3 className="font-semibold text-blue-900 dark:text-blue-100">
                    Recursos Implementados
                  </h3>
                </div>
                <ul className="space-y-1 text-blue-800 dark:text-blue-200">
                  <li>✅ Sistema de planos configurado</li>
                  <li>✅ Páginas de signup por plano</li>
                  <li>✅ Formulário de dados da empresa</li>
                  <li>⏳ Integração com Stripe (em desenvolvimento)</li>
                  <li>⏳ Integração com PIX (em desenvolvimento)</li>
                  <li>⏳ Criação automática da empresa após pagamento</li>
                </ul>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between pt-6">
                <Button
                  variant="outline"
                  onClick={() => navigate(-1)}
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Voltar
                </Button>
                
                <Button 
                  disabled
                  className="opacity-50"
                >
                  Aguardando Implementação...
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
