// src/pages/Upload.tsx
import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/integrations/supabase/client'
import { Button } from '@/components/ui/button'
import { AppLayout } from '@/components/layout/AppLayout'
import { B2FileUpload } from '@/components/ui/b2-file-upload'
import { toast } from '@/hooks/use-toast'

export default function Upload() {
  const navigate = useNavigate()
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [currentFolder, setCurrentFolder] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        navigate('/auth')
      } else {
        setAccessToken(session.access_token)
      }
    })
    const { data } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!session) {
        navigate('/auth')
      } else {
        setAccessToken(session.access_token)
      }
    })
    return () => data.subscription.unsubscribe()
  }, [navigate])

  const handleUploadComplete = () => {
    toast({ title: 'Upload finalizado com sucesso!' })
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
