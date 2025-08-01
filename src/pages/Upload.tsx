// src/pages/Upload.tsx
import React, { useState, useEffect } from 'react'
import { useAuth } from '@/components/auth/AuthContext'
import { supabase } from '@/integrations/supabase/client'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card'
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from '@/components/ui/table'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'
import {
  FolderPlus,
  Folder,
  FileText,
  BarChart3,
  HardDrive,
  Cloud,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { B2FileUpload } from '@/components/ui/b2-file-upload'

interface Folder {
  id: string
  name: string
}

interface FileRecord {
  id: string
  name: string
  file_path: string
  file_size: number
  file_type: string
  folder_id: string | null
  created_at: string
}

interface StorageUsage {
  totalUsageGB: number
  storageLimitGB: number
  usagePercentage: number
}

export default function Upload() {
  const { session } = useAuth()
  const accessToken = session?.access_token
  const { toast } = useToast()

  const [folders, setFolders] = useState<Folder[]>([])
  const [files, setFiles] = useState<FileRecord[]>([])
  const [currentFolder, setCurrentFolder] = useState<string | null>(null)
  const [showFolderDialog, setShowFolderDialog] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [storageUsage, setStorageUsage] = useState<StorageUsage | null>(null)

  const fetchFolders = async () => {
    const { data, error } = await supabase
      .from('folders')
      .select('*')
      .order('name')
    if (error) {
      console.error('Erro ao carregar pastas:', error)
      toast({ variant: 'destructive', title: 'Erro ao carregar pastas' })
    } else {
      setFolders(data || [])
    }
  }

  const fetchFiles = async () => {
    let query = supabase.from('files').select('*').order('created_at', { ascending: false })
    if (currentFolder) {
      query = query.eq('folder_id', currentFolder)
    }
    const { data, error } = await query
    if (error) {
      console.error('Erro ao carregar arquivos:', error)
      toast({ variant: 'destructive', title: 'Erro ao carregar arquivos' })
    } else {
      setFiles(data || [])
    }
  }

  const fetchStorageUsage = async () => {
    const { data, error } = await supabase.functions.invoke('list_usage', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (error) {
      console.error('Erro ao carregar uso de storage:', error)
      toast({ variant: 'destructive', title: 'Erro ao carregar uso de storage' })
    } else {
      setStorageUsage(data as StorageUsage)
    }
  }

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return
    const { error } = await supabase
      .from('folders')
      .insert({ name: newFolderName.trim(), parent: currentFolder })
    if (error) {
      console.error('Erro ao criar pasta:', error)
      toast({ variant: 'destructive', title: 'Erro ao criar pasta' })
    } else {
      setNewFolderName('')
      setShowFolderDialog(false)
      fetchFolders()
      toast({ title: 'Pasta criada com sucesso' })
    }
  }

  const handleDownload = (file: FileRecord) => {
    // implementar download do arquivo do Supabase ou B2
    console.log('Download file:', file)
  }

  useEffect(() => {
    if (!accessToken) return
    fetchFolders()
    fetchFiles()
    fetchStorageUsage()
  }, [accessToken, currentFolder])

  if (!accessToken) return null

  return (
    <div className="space-y-6">
      {/* Header & Actions */}
      <div className="flex items-center gap-2 mb-4">
        <Dialog open={showFolderDialog} onOpenChange={setShowFolderDialog}>
          <DialogTrigger asChild>
            <Button variant="outline">
              <FolderPlus className="mr-2 h-4 w-4" />
              Nova Pasta
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Criar Nova Pasta</DialogTitle>
              <DialogDescription>Digite o nome da nova pasta</DialogDescription>
            </DialogHeader>
            <div className="mt-4 space-y-4">
              <Label htmlFor="folder-name">Nome da Pasta</Label>
              <Input
                id="folder-name"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="Ex: Projetos"
              />
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowFolderDialog(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleCreateFolder}>Criar</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Botão “Upload” do Supabase removido */}

        <B2FileUpload
          currentFolder={currentFolder}
          onUploadComplete={() => {
            fetchFiles()
            fetchStorageUsage()
          }}
        />
      </div>

      {/* Storage Usage */}
      {storageUsage && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Uso de Armazenamento
            </CardTitle>
            <CardDescription>
              {storageUsage.totalUsageGB.toFixed(2)} GB de{' '}
              {storageUsage.storageLimitGB.toFixed(2)} GB utilizados
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <HardDrive className="h-5 w-5 text-green-500" />
              <span className="font-medium">
                {storageUsage.usagePercentage.toFixed(1)}%
              </span>
            </div>
            <Progress value={storageUsage.usagePercentage} className="h-2" />
          </CardContent>
        </Card>
      )}

      {/* Tabela de Pastas e Arquivos */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {currentFolder
              ? folders.find((f) => f.id === currentFolder)?.name
              : 'Raiz'}
          </CardTitle>
          <CardDescription>Pastas e arquivos nesta localização</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Tamanho</TableHead>
                <TableHead>Data</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {folders.map((f) => (
                <TableRow
                  key={f.id}
                  className="cursor-pointer hover:bg-muted-foreground/5"
                  onClick={() => setCurrentFolder(f.id)}
                >
                  <TableCell><Folder className="h-4 w-4" /></TableCell>
                  <TableCell>{f.name}</TableCell>
                  <TableCell>—</TableCell>
                  <TableCell>—</TableCell>
                  <TableCell className="text-right">{/* ações pasta */}</TableCell>
                </TableRow>
              ))}
              {files.map((file) => (
                <TableRow key={file.id} className="hover:bg-muted-foreground/5">
                  <TableCell><FileText className="h-4 w-4" /></TableCell>
                  <TableCell
                    className="cursor-pointer text-primary hover:underline"
                    onClick={() => handleDownload(file)}
                  >
                    {file.name}
                  </TableCell>
                  <TableCell>{(file.file_size / 1024).toFixed(2)} KB</TableCell>
                  <TableCell>{file.file_type}</TableCell>
                  <TableCell>{new Date(file.created_at).toLocaleString()}</TableCell>
                  <TableCell className="text-right">{/* ações arquivo */}</TableCell>
                </TableRow>
              ))}
              {folders.length === 0 && files.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    Nesta pasta não há arquivos nem pastas
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
