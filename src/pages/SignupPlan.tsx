import React, { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Shield, HardDrive, Users, Download, CreditCard, CheckCircle2, Star } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

const PLAN_CONFIGS = {
  starter: {
    name: 'Starter',
    price: 29.90,
    storage: 100,
    users: 4,
    download: 30,
    badge: null,
    color: 'blue',
    features: [
      'Armazenamento seguro na nuvem',
      'Upload e download de arquivos', 
      'Interface web intuitiva',
      'Suporte técnico',
      'Gestão de múltiplos usuários'
    ],
    description: '🚀 Perfeito para empresas em crescimento que precisam de mais capacidade'
  },
  pro: {
    name: 'Pro',
    price: 49.90,
    storage: 250,
    users: 6,
    download: 75,
    badge: { text: 'Mais Popular', icon: Star },
    color: 'green',
    features: [
      'Armazenamento seguro na nuvem',
      'Upload e download de arquivos',
      'Interface web intuitiva', 
      'Suporte técnico',
      'Gestão de múltiplos usuários',
      'Backup automático',
      'Logs de auditoria',
      'Backup semanal'
    ],
    description: '⭐ Ideal para empresas que precisam de recursos avançados e backup semanal'
  },
  business: {
    name: 'Business',
    price: 79.90,
    storage: 500,
    users: 12,
    download: 150,
    badge: null,
    color: 'purple',
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
    ],
    description: '🏢 Solução completa para empresas que precisam de máxima capacidade e recursos'
  }
}

export default function SignupPlan() {
  const navigate = useNavigate()
  const { planName } = useParams<{ planName: string }>()
  const [formData, setFormData] = useState({
    companyName: '',
    adminName: '',
    adminEmail: '',
    phone: '',
    acceptTerms: false
  })

  const planConfig = planName ? PLAN_CONFIGS[planName as keyof typeof PLAN_CONFIGS] : null

  useEffect(() => {
    if (!planConfig) {
      navigate('/')
    }
  }, [planConfig, navigate])

  if (!planConfig) {
    return null
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    // TODO: Implementar lógica de criação da empresa com o plano específico
    // e redirecionamento para página de pagamento (Stripe/PIX)
    console.log(`Criando empresa com plano ${planConfig.name}:`, formData)
    
    // Por enquanto, navegue para uma página de pagamento placeholder
    navigate(`/payment/${planName}`, { 
      state: { 
        plan: planConfig.name,
        price: planConfig.price,
        companyData: formData 
      }
    })
  }

  const colorClasses = {
    blue: {
      bg: 'from-blue-50 to-indigo-50',
      icon: 'bg-blue-100 text-blue-600',
      highlight: 'bg-blue-100 text-blue-800'
    },
    green: {
      bg: 'from-green-50 to-emerald-50', 
      icon: 'bg-green-100 text-green-600',
      highlight: 'bg-green-100 text-green-800'
    },
    purple: {
      bg: 'from-purple-50 to-violet-50',
      icon: 'bg-purple-100 text-purple-600', 
      highlight: 'bg-purple-100 text-purple-800'
    }
  }

  const colors = colorClasses[planConfig.color as keyof typeof colorClasses]

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
            Contratar Plano {planConfig.name}
          </h1>
          <p className="text-muted-foreground">
            Complete seus dados para contratar este plano
          </p>
        </div>

        <div className="max-w-4xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Resumo do Plano */}
          <Card className={`border-primary/20 bg-gradient-to-br ${colors.bg}`}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-2xl">Plano {planConfig.name}</CardTitle>
                {planConfig.badge && (
                  <Badge className="bg-primary text-white font-semibold">
                    <planConfig.badge.icon className="w-3 h-3 mr-1" />
                    {planConfig.badge.text}
                  </Badge>
                )}
              </div>
              <div className="text-4xl font-bold text-primary">
                R$ {planConfig.price.toFixed(2)}<span className="text-lg text-muted-foreground">/mês</span>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 ${colors.icon} rounded-lg flex items-center justify-center`}>
                    <HardDrive className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-semibold">{planConfig.storage} GB de Armazenamento</p>
                    <p className="text-sm text-muted-foreground">Espaço seguro na nuvem</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 ${colors.icon} rounded-lg flex items-center justify-center`}>
                    <Users className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-semibold">{planConfig.users} Usuários</p>
                    <p className="text-sm text-muted-foreground">Contas para sua equipe</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 ${colors.icon} rounded-lg flex items-center justify-center`}>
                    <Download className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-semibold">{planConfig.download} GB de Download/mês</p>
                    <p className="text-sm text-muted-foreground">Transferências mensais</p>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t space-y-2">
                {planConfig.features.map((feature, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                    <span className="text-sm">{feature}</span>
                  </div>
                ))}
              </div>

              <div className={`${colors.highlight} p-4 rounded-lg`}>
                <p className="text-sm font-medium">
                  {planConfig.description}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Formulário */}
          <Card>
            <CardHeader>
              <CardTitle>Dados da Empresa</CardTitle>
              <CardDescription>
                Preencha os dados para criar sua conta
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="companyName">Nome da Empresa *</Label>
                  <Input
                    id="companyName"
                    type="text"
                    value={formData.companyName}
                    onChange={(e) => setFormData({...formData, companyName: e.target.value})}
                    placeholder="Ex: Sua Empresa Ltda"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="adminName">Nome do Administrador *</Label>
                  <Input
                    id="adminName"
                    type="text"
                    value={formData.adminName}
                    onChange={(e) => setFormData({...formData, adminName: e.target.value})}
                    placeholder="Seu nome completo"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="adminEmail">Email do Administrador *</Label>
                  <Input
                    id="adminEmail"
                    type="email"
                    value={formData.adminEmail}
                    onChange={(e) => setFormData({...formData, adminEmail: e.target.value})}
                    placeholder="seu@email.com"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="phone">Telefone</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({...formData, phone: e.target.value})}
                    placeholder="(11) 99999-9999"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="terms"
                    checked={formData.acceptTerms}
                    onChange={(e) => setFormData({...formData, acceptTerms: e.target.checked})}
                    required
                  />
                  <Label htmlFor="terms" className="text-sm">
                    Aceito os termos de uso e política de privacidade *
                  </Label>
                </div>

                <div className="pt-4">
                  <Button type="submit" className="w-full" size="lg">
                    <CreditCard className="mr-2 h-5 w-5" />
                    Continuar para Pagamento - R$ {planConfig.price.toFixed(2)}/mês
                  </Button>
                </div>

                <div className="text-center">
                  <button
                    type="button"
                    onClick={() => navigate('/')}
                    className="text-sm text-muted-foreground hover:text-foreground"
                  >
                    ← Voltar para página inicial
                  </button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
