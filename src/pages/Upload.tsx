import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
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
import {
  FolderPlus,
  Folder,
  FileText,
  BarChart3,
  HardDrive,
  ArrowLeft,
  Home,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { B2FileUpload } from '@/components/ui/b2-file-upload'
import { TestB2Connection } from '@/components/TestB2Connection'

interface B2Folder { id: string; name: string; parent: string | null }
interface B2File { id: string; name: string; filePath: string; size: number; type: string; createdAt: string }

export default function Upload() {
  const navigate = useNavigate()
  const { session } = useAuth()
  const token = session?.access_token
  const toast = useToast().toast

  const [folders, setFolders] = useState<B2Folder[]>([])
  const [files, setFiles] = useState<B2File[]>([])
  const [currentFolder, setCurrentFolder] = useState<string | null>(null)
  const [showFolderDialog, setShowFolderDialog] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [usage, setUsage] = useState<{ usedGB: number; limitGB: number; pct: number } | null>(null)
  const [loading, setLoading] = useState(false)

  const invokeB2 = async (body: Record<string, any>) => {
    try {
      console.log('🚀 Invoking B2 function with:', body);
      
      // Check if user is authenticated and token is valid
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session) {
        console.error('❌ Session error:', sessionError);
        throw new Error('Sessão expirada. Faça login novamente.');
      }

      const { data, error } = await supabase.functions.invoke('b2-file-manager', {
        body
      });
      
      if (error) {
        console.error('❌ Edge function error:', error);
        // Try to refresh session if token is invalid
        if (error.message?.includes('Invalid') || error.message?.includes('expired')) {
          const { error: refreshError } = await supabase.auth.refreshSession();
          if (refreshError) {
            console.error('❌ Token refresh failed:', refreshError);
            throw new Error('Sessão expirada. Faça login novamente.');
          }
          // Retry the request with refreshed token
          const { data: retryData, error: retryError } = await supabase.functions.invoke('b2-file-manager', {
            body
          });
          if (retryError) throw retryError;
          return retryData;
        }
        throw error;
      }
      
      console.log('✅ B2 function response:', data);
      return data;
    } catch (error) {
      console.error('❌ invokeB2 error:', error);
      throw error;
    }
  };

  const fetchFolders = async () => {
    try {
      setLoading(true);
      console.log('📁 Fetching folders...');
      const data = await invokeB2({ action: 'list_folders', parentId: currentFolder });
      console.log('✅ Folders loaded:', data);
      setFolders(data.map((f: any) => ({ id: f.id, name: f.name, parent: f.parent_id })));
    } catch (error) {
      console.error('❌ Error fetching folders:', error);
      toast({
        title: "Erro ao listar pastas",
        description: error.message || "Não foi possível carregar as pastas",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchFiles = async () => {
    try {
      setLoading(true);
      console.log('📄 Fetching files for folder:', currentFolder);
      const data = await invokeB2({ action: 'list_files', folderId: currentFolder });
      console.log('✅ Files loaded:', data);
      setFiles(data.map((f: any) => ({
        name: f.name,
        filePath: f.file_path,
        size: f.file_size,
        type: f.file_type,
        createdAt: f.created_at,
        id: f.id
      })));
    } catch (error) {
      console.error('❌ Error fetching files:', error);
      toast({
        title: "Erro ao listar arquivos",
        description: error.message || "Não foi possível carregar os arquivos",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchUsage = async () => {
    try {
      console.log('📊 Fetching storage usage...');
      const data = await invokeB2({ action: 'get_usage' });
      console.log('✅ Usage loaded:', data);
      setUsage({ 
        usedGB: data.totalUsageGB, 
        limitGB: data.storageLimitGB, 
        pct: data.usagePercentage 
      });
    } catch (error) {
      console.error('❌ Error fetching usage:', error);
      toast({
        title: "Erro ao carregar uso de armazenamento",
        description: error.message || "Não foi possível obter informações de uso",
        variant: "destructive",
      });
    }
  };

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
      toast({ title: 'Pasta criada com sucesso' })
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
    if (!token) {
      navigate('/auth')
      return
    }
    fetchFolders()
    fetchFiles()
    fetchUsage()
  }, [token, currentFolder])

  if (!token) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Card>
          <CardContent className="pt-6">
            <p>Redirecionando para login...</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={() => navigate('/')}>
            <Home className="mr-2 h-4 w-4" />
            Dashboard
          </Button>
          <h1 className="text-2xl font-bold">Upload de Arquivos B2</h1>
        </div>
      </div>

      {/* Test B2 Connection */}
      <TestB2Connection />

      {/* Navegação */}
      {currentFolder && (
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setCurrentFolder(null)}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar à Raiz
          </Button>
        </div>
      )}

      {/* Ações */}
      <div className="flex items-center gap-2">
        <Dialog open={showFolderDialog} onOpenChange={setShowFolderDialog}>
          <DialogTrigger asChild>
            <Button variant="outline">
              <FolderPlus className="mr-2 h-4 w-4" /> Nova Pasta
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Criar Nova Pasta</DialogTitle>
              <DialogDescription>Informe o nome da pasta</DialogDescription>
            </DialogHeader>
            <div className="mt-4 space-y-4">
              <Label htmlFor="folder-name">Nome da Pasta</Label>
              <Input
                id="folder-name"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="Ex: Documentos"
                onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
              />
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowFolderDialog(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleCreateFolder} disabled={!newFolderName.trim()}>
                  Criar Pasta
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <B2FileUpload
          currentFolder={currentFolder}
          onUploadComplete={() => { 
            fetchFiles()
            fetchUsage()
          }}
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
              {usage.usedGB.toFixed(2)} / {usage.limitGB.toFixed(2)} GB utilizados
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 mb-2">
              <HardDrive className="h-5 w-5 text-green-500" />
              <span className="font-medium">{usage.pct.toFixed(1)}%</span>
            </div>
            <Progress value={usage.pct} className="h-2" />
          </CardContent>
        </Card>
      )}

      {/* Conteúdo */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Folder className="h-5 w-5" />
            {currentFolder ? 'Conteúdo da Pasta' : 'Pasta Raiz'}
          </CardTitle>
          <CardDescription>
            {loading ? 'Carregando...' : 'Arquivos e pastas do Backblaze B2'}
          </CardDescription>
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
              {folders.map((folder) => (
                <TableRow
                  key={folder.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => setCurrentFolder(folder.id)}
                >
                  <TableCell className="flex items-center gap-2">
                    <Folder className="h-4 w-4 text-blue-500" />
                    <span className="font-medium">{folder.name}</span>
                  </TableCell>
                  <TableCell>Pasta</TableCell>
                  <TableCell>—</TableCell>
                  <TableCell>—</TableCell>
                  <TableCell className="text-right">—</TableCell>
                </TableRow>
              ))}
              {files.map((file) => (
                <TableRow key={file.id} className="hover:bg-muted/50">
                  <TableCell className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-gray-500" />
                    <span
                      className="cursor-pointer text-primary hover:underline"
                      onClick={() => handleDownload(file)}
                    >
                      {file.name}
                    </span>
                  </TableCell>
                  <TableCell>{file.type}</TableCell>
                  <TableCell>{(file.size / 1024).toFixed(2)} KB</TableCell>
                  <TableCell>{new Date(file.createdAt).toLocaleDateString()}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(file)}>
                      🗑️ Excluir
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {folders.length === 0 && files.length === 0 && !loading && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    {currentFolder ? 'Esta pasta está vazia' : 'Nenhum arquivo ou pasta encontrado'}
                  </TableCell>
                </TableRow>
              )}
              {loading && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    Carregando...
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