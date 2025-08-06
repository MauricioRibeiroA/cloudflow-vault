// src/pages/SimpleUpload.tsx - CRUD Simplificado sem Edge Functions
import React, { useState, useEffect } from 'react'
import { useAuth } from '@/components/auth/AuthContext'
import { supabase } from '@/integrations/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table'
import { FolderPlus, Folder, FileText, Trash2, Plus } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface SimpleFolder {
  id: string
  name: string
  parent_id: string | null
  created_at: string
}

interface SimpleFile {
  id: string
  name: string
  size: number
  file_size: number
  file_type: string
  created_at: string
  folder_id: string | null
}

export default function SimpleUpload() {
  const { session } = useAuth()
  const { toast } = useToast()
  const [folders, setFolders] = useState<SimpleFolder[]>([])
  const [files, setFiles] = useState<SimpleFile[]>([])
  const [currentFolder, setCurrentFolder] = useState<string | null>(null)
  const [newFolderName, setNewFolderName] = useState('')
  const [showCreateFolder, setShowCreateFolder] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)

  // Buscar pastas
  const fetchFolders = async () => {
    try {
      console.log('Buscando pastas para parent:', currentFolder)
      
      let query = supabase
        .from('folders')
        .select('*')
        .order('name')

      if (currentFolder) {
        query = query.eq('parent_id', currentFolder)
      } else {
        query = query.is('parent_id', null)
      }

      const { data, error } = await query

      if (error) {
        console.error('Erro ao buscar pastas:', error)
        toast({
          variant: 'destructive',
          title: 'Erro ao carregar pastas',
          description: error.message
        })
        return
      }

      console.log('Pastas encontradas:', data)
      setFolders(data || [])
    } catch (error: any) {
      console.error('Erro na busca de pastas:', error)
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Falha ao carregar pastas'
      })
    }
  }

  // Buscar arquivos
  const fetchFiles = async () => {
    try {
      console.log('Buscando arquivos para folder:', currentFolder)
      
      let query = supabase
        .from('files')
        .select('*')
        .order('name')

      if (currentFolder) {
        query = query.eq('folder_id', currentFolder)
      } else {
        query = query.is('folder_id', null)
      }

      const { data, error } = await query

      if (error) {
        console.error('Erro ao buscar arquivos:', error)
        toast({
          variant: 'destructive',
          title: 'Erro ao carregar arquivos',
          description: error.message
        })
        return
      }

      console.log('Arquivos encontrados:', data)
      // Map para converter file_size para size
      const mappedFiles = (data || []).map(file => ({
        ...file,
        size: file.file_size
      }))
      setFiles(mappedFiles)
    } catch (error: any) {
      console.error('Erro na busca de arquivos:', error)
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Falha ao carregar arquivos'
      })
    }
  }

  // Criar pasta
  const createFolder = async () => {
    if (!newFolderName.trim()) return

    try {
      console.log('Criando pasta:', newFolderName, 'em parent:', currentFolder)
      
      const { data, error } = await supabase
        .from('folders')
        .insert([{
          name: newFolderName.trim(),
          parent_id: currentFolder,
          created_by: session?.user?.id,
          company_id: null // Super admin
        }])
        .select()

      if (error) {
        console.error('Erro ao criar pasta:', error)
        toast({
          variant: 'destructive',
          title: 'Erro ao criar pasta',
          description: error.message
        })
        return
      }

      console.log('Pasta criada:', data)
      setNewFolderName('')
      setShowCreateFolder(false)
      fetchFolders()
      toast({
        title: 'Sucesso',
        description: 'Pasta criada com sucesso!'
      })
    } catch (error: any) {
      console.error('Erro na criação de pasta:', error)
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Falha ao criar pasta'
      })
    }
  }

  // Upload de arquivo simulado (sem Backblaze por enquanto)
  const uploadFile = async () => {
    if (!selectedFile) return

    setUploading(true)
    try {
      console.log('Fazendo upload do arquivo:', selectedFile.name)
      
      // Por enquanto, vamos apenas salvar os metadados
      const { data, error } = await supabase
        .from('files')
        .insert([{
          name: selectedFile.name,
          file_size: selectedFile.size,
          file_type: selectedFile.type,
          folder_id: currentFolder,
          uploaded_by: session?.user?.id,
          company_id: null, // Super admin
          file_path: `temp/${Date.now()}-${selectedFile.name}` // Path temporário
        }])
        .select()

      if (error) {
        console.error('Erro ao salvar arquivo:', error)
        toast({
          variant: 'destructive',
          title: 'Erro no upload',
          description: error.message
        })
        return
      }

      console.log('Arquivo salvo:', data)
      setSelectedFile(null)
      fetchFiles()
      toast({
        title: 'Sucesso',
        description: 'Arquivo enviado com sucesso!'
      })
    } catch (error: any) {
      console.error('Erro no upload:', error)
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Falha no upload do arquivo'
      })
    } finally {
      setUploading(false)
    }
  }

  // Deletar arquivo
  const deleteFile = async (fileId: string) => {
    try {
      console.log('Deletando arquivo:', fileId)
      
      const { error } = await supabase
        .from('files')
        .delete()
        .eq('id', fileId)

      if (error) {
        console.error('Erro ao deletar arquivo:', error)
        toast({
          variant: 'destructive',
          title: 'Erro ao deletar',
          description: error.message
        })
        return
      }

      fetchFiles()
      toast({
        title: 'Sucesso',
        description: 'Arquivo deletado com sucesso!'
      })
    } catch (error: any) {
      console.error('Erro na deleção:', error)
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Falha ao deletar arquivo'
      })
    }
  }

  // Deletar pasta
  const deleteFolder = async (folderId: string) => {
    try {
      console.log('Deletando pasta:', folderId)
      
      const { error } = await supabase
        .from('folders')
        .delete()
        .eq('id', folderId)

      if (error) {
        console.error('Erro ao deletar pasta:', error)
        toast({
          variant: 'destructive',
          title: 'Erro ao deletar',
          description: error.message
        })
        return
      }

      fetchFolders()
      toast({
        title: 'Sucesso',
        description: 'Pasta deletada com sucesso!'
      })
    } catch (error: any) {
      console.error('Erro na deleção:', error)
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Falha ao deletar pasta'
      })
    }
  }

  useEffect(() => {
    if (session?.user) {
      fetchFolders()
      fetchFiles()
    }
  }, [session, currentFolder])

  if (!session?.user) {
    return <div>Carregando...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Gerenciador de Arquivos Simplificado</h1>
        {currentFolder && (
          <Button 
            variant="outline" 
            onClick={() => setCurrentFolder(null)}
          >
            Voltar à Raiz
          </Button>
        )}
      </div>

      {/* Controles */}
      <div className="flex gap-4">
        <Button 
          onClick={() => setShowCreateFolder(!showCreateFolder)}
          className="flex items-center gap-2"
        >
          <FolderPlus className="w-4 h-4" />
          Nova Pasta
        </Button>
        
        <div className="flex items-center gap-2">
          <Input
            type="file"
            onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
            className="max-w-xs"
          />
          <Button 
            onClick={uploadFile} 
            disabled={!selectedFile || uploading}
          >
            {uploading ? 'Enviando...' : 'Upload'}
          </Button>
        </div>
      </div>

      {/* Criar Pasta */}
      {showCreateFolder && (
        <Card>
          <CardHeader>
            <CardTitle>Criar Nova Pasta</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="folder-name">Nome da Pasta</Label>
              <Input
                id="folder-name"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="Digite o nome da pasta"
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={createFolder}>Criar</Button>
              <Button 
                variant="outline" 
                onClick={() => {
                  setShowCreateFolder(false)
                  setNewFolderName('')
                }}
              >
                Cancelar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Lista de Pastas e Arquivos */}
      <Card>
        <CardHeader>
          <CardTitle>
            {currentFolder ? 'Conteúdo da Pasta' : 'Raiz'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Tamanho</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {folders.map((folder) => (
                <TableRow key={folder.id}>
                  <TableCell 
                    className="flex items-center gap-2 cursor-pointer"
                    onClick={() => setCurrentFolder(folder.id)}
                  >
                    <Folder className="w-4 h-4 text-blue-500" />
                    {folder.name}
                  </TableCell>
                  <TableCell>Pasta</TableCell>
                  <TableCell>—</TableCell>
                  <TableCell>
                    {new Date(folder.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteFolder(folder.id)}
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {files.map((file) => (
                <TableRow key={file.id}>
                  <TableCell className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-gray-500" />
                    {file.name}
                  </TableCell>
                  <TableCell>Arquivo</TableCell>
                  <TableCell>
                    {(file.size / 1024).toFixed(2)} KB
                  </TableCell>
                  <TableCell>
                    {new Date(file.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteFile(file.id)}
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {folders.length === 0 && files.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-gray-500">
                    Nenhum item encontrado
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
