// src/pages/Index.tsx
import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { 
  Shield, 
  FileText, 
  Users, 
  Lock, 
  Cloud, 
  Zap, 
  Check, 
  Building2,
  BarChart3,
  Download,
  HardDrive,
  CreditCard,
  Star,
  ArrowRight,
  Globe,
  Database,
  Settings,
  Crown
} from 'lucide-react'
import { supabase } from '@/integrations/supabase/client'

interface Plan {
  id: string
  name: string
  price_brl: number
  storage_limit_gb: number
  download_limit_gb: number
  max_users: number
  features?: string[]
}

export default function Index() {
  const navigate = useNavigate()
  const [plans, setPlans] = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadPlans = async () => {
      try {
        const { data, error } = await supabase
          .from('plans')
          .select('*')
          .gt('price_brl', 0)  // Apenas planos pagos (preço > 0)
          .order('price_brl', { ascending: true })

        if (error) throw error
        
        // Add features to each plan
        const plansWithFeatures = data?.map(plan => ({
          ...plan,
          features: getFeaturesByPlan(plan)
        })) || []
        
        setPlans(plansWithFeatures)
      } catch (err) {
        console.error('Error loading plans:', err)
        // Fallback plans if database is not available
        setPlans(defaultPlans)
      } finally {
        setLoading(false)
      }
    }

    loadPlans()
  }, [])

  const getFeaturesByPlan = (plan: Plan) => {
    const baseFeatures = [
      'Armazenamento seguro na nuvem',
      'Upload e download de arquivos',
      'Interface web intuitiva',
      'Suporte técnico'
    ]

    if (plan.max_users > 1) {
      baseFeatures.push('Gestão de múltiplos usuários')
    }

    if (plan.storage_limit_gb >= 100) {
      baseFeatures.push('Backup automático')
      baseFeatures.push('Logs de auditoria')
    }
    
    // Backup semanal específico para o plano Pro (250GB)
    if (plan.storage_limit_gb === 250 && plan.name === 'Pro') {
      baseFeatures.push('Backup semanal')
    }

    if (plan.storage_limit_gb >= 500) {
      baseFeatures.push('API de integração')
      baseFeatures.push('Relatórios avançados')
      baseFeatures.push('Suporte prioritário')
    }

    return baseFeatures
  }

  const defaultPlans: Plan[] = [
    {
      id: '1',
      name: 'Starter',
      price_brl: 29.90,
      storage_limit_gb: 100,
      download_limit_gb: 30,
      max_users: 4,
      features: [
        'Armazenamento seguro na nuvem',
        'Upload e download de arquivos',
        'Interface web intuitiva',
        'Suporte técnico',
        'Gestão de múltiplos usuários'
      ]
    },
    {
      id: '2',
      name: 'Pro',
      price_brl: 49.90,
      storage_limit_gb: 250,
      download_limit_gb: 75,
      max_users: 6,
      features: [
        'Armazenamento seguro na nuvem',
        'Upload e download de arquivos',
        'Interface web intuitiva',
        'Suporte técnico',
        'Gestão de múltiplos usuários',
        'Backup automático',
        'Logs de auditoria',
        'Backup semanal'
      ]
    },
    {
      id: '3',
      name: 'Business',
      price_brl: 79.90,
      storage_limit_gb: 500,
      download_limit_gb: 150,
      max_users: 12,
      features: [
        'Armazenamento seguro na nuvem',
        'Upload e download de arquivos',
        'Interface web intuitiva',
        'Suporte técnico',
        'Gestão de múltiplos usuários',
        'Backup automático',
        'Logs de auditoria',
        'API de integração',
        'Relatórios avançados',
        'Suporte prioritário'
      ]
    }
  ]

  const features = [
    {
      icon: Cloud,
      title: 'Armazenamento Seguro',
      description: 'Seus arquivos protegidos na nuvem com criptografia de ponta a ponta e backup automático.'
    },
    {
      icon: Users,
      title: 'Gestão de Equipes',
      description: 'Controle completo de usuários, permissões e acesso granular para cada membro da equipe.'
    },
    {
      icon: BarChart3,
      title: 'Dashboard Analytics',
      description: 'Monitore uso, performance e métricas importantes com relatórios detalhados e em tempo real.'
    },
    {
      icon: Lock,
      title: 'Segurança Avançada',
      description: 'Autenticação multi-fator, logs de auditoria e conformidade com padrões empresariais.'
    },
    {
      icon: Database,
      title: 'Integração API',
      description: 'API REST completa para integrar com seus sistemas existentes e automatizar workflows.'
    },
    {
      icon: Crown,
      title: 'Super Admin',
      description: 'Dashboard executivo para monitoramento de todas as empresas, planos e métricas de receita.'
    }
  ]

  const stats = [
    { label: 'Empresas Ativas', value: '500+' },
    { label: 'Arquivos Seguros', value: '1M+' },
    { label: 'Usuários Satisfeitos', value: '10K+' },
    { label: 'Uptime', value: '99.9%' }
  ]

  return (
    <div className="min-h-screen bg-gradient-surface">
      {/* Navigation */}
      <nav className="relative py-4 px-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="inline-flex items-center gap-3 text-2xl font-bold text-primary">
            <Shield className="h-8 w-8" />
            CloudFlow Vault
          </div>
          <Button
            variant="outline"
            onClick={() => navigate('/auth')}
            className="px-6"
          >
            Fazer Login
          </Button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative py-16 px-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20">
        <div className="max-w-6xl mx-auto text-center">
          <h1 className="text-5xl font-bold text-gray-800 dark:text-white mb-6 leading-tight">
            Gestão Inteligente de
            <span className="text-blue-600 dark:text-blue-400">
              {' '}
              Arquivos Corporativos
            </span>
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 mb-8 max-w-3xl mx-auto">
            Plataforma completa para organização, controle de acesso e auditoria de
            documentos empresariais com segurança de nível corporativo e planos flexíveis.
          </p>
        </div>
      </section>

      {/* Trial Section */}
      <section className="py-20 px-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20">
        <div className="max-w-4xl mx-auto text-center">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 border-2 border-blue-200 dark:border-blue-800">
            <div className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-500 to-indigo-500 text-white px-4 py-2 rounded-full text-sm font-medium mb-6">
              🎉 Oferta Especial
            </div>
            
            <h2 className="text-4xl font-bold text-foreground mb-4">
              Teste Gratuito por 7 Dias
            </h2>
            
            <p className="text-xl text-muted-foreground mb-8">
              Experimente todas as funcionalidades do CloudFlow Vault sem compromisso. 
              Cadastre sua empresa agora e comece a usar imediatamente!
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="text-center">
                <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center mx-auto mb-3">
                  <HardDrive className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                </div>
                <h3 className="font-semibold mb-2">50GB Grátis</h3>
                <p className="text-sm text-muted-foreground">Armazenamento completo durante o trial</p>
              </div>
              
              <div className="text-center">
                <div className="w-16 h-16 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Users className="h-8 w-8 text-green-600 dark:text-green-400" />
                </div>
                <h3 className="font-semibold mb-2">3 Usuários</h3>
                <p className="text-sm text-muted-foreground">Convide sua equipe para testar</p>
              </div>
              
              <div className="text-center">
                <div className="w-16 h-16 bg-purple-100 dark:bg-purple-900 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Zap className="h-8 w-8 text-purple-600 dark:text-purple-400" />
                </div>
                <h3 className="font-semibold mb-2">Acesso Total</h3>
                <p className="text-sm text-muted-foreground">Todas as funcionalidades incluídas</p>
              </div>
            </div>
            
            <Button 
              size="lg" 
              variant="gradient" 
              onClick={() => navigate('/signup/company')}
              className="text-lg px-8 py-3"
            >
              🚀 Começar Trial Gratuito Agora
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            
            <p className="text-sm text-muted-foreground mt-4">
              ⏱️ Ativação imediata • 💳 Sem cartão de crédito • ❌ Sem compromisso
            </p>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4 bg-card/30">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-foreground mb-4">
              Recursos Poderosos para Sua Empresa
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Tudo que você precisa para gerenciar arquivos corporativos com segurança e eficiência
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <Card key={index} className="border-0 bg-card/50 backdrop-blur-sm hover:bg-card/70 transition-all duration-300">
                <CardHeader>
                  <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                    <feature.icon className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle className="text-xl">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 bg-gradient-primary">
        <div className="max-w-4xl mx-auto text-center text-white">
          <h2 className="text-4xl font-bold mb-6">
            Pronto para Revolucionar Sua Gestão de Arquivos?
          </h2>
          <p className="text-xl mb-8 opacity-90">
            Experimente todas as funcionalidades sem compromisso e veja como podemos transformar a gestão de documentos da sua empresa.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Button
              size="lg"
              variant="secondary"
              onClick={() => navigate('/signup/company')}
              className="text-lg px-8"
            >
              Começar Trial Gratuito 7 Dias
              <Zap className="ml-2 h-5 w-5" />
            </Button>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-20 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-foreground mb-4">
              Planos que Crescem com Sua Empresa
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Após o trial, escolha o plano ideal para suas necessidades. Todos incluem suporte técnico e atualizações gratuitas.
            </p>
          </div>

          {loading ? (
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {plans.map((plan, index) => (
                <Card key={plan.id} className={`relative border-2 transition-all duration-300 hover:shadow-xl ${
                  index === 1 ? 'border-primary scale-105' : 'border-border hover:border-primary/50'
                }`}>
                  {index === 1 && (
                    <Badge className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-primary">
                      <Star className="w-3 h-3 mr-1" />
                      Mais Popular
                    </Badge>
                  )}
                  
                  <CardHeader className="text-center pb-8">
                    <CardTitle className="text-2xl mb-2">{plan.name}</CardTitle>
                    <div className="text-4xl font-bold text-primary mb-2">
                      R$ {plan.price_brl.toFixed(2)}
                    </div>
                    <p className="text-muted-foreground">por mês</p>
                  </CardHeader>
                  
                  <CardContent className="space-y-6">
                    {/* Plan Specs */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="flex items-center text-sm text-muted-foreground">
                          <HardDrive className="w-4 h-4 mr-2" />
                          Armazenamento
                        </span>
                        <span className="font-semibold">{plan.storage_limit_gb} GB</span>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <span className="flex items-center text-sm text-muted-foreground">
                          <Download className="w-4 h-4 mr-2" />
                          Download Mensal
                        </span>
                        <span className="font-semibold">{plan.download_limit_gb} GB</span>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <span className="flex items-center text-sm text-muted-foreground">
                          <Users className="w-4 h-4 mr-2" />
                          Usuários
                        </span>
                        <span className="font-semibold">{plan.max_users}</span>
                      </div>
                    </div>

                    {/* Features List */}
                    <div className="space-y-2 pt-4 border-t">
                      {plan.features?.map((feature, featureIndex) => (
                        <div key={featureIndex} className="flex items-center text-sm">
                          <Check className="w-4 h-4 text-green-500 mr-3 flex-shrink-0" />
                          <span>{feature}</span>
                        </div>
                      ))}
                    </div>

                    <Button 
                      className="w-full mt-8"
                      variant={index === 1 ? "gradient" : "outline"}
                      onClick={() => navigate('/signup/company')}
                    >
                      Começar Trial Gratuito
                      <CreditCard className="ml-2 h-4 w-4" />
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 bg-card border-t">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-center mb-8">
            <div className="flex items-center gap-3 text-2xl font-bold text-primary">
              <Shield className="h-8 w-8" />
              CloudFlow Vault
            </div>
          </div>
          
          <div className="text-center text-muted-foreground">
            <p className="mb-4">
              © {new Date().getFullYear()} CloudFlow Vault. Todos os direitos reservados.
            </p>
            <p className="text-sm">
              Plataforma segura para gestão de arquivos corporativos • Desenvolvido com ❤️ no Brasil
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
