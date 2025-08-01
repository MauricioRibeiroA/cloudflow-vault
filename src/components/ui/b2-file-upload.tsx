// src/components/ui/b2-file-upload.tsx
import React, { useState, useRef } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/components/auth/AuthContext'
import { Button } from './button'
import { Progress } from './progress'
import { Card, CardContent } from './card'
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle } from './dialog'
import { Cloud, File as FileIcon, CheckCircle, AlertCircle, X } from 'lucide-react'
import { toast } from '@/hooks/use-toast'

type UploadStatus = 'pending' | 'getting_url' | 'uploading' | 'saving_metadata' | 'completed' | 'error'

interface UploadFile {
  file: File
  id: string
  progress: number
  status: UploadStatus
  signedUrl?: string
  filePath?: string
  error?: string
}

export function B2FileUpload({ currentFolder, onUploadComplete }: { currentFolder: string | null, onUploadComplete: () => void }) {
  const { session } = useAuth()
  const accessToken = session?.access_token!
  const [files, setFiles] = useState<UploadFile[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  // para super_admin
  const companyId: string | null = null
  const groupName = 'super_admin'

  const generateId = () => Math.random().toString(36).substring(2, 9)

  const handleFiles = (fileList: FileList) => {
    const newFiles: UploadFile[] = Array.from(fileList).map(f => ({
      file: f,
      id: generateId(),
      progress: 0,
      status: 'pending'
    }))
    setFiles(prev => [...prev, ...newFiles])
  }

  const uploadOne = async (uf: UploadFile) => {
    try {
      // 1) obter signedUrl
      setFiles(prev => prev.map(x => x.id === uf.id ? { ...x, status: 'getting_url', progress: 10 } : x))
      const { data: initData, error: initErr } = await supabase.functions.invoke('b2-upload-url', {
        headers: { Authorization: `Bearer ${accessToken}` },
        body: {
          fileName: uf.file.name,
          fileSize: uf.file.size,
          fileType: uf.file.type || 'application/octet-stream',
          folderId: currentFolder,
          company_id: companyId,
          group_name: groupName
        }
      })
      if (initErr) throw initErr

      // 2) upload PUT
      setFiles(prev => prev.map(x => x.id === uf.id ? { ...x, status: 'uploading', progress: 30 } : x))
      const putRes = await fetch(initData.signedUrl, {
        method: 'PUT',
        headers: { 'Content-Type': uf.file.type || 'application/octet-stream' },
        body: uf.file
      })
      if (!putRes.ok) throw new Error(`PUT failed: ${putRes.statusText}`)

      // 3) salvar metadata
      setFiles(prev => prev.map(x => x.id === uf.id ? { ...x, status: 'saving_metadata', progress: 70, filePath: initData.filePath } : x))
      const { error: mdErr } = await supabase.functions.invoke('b2-file-manager', {
        headers: { Authorization: `Bearer ${accessToken}` },
        body: {
          action: 'save_metadata',
          fileName: uf.file.name,
          filePath: initData.filePath,
          fileSize: uf.file.size,
          fileType: uf.file.type || 'application/octet-stream',
          folderId: currentFolder,
          company_id: companyId,
          group_name: groupName
        }
      })
      if (mdErr) throw mdErr

      // 4) finalizado
      setFiles(prev => prev.map(x => x.id === uf.id ? { ...x, status: 'completed', progress: 100 } : x))
      toast({ title: 'Upload concluído', description: uf.file.name })
    } catch (err: any) {
      setFiles(prev => prev.map(x => x.id === uf.id ? { ...x, status: 'error', error: err.message } : x))
      toast({ variant: 'destructive', title: 'Erro no upload', description: err.message })
    }
  }

  const handleUploadAll = async () => {
    for (const uf of files.filter(f => f.status === 'pending')) {
      // eslint-disable-next-line no-await-in-loop
      await uploadOne(uf)
    }
    onUploadComplete()
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="default" onClick={() => fileInputRef.current?.click()}>
          <Cloud className="h-4 w-4" /> Upload B2
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Upload para Backblaze B2</DialogTitle>
        </DialogHeader>
        <input type="file" multiple className="hidden" ref={fileInputRef}
          onChange={e => e.target.files && handleFiles(e.target.files)} />
        {files.map(uf => (
          <Card key={uf.id} className="p-3 mb-2">
            <div className="flex items-center gap-3">
              {uf.status === 'completed' ? <CheckCircle className="text-green-500"/> :
               uf.status === 'error' ? <AlertCircle className="text-red-500"/> :
               <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full"/>}
              <div className="flex-1">
                <div className="flex justify-between">
                  <span>{uf.file.name}</span>
                  <span>{uf.progress}%</span>
                </div>
                <Progress value={uf.progress} className="h-1 mt-1"/>
                {uf.error && <p className="text-sm text-red-600 mt-1">{uf.error}</p>}
              </div>
              <Button variant="ghost" size="icon" onClick={() => setFiles(prev => prev.filter(x => x.id !== uf.id))}>
                <X className="h-4 w-4"/>
              </Button>
            </div>
          </Card>
        ))}
        {files.length > 0 && (
          <Button onClick={handleUploadAll} className="w-full mt-4">
            Iniciar Upload
          </Button>
        )}
      </DialogContent>
    </Dialog>
  )
}
