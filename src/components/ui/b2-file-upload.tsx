// src/components/ui/b2-file-upload.tsx
import React, { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/components/auth/AuthContext'
import { toast } from '@/hooks/use-toast'
import { X, File as FileIcon, CheckCircle, AlertCircle, Cloud } from 'lucide-react'
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
  filePath?: string
}

export function B2FileUpload({ currentFolder, onUploadComplete }: B2FileUploadProps) {
  const { user, session } = useAuth()
  const [isOpen] = useState(false)
  const [uploadFiles, setUploadFiles] = useState<UploadFile[]>([])
  const [isDragOver, setIsDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const generateId = () => Math.random().toString(36).substr(2, 9)

  const handleFiles = (files: FileList) => {
    const newFiles: UploadFile[] = Array.from(files).map((file) => ({
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

  // ... aqui ficam suas funções uploadFile, uploadAllFiles, removeFile, clearCompleted,
  // getStatusIcon, getStatusText, formatFileSize (sem alterações)

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Cloud className="h-5 w-5" />
            Upload para Backblaze B2
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Drop Zone */}
          <div
            className={cn(
              'border-2 border-dashed rounded-lg p-6 text-center transition-colors',
              isDragOver ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'
            )}
            onDrop={handleDrop}
            onDragOver={(e) => {
              e.preventDefault()
              setIsDragOver(true)
            }}
            onDragLeave={() => setIsDragOver(false)}
          >
            <Cloud className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm text-muted-foreground mb-2">
              Arraste arquivos aqui ou clique para selecionar
            </p>
            <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
              Selecionar Arquivos
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={handleFileSelect}
            />
          </div>

          {/* File List */}
          {uploadFiles.length > 0 && (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {uploadFiles.map((uploadFile) => (
                <Card key={uploadFile.id} className="p-3">
                  <div className="flex items-center gap-3">
                    {getStatusIcon(uploadFile.status)}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {uploadFile.file.name}
                      </p>
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-muted-foreground">
                          {formatFileSize(uploadFile.file.size)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {getStatusText(uploadFile.status)}
                        </p>
                      </div>
                      {uploadFile.status !== 'pending' &&
                        uploadFile.status !== 'completed' &&
                        uploadFile.status !== 'error' && (
                          <Progress value={uploadFile.progress} className="h-1 mt-1" />
                        )}
                      {uploadFile.error && (
                        <p className="text-xs text-red-500 mt-1">{uploadFile.error}</p>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => removeFile(uploadFile.id)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}

          {/* Actions */}
          {uploadFiles.length > 0 && (
            <div className="flex gap-2">
              <Button
                onClick={uploadAllFiles}
                disabled={uploadFiles.every((f) => f.status !== 'pending')}
                className="flex-1"
              >
                Upload para B2
              </Button>
              <Button
                variant="outline"
                onClick={clearCompleted}
                disabled={!uploadFiles.some((f) => f.status === 'completed')}
              >
                Limpar Concluídos
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
