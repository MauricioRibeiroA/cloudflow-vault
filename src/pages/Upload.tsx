// src/pages/Upload.tsx
import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/components/auth/AuthContext'
import { AppLayout } from '@/components/layout/AppLayout'
import { B2FileUpload } from '@/components/ui/B2FileUpload'
import { toast } from '@/hooks/use-toast'

export default function Upload() {
  const navigate = useNavigate()
  const { session } = useAuth()
  const accessToken = session?.access_token ?? null
  const [currentFolder, setCurrentFolder] = useState<string | null>(null)

  useEffect(() => {
    if (!session) {
      // não autenticado, manda pra login
      navigate('/auth')
    }
  }, [session, navigate])

  const handleUploadComplete = () => {
    toast({ title: 'Upload finalizado com sucesso!' })
    // por exemplo, re-carregar a lista de arquivos:
    // setCurrentFolder(currentFolder)
  }

  if (!accessToken) {
    return (
      <AppLayout>
        <div className="p-10 text-center">
          <p>Carregando sessão...</p>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div className="p-6">
        <h2 className="text-2xl font-semibold mb-4">Upload de Arquivos</h2>
        <B2FileUpload
          currentFolder={currentFolder}
          onUploadComplete={handleUploadComplete}
        />
      </div>
    </AppLayout>
  )
}
