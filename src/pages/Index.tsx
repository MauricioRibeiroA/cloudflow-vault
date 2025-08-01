// src/pages/Index.tsx
import React from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Shield, FileText, Users, Lock, Cloud, Zap } from 'lucide-react'

export default function Index() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-gradient-surface">
      {/* Hero Section */}
      <section className="relative py-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-3 text-4xl font-bold text-primary mb-6">
            <Shield className="h-12 w-12" />
            CloudFlow Vault
          </div>
          <h1 className="text-5xl font-bold text-foreground mb-6 leading-tight">
            Gestão Inteligente de
            <span className="bg-gradient-primary bg-clip-text text-transparent">
              {' '}
              Arquivos Corporativos
            </span>
          </h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Plataforma completa para organização, controle de acesso e auditoria de
            documentos empresariais com segurança de nível corporativo.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Button
              size="lg"
              variant="gradient"
              onClick={() => navigate('/auth')}
              className="text-lg px-8"
            >
              Começar Agora
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => navigate('/auth')}
              className="text-lg px-8"
            >
              Fazer Login
            </Button>
          </div>
        </div>
      </section>

      {/* Apenas um teste rápido */}
      <div className="text-center py-10">
        <p className="text-lg">Se você está vendo esta mensagem, o Index.tsx está rodando!</p>
      </div>
    </div>
  )
}
