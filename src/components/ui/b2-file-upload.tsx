// src/components/ui/b2-file-upload.tsx
import React, { useState, useRef } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/components/auth/AuthContext'
import { Button } from './button'
import { Progress } from './progress'
import { Card, CardContent } from './card'
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle } from './dialog'
import { Cloud, CheckCircle, AlertCircle, X, File as FileIcon } from 'lucide-react'
import { toast } from '@/hooks/use-toast'

type UploadStatus = 'pending' | 'getting_url' | 'uploading' | 'saving_metadata' | 'completed' | 'error'

interface UploadFile {
  file: File
  id: string
  progress: number
  status: UploadStatus
  filePath?: string
  error?: string
}

export function B2FileUpload({
  currentFolder,
  onUploadComplete,
}: {
  currentFolder: string | null
  onUploadComplete: () => void
}) {
  const { session } = useAuth()
  const accessToken = session?.access_token!
  const toastApi = toast

  const [files, setFiles] = useState<UploadFile[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Dados de super_admin
  const companyId: string | null = null
  const groupName = 'super_admin'

  const generateId = () => Math.random().toString(36).substr(2, 9)

  const handleFiles = (fileList: FileList) => {
    const newFiles = Array.from(fileList).map((f) => ({
      file: f,
      id: generateId(),
      progress: 0,
      status: 'pending' as UploadStatus,
    }))
    setFiles((prev) => [...prev, ...newFiles])
  }

  const uploadOne = async (uf: UploadFile) => {
    try {
      // 1) signed URL
      setFiles((prev) =>
        prev.map((x) =>
          x.id === uf.id ? { ...x, status: 'getting_url', progress: 10 } : x
        )
      )
      const { data: initData, error: initErr } = await supabase.functions.invoke(
        'b2-upload-url',
        {
          headers: { Authorization: `Bearer ${accessToken}` },
          body: {
            fileName: uf.file.name,
            fileSize: uf.file.size,
            fileType: uf.file.type || 'application/octet-stream',
            folderId: currentFolder,
            company_id: companyId,
            group_name: groupName,
          },
        }
      )
      if (initErr) throw initErr

      // 2) upload PUT
      setFiles((prev) =>
        prev.map((x) =>
          x.id === uf.id ? { ...x, status: 'uploading', progress: 30 } : x
        )
      )
      const putRes = await fetch(initData.signedUrl, {
        method: 'PUT',
        headers: { 'Content-Type': uf.file.type || 'application/octet-stream' },
        body: uf.file,
      })
      if (!putRes.ok) throw new Error(`Upload falhou: ${putRes.statusText}`)

      // 3) save metadata
      setFiles((prev) =>
        prev.map((x) =>
          x.id === uf.id
            ? { ...x, status: 'saving_metadata', progress: 70, filePath: initData.filePath }
            : x
        )
      )
      const { error: mdErr } = await supabase.functions.invoke(
        'b2-file-manager',
        {
          headers: { Authorization: `Bearer ${accessToken}` },
          body: {
            action: 'save_metadata',
            fileName: uf.file.name,
            filePath: initData.filePath,
            fileSize: uf.file.size,
            fileType: uf.file.type || 'application/octet-stream',
            folderId: currentFolder,
            company_id: companyId,
            group_name: groupName,
          },
        }
      )
      if (mdErr) throw mdErr

      // 4) done
      setFiles((prev) =>
        prev.map((x) =>
          x.id === uf.id ? { ...x, status: 'completed', progress: 100 } : x
        )
      )
      toastApi({ title: 'Upload concluído', description: uf.file.name })
    } catch (err: any) {
      setFiles((prev) =>
        prev.map((x) =>
          x.id === uf.id
            ? { ...x, status: 'error', error: err.message, progress: 0 }
            : x
        )
      )
      toastApi({ variant: 'destructive', title: 'Erro no upload', description: err.message })
    }
  }

  const handleUploadAll = async () => {
    for (const uf of files.filter((f) => f.status === 'pending')) {
      // eslint-disable-next-line no-await-in-loop
      await uploadOne(uf)
    }
    onUploadComplete()
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="default">
          <Cloud className="h-4 w-4" /> Upload B2
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Upload para Backblaze B2</DialogTitle>
        </DialogHeader>

        {/* botão visível para selecionar arquivos */}
        <div className="text-center mb-4">
          <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
            <FileIcon className="mr-2 h-4 w-4" /> Selecionar Arquivos
          </Button>
          <input
            type="file"
            multiple
            className="hidden"
            ref={fileInputRef}
            onChange={(e) => e.target.files && handleFiles(e.target.files)}
          />
        </div>

        {/* lista de arquivos com progresso */}
        {files.map((uf) => (
          <Card key={uf.id} className="p-3 mb-2">
            <div className="flex items-center gap-3">
              {uf.status === 'completed' ? (
                <CheckCircle className="text-green-500 h-4 w-4" />
              ) : uf.status === 'error' ? (
                <AlertCircle className="text-red-500 h-4 w-4" />
              ) : (
                <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
              )}
              <div className="flex-1">
                <div className="flex justify-between">
                  <span>{uf.file.name}</span>
                  <span>{uf.progress}%</span>
                </div>
                <Progress value={uf.progress} className="h-1 mt-1" />
                {uf.error && <p className="text-sm text-red-600 mt-1">{uf.error}</p>}
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setFiles((prev) => prev.filter((x) => x.id !== uf.id))}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </Card>
        ))}

        {/* botão para iniciar upload */}
        {files.length > 0 && (
          <Button className="w-full mt-4" onClick={handleUploadAll}>
            Iniciar Upload
          </Button>
        )}
      </DialogContent>
    </Dialog>
  )
}
