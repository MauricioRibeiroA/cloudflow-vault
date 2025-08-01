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
import { FolderPlus, Cloud, BarChart3, HardDrive } from 'lucide-react'
import { B2FileUpload } from '@/components/ui/b2-file-upload'
import { useToast } from '@/hooks/use-toast'
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
  usedGB: number
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
    if (!error) setFolders(data || [])
  }

  const fetchFiles = async () => {
    let query = supabase.from('files').select('*').order('created_at', {
      ascending: false,
    })
    if (currentFolder) query = query.eq('folder_id', currentFolder)
    const { data, error } = await query
    if (!error) setFiles(data || [])
  }

  const fetchStorageUsage = async () => {
    const { data, error } = await supabase.functions.invoke('list_usage', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!error) setStorageUsage(data as StorageUsage)
  }

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return
    const { error } = await supabase
      .from('folders')
      .insert({ name: newFolderName.trim(), parent: currentFolder })
    if (!error) {
      setNewFolderName('')
      setShowFolderDialog(false)
      fetchFolders()
    }
  }

  useEffect(() => {
    if (!accessToken) return
    fetchFolders()
    fetchFiles()
    fetchStorageUsage()
  }, [currentFolder, accessToken])

  if (!accessToken) return null

  return (
    <div className="space-y-6">
      {/* Ações: Nova Pasta e Upload B2 */}
      <div className="flex gap-2 items-center mb-4">
        {/* Nova Pasta */}
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
              <DialogDescription>
                Escolha um nome para a nova pasta
              </DialogDescription>
            </DialogHeader>
            <div className="mt-4 space-y-4">
              <Label htmlFor="folder-name">Nome da Pasta</Label>
              <Input
                id="folder-name"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="Ex: Projetos"
              />
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setShowFolderDialog(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleCreateFolder}>Criar</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Upload B2 */}
        <B2FileUpload
          currentFolder={currentFolder}
          onUploadComplete={() => {
            fetchFiles()
            fetchStorageUsage()
          }}
        />
      </div>

      {/* Uso de storage */}
      {storageUsage && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Uso de Armazenamento
            </CardTitle>
            <CardDescription>
              {storageUsage.usedGB.toFixed(2)} / {storageUsage.storageLimitGB.toFixed(2)} GB
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
            {storageUsage.usagePercentage > 90 && (
              <Alert>
                <AlertTitle>Atenção</AlertTitle>
                <AlertDescription>
                  Você está próximo do limite de armazenamento.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {/* Tabela de pastas e arquivos */}
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
                <TableHead>Tamanho</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Data</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {/* renderização de pastas e arquivos aqui */}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
