import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import { 
  Upload, 
  Download, 
  Trash2, 
  Folder, 
  File, 
  Shield, 
  Users, 
  Building, 
  Crown,
  ArrowLeft,
  RefreshCw,
  Home
} from 'lucide-react'
import { useAuth } from '@/components/auth/AuthContext'
import { PathSecurityManager, type UserProfile } from '@/utils/pathSecurity'
import { secureBackblazeService, type SecureB2File } from '@/services/secureBackblaze'

export const SecureFileManager: React.FC = () => {
  const { user } = useAuth()
  const [isInitialized, setIsInitialized] = useState(false)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [currentPath, setCurrentPath] = useState('')
  const [files, setFiles] = useState<SecureB2File[]>([])
  const [availablePaths, setAvailablePaths] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  
  // Estados para formulários
  const [newFolderName, setNewFolderName] = useState('')
  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null)

  // Inicializar o sistema de segurança
  useEffect(() => {
    const initializeSecurity = async () => {
      if (!user || isInitialized) return
      
      try {
        setLoading(true)
        const securityManager = PathSecurityManager.getInstance()
        await securityManager.initializeUser(user)
        
        const profile = securityManager.getCurrentUser()
        setUserProfile(profile)
        
        // Definir path inicial
        const defaultPath = securityManager.getDefaultPath()
        setCurrentPath(defaultPath)
        
        // Obter paths disponíveis
        const paths = secureBackblazeService.getAvailablePaths()
        setAvailablePaths(paths)
        
        setIsInitialized(true)
        
        // Carregar arquivos iniciais
        await loadFiles(defaultPath)
        
      } catch (error) {
        console.error('Erro ao inicializar segurança:', error)
        setError(`Erro de inicialização: ${error instanceof Error ? error.message : 'Erro desconhecido'}`)
      } finally {
        setLoading(false)
      }
    }

    initializeSecurity()
  }, [user, isInitialized])

  const loadFiles = async (path: string) => {
    try {
      setLoading(true)
      setError(null)
      const fileList = await secureBackblazeService.listFiles(path)
      setFiles(fileList)
    } catch (error) {
      console.error('Erro ao carregar arquivos:', error)
      setError(`Erro ao carregar arquivos: ${error instanceof Error ? error.message : 'Erro desconhecido'}`)
    } finally {
      setLoading(false)
    }
  }

  const handleNavigateToFolder = async (folderName: string) => {
    try {
      const newPath = await secureBackblazeService.navigateToFolder(currentPath, folderName)
      setCurrentPath(newPath)
      await loadFiles(newPath)
    } catch (error) {
      setError(`Erro de navegação: ${error instanceof Error ? error.message : 'Erro desconhecido'}`)
    }
  }

  const handleNavigateBack = async () => {
    try {
      const parentPath = await secureBackblazeService.navigateBack(currentPath)
      setCurrentPath(parentPath)
      await loadFiles(parentPath)
    } catch (error) {
      setError(`Erro de navegação: ${error instanceof Error ? error.message : 'Erro desconhecido'}`)
    }
  }

  const handleQuickNavigation = async (path: string) => {
    try {
      setCurrentPath(path)
      await loadFiles(path)
    } catch (error) {
      setError(`Erro de navegação rápida: ${error instanceof Error ? error.message : 'Erro desconhecido'}`)
    }
  }

  const handleUpload = async () => {
    if (!selectedFiles || selectedFiles.length === 0) {
      setError('Selecione arquivos para upload')
      return
    }

    try {
      setLoading(true)
      setError(null)
      
      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i]
        await secureBackblazeService.uploadFile(currentPath, file)
      }
      
      setSuccess(`${selectedFiles.length} arquivo(s) enviado(s) com sucesso`)
      setSelectedFiles(null)
      
      // Recarregar lista
      await loadFiles(currentPath)
      
    } catch (error) {
      setError(`Erro no upload: ${error instanceof Error ? error.message : 'Erro desconhecido'}`)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) {
      setError('Digite um nome para a pasta')
      return
    }

    try {
      setLoading(true)
      setError(null)
      
      await secureBackblazeService.createFolder(currentPath, newFolderName.trim())
      setSuccess(`Pasta '${newFolderName}' criada com sucesso`)
      setNewFolderName('')
      
      // Recarregar lista
      await loadFiles(currentPath)
      
    } catch (error) {
      setError(`Erro ao criar pasta: ${error instanceof Error ? error.message : 'Erro desconhecido'}`)
    } finally {
      setLoading(false)
    }
  }

  const handleDownload = async (file: SecureB2File) => {
    try {
      setLoading(true)
      setError(null)
      
      const downloadUrl = await secureBackblazeService.downloadFile(file.key)
      
      // Abrir download em nova aba
      window.open(downloadUrl, '_blank')
      setSuccess(`Download de '${file.name}' iniciado`)
      
    } catch (error) {
      setError(`Erro no download: ${error instanceof Error ? error.message : 'Erro desconhecido'}`)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (file: SecureB2File) => {
    if (!confirm(`Confirma a exclusão de '${file.name}'?`)) return

    try {
      setLoading(true)
      setError(null)
      
      if (file.isFolder) {
        await secureBackblazeService.deleteFolder(file.path)
      } else {
        await secureBackblazeService.deleteFile(file.key)
      }
      
      setSuccess(`'${file.name}' excluído com sucesso`)
      
      // Recarregar lista
      await loadFiles(currentPath)
      
    } catch (error) {
      setError(`Erro na exclusão: ${error instanceof Error ? error.message : 'Erro desconhecido'}`)
    } finally {
      setLoading(false)
    }
  }

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'super_admin': return <Crown className="h-4 w-4" />
      case 'company_admin': return <Shield className="h-4 w-4" />
      default: return <Users className="h-4 w-4" />
    }
  }

  const getPathIcon = (icon: string) => {
    switch (icon) {
      case 'crown': return <Crown className="h-4 w-4" />
      case 'building': return <Building className="h-4 w-4" />
      case 'shield': return <Shield className="h-4 w-4" />
      case 'users': return <Users className="h-4 w-4" />
      case 'user': return <File className="h-4 w-4" />
      default: return <Folder className="h-4 w-4" />
    }
  }

  if (!isInitialized) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center">
            <RefreshCw className="h-4 w-4 animate-spin mr-2" />
            Inicializando sistema de segurança...
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header do usuário */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {userProfile && getRoleIcon(userProfile.role)}
            Gerenciador Seguro de Arquivos
          </CardTitle>
          <CardDescription>
            {userProfile && (
              <div className="flex items-center gap-4">
                <span>{userProfile.email}</span>
                <Badge variant={userProfile.role === 'super_admin' ? 'default' : 'secondary'}>
                  {userProfile.role.replace('_', ' ')}
                </Badge>
              </div>
            )}
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Navegação rápida */}
      {availablePaths.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Acesso Rápido</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {availablePaths.map((pathItem, index) => (
                <Button
                  key={index}
                  variant={currentPath === pathItem.path ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleQuickNavigation(pathItem.path)}
                  className="flex items-center gap-2"
                >
                  {getPathIcon(pathItem.icon)}
                  {pathItem.name}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Alertas */}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert>
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      {/* Navegação atual */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleNavigateBack}
                disabled={loading}
              >
                <ArrowLeft className="h-4 w-4" />
                Voltar
              </Button>
              <span className="text-sm text-muted-foreground">
                {currentPath || '/'}
              </span>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => loadFiles(currentPath)}
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Ações */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Upload */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Upload className="h-4 w-4" />
              Upload de Arquivos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              type="file"
              multiple
              onChange={(e) => setSelectedFiles(e.target.files)}
            />
            <Button 
              onClick={handleUpload}
              disabled={loading || !selectedFiles || selectedFiles.length === 0}
              className="w-full"
            >
              Enviar {selectedFiles && selectedFiles.length > 0 && `(${selectedFiles.length})`}
            </Button>
          </CardContent>
        </Card>

        {/* Criar Pasta */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Folder className="h-4 w-4" />
              Criar Pasta
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              placeholder="Nome da pasta"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
            />
            <Button 
              onClick={handleCreateFolder}
              disabled={loading || !newFolderName.trim()}
              className="w-full"
            >
              Criar Pasta
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Lista de arquivos */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Arquivos e Pastas ({files.length})</span>
            <Badge variant="outline">
              {currentPath ? 'Pasta Atual' : 'Raiz'}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-4 w-4 animate-spin mr-2" />
              Carregando...
            </div>
          ) : files.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum arquivo ou pasta encontrado
            </div>
          ) : (
            <div className="space-y-2">
              {files.map((file) => (
                <div
                  key={file.key}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent/50"
                >
                  <div className="flex items-center gap-3">
                    {file.isFolder ? (
                      <Folder className="h-4 w-4 text-blue-500" />
                    ) : (
                      <File className="h-4 w-4 text-gray-500" />
                    )}
                    <div>
                      <div className="font-medium">{file.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {file.isFolder ? 'Pasta' : `${(file.size / 1024).toFixed(1)} KB`}
                        {' • '}
                        {new Date(file.lastModified).toLocaleString()}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {file.isFolder ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleNavigateToFolder(file.name)}
                      >
                        Abrir
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDownload(file)}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(file)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
