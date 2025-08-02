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
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { B2FileUpload } from '@/components/ui/b2-file-upload'

interface B2Folder { id: string; name: string; parent: string | null }
interface B2File { id: string; name: string; filePath: string; size: number; type: string; createdAt: string }

export default function Upload() {
  const { session } = useAuth()
  const token = session?.access_token!
  const toast = useToast().toast

  // company_id: null for super_admin
  const [companyId] = useState<string | null>(null)
  const [groupName] = useState<string>('super_admin')

  const [folders, setFolders] = useState<B2Folder[]>([])
  const [files, setFiles] = useState<B2File[]>([])
  const [currentFolder, setCurrentFolder] = useState<string | null>(null)
  const [showFolderDialog, setShowFolderDialog] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [usage, setUsage] = useState<{ usedGB: number; limitGB: number; pct: number } | null>(null)

  const invokeB2 = async (body: Record<string, any>) => {
    const payload = { ...body, company_id: companyId, group_name: groupName }
    const res = await supabase.functions.invoke('b2-file-manager', {
      headers: { Authorization: `Bearer ${token}` },
      body: payload,
    })
    if (res.error) throw res.error
    return res.data
  }

  const fetchFolders = async () => {
    try {
      const data = await invokeB2({ action: 'list_folders', parentId: currentFolder })
      setFolders(data.map((f: any) => ({ id: f.id, name: f.name, parent: f.parent_id })))
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erro ao listar pastas', description: e.message })
    }
  }

  const fetchFiles = async () => {
    try {
      const data = await invokeB2({ action: 'list_files', folderId: currentFolder })
      setFiles(data.map((f: any) => ({
        name: f.name,
        filePath: f.file_path,
        size: f.file_size,
        type: f.file_type,
        createdAt: f.created_at,
        id: f.id
      })))
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erro ao listar arquivos', description: e.message })
    }
  }

  const fetchUsage = async () => {
    try {
      const data = await invokeB2({ action: 'get_usage' })
      setUsage({ 
        usedGB: data.totalUsageGB, 
        limitGB: data.storageLimitGB, 
        pct: data.usagePercentage 
      })
    } catch { /* silent */ }
  }

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return
    try {
      await invokeB2({
        action: 'create_folder',
        parentId: currentFolder,
        folderName: newFolderName.trim(),
      })
      setNewFolderName('')
      setShowFolderDialog(false)
      fetchFolders()
      toast({ title: 'Pasta criada' })
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erro ao criar pasta', description: e.message })
    }
  }

  const handleDownload = async (file: B2File) => {
    try {
      const { url } = await invokeB2({
        action: 'get_download_url',
        fileId: file.id,
      })
      window.open(url, '_blank')
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erro ao baixar', description: e.message })
    }
  }

  const handleDelete = async (file: B2File) => {
    if (!confirm(`Excluir ${file.name}?`)) return
    try {
      await invokeB2({ action: 'delete', fileId: file.id })
      fetchFiles()
      fetchUsage()
      toast({ title: 'Arquivo excluído' })
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erro ao excluir', description: e.message })
    }
  }

  useEffect(() => {
    if (!token) return
    fetchFolders()
    fetchFiles()
    fetchUsage()
  }, [token, currentFolder])

  if (!token) return null

  return (
    <div className="space-y-6">
      {/* Navegação */}
      {currentFolder && (
        <div className="flex items-center gap-2 mb-4">
          <Button variant="outline" onClick={() => setCurrentFolder(null)}>
            ← Voltar à Raiz
          </Button>
        </div>
      )}

      {/* Ações */}
      <div className="flex items-center gap-2 mb-4">
        <Dialog open={showFolderDialog} onOpenChange={setShowFolderDialog}>
          <DialogTrigger asChild>
            <Button variant="outline">
              <FolderPlus className="mr-2 h-4 w-4" /> Nova Pasta
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Criar Pasta no B2</DialogTitle>
              <DialogDescription>Informe o nome</DialogDescription>
            </DialogHeader>
            <div className="mt-4 space-y-4">
              <Label htmlFor="folder-name">Nome</Label>
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

        <B2FileUpload
          currentFolder={currentFolder}
          onUploadComplete={() => { fetchFiles(); fetchUsage() }}
        />
      </div>

      {/* Uso de Storage */}
      {usage && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" /> Uso de Storage
            </CardTitle>
            <CardDescription>
              {usage.usedGB.toFixed(2)} / {usage.limitGB.toFixed(2)} GB
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <HardDrive className="h-5 w-5 text-green-500" />
              <span className="font-medium">{usage.pct.toFixed(1)}%</span>
            </div>
            <Progress value={usage.pct} className="h-2" />
          </CardContent>
        </Card>
      )}

      {/* Conteúdo B2 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {currentFolder || 'Raiz'}
          </CardTitle>
          <CardDescription>Pastas e arquivos no B2</CardDescription>
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
                  <TableCell className="flex items-center gap-2">
                    <Folder className="h-4 w-4" />
                    {f.name}
                  </TableCell>
                  <TableCell>Pasta</TableCell>
                  <TableCell>—</TableCell>
                  <TableCell>—</TableCell>
                  <TableCell className="text-right">—</TableCell>
                </TableRow>
              ))}
              {files.map((file) => (
                <TableRow key={file.id} className="hover:bg-muted-foreground/5">
                  <TableCell className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    <span
                      className="cursor-pointer text-primary hover:underline"
                      onClick={() => handleDownload(file)}
                    >
                      {file.name}
                    </span>
                  </TableCell>
                  <TableCell>{(file.size / 1024).toFixed(2)} KB</TableCell>
                  <TableCell>{file.type}</TableCell>
                  <TableCell>{new Date(file.createdAt).toLocaleString()}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" onClick={() => handleDelete(file)}>🗑️</Button>
                  </TableCell>
                </TableRow>
              ))}
              {folders.length === 0 && files.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    Não há itens nesta pasta
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
