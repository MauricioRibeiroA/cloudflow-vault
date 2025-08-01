// src/components/ui/b2-file-upload.tsx
import React, { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { supabase } from '@/integrations/supabase/client'
import { toast } from '@/hooks/use-toast'
import {
  Upload,
  X,
  File as FileIcon,
  CheckCircle,
  AlertCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface B2FileUploadProps {
  currentFolder: string | null
  onUploadComplete: () => void
}

interface UploadFile {
  file: File
  id: string
  progress: number
  status:
    | 'pending'
    | 'getting_url'
    | 'uploading'
    | 'saving_metadata'
    | 'completed'
    | 'error'
  error?: string
  signedUrl?: string
}

export function B2FileUpload({
  currentFolder,
  onUploadComplete,
}: B2FileUploadProps) {
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [uploadFiles, setUploadFiles] = useState<UploadFile[]>([])
  const [isDragOver, setIsDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // load session once
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setAccessToken(session?.access_token ?? null)
    })
    // also listen for future changes
    const { data } = supabase.auth.onAuthStateChange((_e, session) => {
      setAccessToken(session?.access_token ?? null)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  const generateId = () => Math.random().toString(36).substr(2, 9)

  const fetchFiles = async () => {
    if (!accessToken) return
    try {
      const { data, error } = await supabase.functions.invoke(
        'b2-file-manager',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action: 'list_files',
            folder: currentFolder,
          }),
        }
      )
      if (error) throw error
      // TODO: setFiles(data)
    } catch (err: any) {
      console.error('Erro ao buscar arquivos:', err)
      toast({ variant: 'destructive', title: err.message })
    }
  }

  const fetchStorageUsage = async () => {
    if (!accessToken) return
    try {
      const { data, error } = await supabase.functions.invoke(
        'b2-file-manager',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ action: 'list_usage' }),
        }
      )
      if (error) throw error
      // TODO: setStorageUsage(data)
    } catch (err: any) {
      console.error('Erro ao carregar uso de storage:', err)
      toast({ variant: 'destructive', title: err.message })
    }
  }

  const handleFileUpload = async (uploadFile: UploadFile) => {
    if (!accessToken) return

    setUploadFiles((prev) =>
      prev.map((u) =>
        u.id === uploadFile.id ? { ...u, status: 'getting_url' } : u
      )
    )

    try {
      const { data: urlData, error: urlError } =
        await supabase.functions.invoke('b2-upload-url', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            bucket: '<SEU_BUCKET>',
            filename: uploadFile.file.name,
            contentType: uploadFile.file.type,
          }),
        })
      if (urlError) throw urlError

      setUploadFiles((prev) =>
        prev.map((u) =>
          u.id === uploadFile.id
            ? { ...u, status: 'uploading', signedUrl: urlData.uploadUrl }
            : u
        )
      )

      const res = await fetch(urlData.uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': uploadFile.file.type,
          Authorization: urlData.authorizationToken,
        },
        body: uploadFile.file,
      })
      if (!res.ok) throw new Error('Upload B2 falhou')

      setUploadFiles((prev) =>
        prev.map((u) =>
          u.id === uploadFile.id ? { ...u, status: 'saving_metadata' } : u
        )
      )

      const { error: metadataError } =
        await supabase.functions.invoke('b2-file-manager', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action: 'confirm_upload',
            fileId: urlData.fileId,
          }),
        })
      if (metadataError) throw metadataError

      setUploadFiles((prev) =>
        prev.map((u) =>
          u.id === uploadFile.id
            ? { ...u, status: 'completed', progress: 100 }
            : u
        )
      )

      onUploadComplete()
      toast({ variant: 'default', title: 'Upload concluído!' })
    } catch (err: any) {
      setUploadFiles((prev) =>
        prev.map((u) =>
          u.id === uploadFile.id
            ? { ...u, status: 'error', error: err.message }
            : u
        )
      )
      console.error('Upload error:', err)
      toast({ variant: 'destructive', title: err.message })
    }
  }

  const handleFiles = (files: FileList) => {
    const newFiles = Array.from(files).map((file) => ({
      file,
      id: generateId(),
      progress: 0,
      status: 'pending',
    }))
    setUploadFiles((prev) => [...prev, ...newFiles])
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files)
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length) handleFiles(e.target.files)
  }

  useEffect(() => {
    fetchFiles()
    fetchStorageUsage()
  }, [currentFolder, accessToken])

  return (
    <Dialog open={isDragOver} onOpenChange={setIsDragOver}>
      <DialogTrigger asChild>
        <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
          <Upload className="mr-2 h-4 w-4" />
          Selecionar arquivos
        </Button>
      </DialogTrigger>
      <DialogContent aria-describedby="upload-dialog">
        <DialogHeader>
          <DialogTitle id="upload-dialog">Enviar Arquivos</DialogTitle>
        </DialogHeader>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleFileSelect}
        />

        {uploadFiles.map((u) => (
          <Card key={u.id} className="mb-2">
            <CardContent className="flex items-center space-x-4">
              <FileIcon />
              <div className="flex-1">
                <p>{u.file.name}</p>
                <Progress value={u.progress} className="mt-1" />
              </div>
              {u.status === 'completed' && <CheckCircle />}
              {u.status === 'error' && <AlertCircle className="text-red-500" />}
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  setUploadFiles((prev) => prev.filter((x) => x.id !== u.id))
                }
              >
                <X />
              </Button>
            </CardContent>
          </Card>
        ))}
      </DialogContent>
    </Dialog>
  )
}
