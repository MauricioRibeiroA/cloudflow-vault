import React from 'react'
import { SecureFileManager } from '@/components/SecureFileManager'

export default function SecureFiles() {
  return (
    <div className="container mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Sistema Seguro de Arquivos</h1>
        <p className="text-muted-foreground mt-2">
          Gerenciador de arquivos com controle de acesso baseado em empresa e função do usuário.
        </p>
      </div>
      
      <SecureFileManager />
    </div>
  )
}
