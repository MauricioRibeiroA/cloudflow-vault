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
  DialogTrigger
} from '@/components/ui/dialog'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/components/auth/AuthContext'
import { toast } from '@/hooks/use-toast'
import {
  Upload,
  X,
  File as FileIcon,
  CheckCircle,
  AlertCircle,
  Cloud
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
  filePath?: string
}

export function B2FileUpload({
  currentFolder,
  onUploadComplete
}: B2FileUploadProps) {
  const { user, session } = useAuth()
  const accessToken = session?.access_token
  const [uploadFiles, setUploadFiles] = useState<UploadFile[]>([])
  const [isDragOver, setIsDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

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
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            action: 'list_files',
            folder: currentFolder
          })
        }
      )
      if (error) throw error
      // processe os
