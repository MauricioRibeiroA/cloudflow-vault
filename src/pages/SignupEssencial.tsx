import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Shield, HardDrive, Users, Download, CreditCard, CheckCircle2, Star } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

export default function SignupEssencial() {
  const navigate = useNavigate()
  const [formData, setFormData] = useState({
    companyName: '',
    adminName: '',
    adminEmail: '',
    phone: '',
    acceptTerms: false
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    // TODO: Implementar lógica de criação da empresa com plano Essencial
    // e redirecionamento para página de pagamento (Stripe/PIX)
    console.log('Criando empresa com plano Essencial:', formData)
    
    // Por enquanto, navegue para uma página de pagamento placeholder
    navigate('/payment/essencial', { 
      state: { 
        plan: 'Essencial',
        price: 19.90,
        companyData: formData 
      }
    })
  }

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
            Contratar Plano Essencial
          </h1>
          <p className="text-muted-foreground">
            Complete seus dados para contratar o melhor custo-benefício
          </p>
        </div>

        <div className="max-w-4xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Resumo do Plano */}
          <Card className="border-primary/20 bg-gradient-to-br from-blue-50 to-indigo-50">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-2xl">Plano Essencial</CardTitle>
                <Badge className="bg-yellow-500 text-black font-semibold">
                  <Star className="w-3 h-3 mr-1" />
                  Melhor Custo-Benefício
                </Badge>
              </div>
              <div className="text-4xl font-bold text-primary">
                R$ 19,90<span className="text-lg text-muted-foreground">/mês</span>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                    <HardDrive className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-semibold">30 GB de Armazenamento</p>
                    <p className="text-sm text-muted-foreground">Espaço seguro na nuvem</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                    <Users className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <p className="font-semibold">2 Usuários</p>
                    <p className="text-sm text-muted-foreground">Contas para sua equipe</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                    <Download className="h-5 w-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="font-semibold">10 GB de Download/mês</p>
                    <p className="text-sm text-muted-foreground">Transferências mensais</p>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t space-y-2">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  <span className="text-sm">Armazenamento seguro na nuvem</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  <span className="text-sm">Upload e download de arquivos</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  <span className="text-sm">Interface web intuitiva</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  <span className="text-sm">Suporte técnico</span>
                </div>
              </div>

              <div className="bg-blue-100 p-4 rounded-lg">
                <p className="text-sm text-blue-800 font-medium">
                  🎯 Ideal para pequenas empresas que precisam de armazenamento seguro 
                  com excelente custo-benefício
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
                    Continuar para Pagamento - R$ 19,90/mês
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
