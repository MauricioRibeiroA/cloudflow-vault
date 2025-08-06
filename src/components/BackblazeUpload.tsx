import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { backblazeService, B2File } from '@/services/backblaze';
import { 
  FolderIcon, 
  FileIcon, 
  UploadIcon, 
  PlusIcon, 
  TrashIcon, 
  DownloadIcon,
  ArrowLeftIcon,
  RefreshCwIcon,
  WifiOffIcon,
  CheckCircleIcon
} from 'lucide-react';

const BackblazeUpload: React.FC = () => {
  const [files, setFiles] = useState<B2File[]>([]);
  const [currentPath, setCurrentPath] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [uploadFiles, setUploadFiles] = useState<FileList | null>(null);
  const [newFolderName, setNewFolderName] = useState('');
  const [connectionStatus, setConnectionStatus] = useState<'checking' | 'connected' | 'error'>('checking');
  const [createFolderDialogOpen, setCreateFolderDialogOpen] = useState(false);
  const { toast } = useToast();

  // Testa conexão na inicialização
  useEffect(() => {
    console.log('=== DEBUG VARIÁVEIS DE AMBIENTE ===');
    console.log('VITE_B2_ENDPOINT:', import.meta.env.VITE_B2_ENDPOINT);
    console.log('VITE_B2_REGION:', import.meta.env.VITE_B2_REGION);
    console.log('VITE_B2_ACCESS_KEY_ID:', import.meta.env.VITE_B2_ACCESS_KEY_ID);
    console.log('VITE_B2_SECRET_ACCESS_KEY:', import.meta.env.VITE_B2_SECRET_ACCESS_KEY ? '[DEFINIDA]' : '[NÃO DEFINIDA]');
    console.log('VITE_B2_BUCKET_NAME:', import.meta.env.VITE_B2_BUCKET_NAME);
    console.log('🔧 FORÇANDO MASTER KEY TEMPORARIAMENTE...');
    // Substituir temporariamente as variáveis no runtime
    (window as any).FORCE_MASTER_KEY = true;
    console.log('==================================');
    testConnection();
  }, []);

  // Carrega arquivos quando o path muda
  useEffect(() => {
    if (connectionStatus === 'connected') {
      loadFiles();
    }
  }, [currentPath, connectionStatus]);

  const testConnection = async () => {
    setConnectionStatus('checking');
    
    try {
      const result = await backblazeService.testConnection();
      
      if (result.success) {
        setConnectionStatus('connected');
        
        if (result.method === 'direct') {
          toast({
            title: "✅ Conectado ao Backblaze B2",
            description: "Conexão direta estabelecida com sucesso",
          });
        } else if (result.method === 'edge') {
          toast({
            title: "✅ Conectado via Edge Function",
            description: "Usando proxy do Supabase para contornar CORS",
          });
        }
      } else {
        setConnectionStatus('error');
        toast({
          title: "❌ Erro de Conexão",
          description: "Falha ao conectar tanto diretamente quanto via Edge Function",
          variant: "destructive",
        });
        
        if (result.error) {
          console.error('Detalhes do erro:', result.error);
        }
      }
    } catch (error: any) {
      console.error('Erro inesperado no teste de conexão:', error);
      setConnectionStatus('error');
      toast({
        title: "❌ Erro Inesperado",
        description: "Ocorreu um erro inesperado ao testar a conexão",
        variant: "destructive",
      });
    }
  };

  const loadFiles = async () => {
    setLoading(true);
    try {
      const fileList = await backblazeService.listFiles(currentPath);
      setFiles(fileList);
    } catch (error) {
      toast({
        title: "Erro",
        description: "Falha ao carregar arquivos",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async () => {
    if (!uploadFiles || uploadFiles.length === 0) return;

    setLoading(true);
    try {
      for (let i = 0; i < uploadFiles.length; i++) {
        const file = uploadFiles[i];
        await backblazeService.uploadFile(currentPath, file);
        
        toast({
          title: "✅ Upload realizado",
          description: `${file.name} enviado com sucesso`,
        });
      }
      
      setUploadFiles(null);
      // Reset file input
      const fileInput = document.getElementById('file-upload') as HTMLInputElement;
      if (fileInput) {
        fileInput.value = '';
      }
      await loadFiles();
    } catch (error) {
      toast({
        title: "Erro no Upload",
        description: "Falha ao enviar arquivo(s)",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;

    setLoading(true);
    try {
      await backblazeService.createFolder(currentPath, newFolderName);
      setNewFolderName('');
      
      toast({
        title: "✅ Pasta criada",
        description: `Pasta "${newFolderName}" criada com sucesso`,
      });
      
      await loadFiles();
    } catch (error) {
      toast({
        title: "Erro",
        description: "Falha ao criar pasta",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (file: B2File) => {
    if (!confirm(`Tem certeza que deseja deletar "${file.name}"?`)) return;

    setLoading(true);
    try {
      await backblazeService.deleteFile(file.key);
      
      toast({
        title: "✅ Arquivo deletado",
        description: `${file.name} foi removido`,
      });
      
      await loadFiles();
    } catch (error) {
      toast({
        title: "Erro",
        description: "Falha ao deletar arquivo",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (file: B2File) => {
    if (file.isFolder) return;

    try {
      setLoading(true);
      
      toast({
        title: "📥 Iniciando download...",
        description: `Preparando ${file.name}`,
      });
      
      // Use Edge Function para download direto (evita CORS)
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/b2-proxy`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({
          action: 'download',
          key: file.key
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Erro ao baixar arquivo');
      }
      
      // O Edge Function retorna o arquivo diretamente
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      
      // Cria um link temporário para forçar download
      const link = document.createElement('a');
      link.href = url;
      link.download = file.name;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Limpa a URL do blob
      window.URL.revokeObjectURL(url);
      
      toast({
        title: "✅ Download concluído",
        description: `${file.name} foi baixado`,
      });
    } catch (error) {
      console.error('Erro no download:', error);
      toast({
        title: "Erro no Download",
        description: error instanceof Error ? error.message : "Falha ao baixar arquivo",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const navigateToFolder = (folderName: string) => {
    console.log('📁 Navegando para pasta:', folderName);
    // Constrói caminho corretamente sem barras duplas
    const newPath = currentPath ? currentPath + folderName + '/' : folderName + '/';
    console.log('📁 Caminho atual:', currentPath);
    console.log('📁 Novo caminho:', newPath);
    setCurrentPath(newPath);
  };

  const goBack = () => {
    const pathParts = currentPath.split('/').filter(part => part);
    pathParts.pop();
    setCurrentPath(pathParts.length > 0 ? pathParts.join('/') + '/' : '');
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getConnectionIcon = () => {
    switch (connectionStatus) {
      case 'checking':
        return <RefreshCwIcon className="h-4 w-4 animate-spin" />;
      case 'connected':
        return <CheckCircleIcon className="h-4 w-4 text-green-500" />;
      case 'error':
        return <WifiOffIcon className="h-4 w-4 text-red-500" />;
    }
  };

  const getConnectionText = () => {
    switch (connectionStatus) {
      case 'checking':
        return 'Testando conexão...';
      case 'connected':
        return 'Conectado ao Backblaze B2';
      case 'error':
        return 'Erro de conexão';
    }
  };

  if (connectionStatus === 'error') {
    return (
      <div className="container mx-auto p-4">
        <Card className="max-w-md mx-auto">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <WifiOffIcon className="h-5 w-5 text-red-500" />
              Erro de Conexão
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              Não foi possível conectar ao Backblaze B2. Verifique as configurações.
            </p>
            <Button onClick={testConnection} className="w-full">
              <RefreshCwIcon className="h-4 w-4 mr-2" />
              Tentar Novamente
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 space-y-6">
      {/* Header com status de conexão */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Backblaze B2 Storage</span>
            <div className="flex items-center gap-2 text-sm">
              {getConnectionIcon()}
              {getConnectionText()}
            </div>
          </CardTitle>
        </CardHeader>
      </Card>

      {/* Navegação */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {currentPath && (
                <Button variant="outline" size="sm" onClick={goBack}>
                  <ArrowLeftIcon className="h-4 w-4 mr-2" />
                  Voltar
                </Button>
              )}
              <span className="text-sm text-muted-foreground">
                /{currentPath}
              </span>
            </div>
            <Button variant="outline" size="sm" onClick={loadFiles} disabled={loading}>
              <RefreshCwIcon className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Ações */}
      <div className="flex flex-wrap gap-4">
        {/* Upload de Arquivos */}
        <div className="flex items-center gap-2">
          <input
            type="file"
            multiple
            onChange={(e) => {
              console.log('📎 Arquivos selecionados:', e.target.files);
              console.log('📎 Quantidade:', e.target.files?.length || 0);
              setUploadFiles(e.target.files);
            }}
            className="hidden"
            id="file-upload"
            accept="*/*"
          />
          <Button
            variant="outline"
            onClick={() => {
              const fileInput = document.getElementById('file-upload') as HTMLInputElement;
              fileInput?.click();
            }}
            disabled={loading}
          >
            <FileIcon className="h-4 w-4 mr-2" />
            {uploadFiles && uploadFiles.length > 0 
              ? `${uploadFiles.length} arquivo(s) selecionado(s)` 
              : 'Selecionar Arquivos'
            }
          </Button>
          <Button 
            onClick={() => {
              console.log('📎 Botão upload clicado!');
              console.log('📎 uploadFiles:', uploadFiles);
              console.log('📎 uploadFiles?.length:', uploadFiles?.length);
              console.log('📎 loading:', loading);
              handleUpload();
            }} 
            disabled={!uploadFiles || uploadFiles.length === 0 || loading}
            variant={uploadFiles && uploadFiles.length > 0 && !loading ? 'default' : 'secondary'}
            className={uploadFiles && uploadFiles.length > 0 && !loading 
              ? 'bg-green-600 hover:bg-green-700 text-white' 
              : ''}
          >
            <UploadIcon className="h-4 w-4 mr-2" />
            {loading ? 'Enviando...' : `Upload ${uploadFiles && uploadFiles.length > 0 ? `(${uploadFiles.length})` : ''}`}
          </Button>
        </div>
        
        {/* Debug info */}
        {uploadFiles && uploadFiles.length > 0 && (
          <div className="text-sm text-muted-foreground">
            <p>📎 Arquivos selecionados: {uploadFiles.length}</p>
            {Array.from(uploadFiles).map((file, index) => (
              <p key={index}>• {file.name} ({(file.size / 1024).toFixed(1)}KB)</p>
            ))}
          </div>
        )}

        {/* Criar Pasta */}
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline">
              <PlusIcon className="h-4 w-4 mr-2" />
              Nova Pasta
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Criar Nova Pasta</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="folderName">Nome da Pasta</Label>
                <Input
                  id="folderName"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder="Digite o nome da pasta"
                />
              </div>
              <Button 
                onClick={handleCreateFolder} 
                disabled={!newFolderName.trim() || loading}
                className="w-full"
              >
                Criar Pasta
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Lista de Arquivos */}
      <Card>
        <CardHeader>
          <CardTitle>Arquivos e Pastas</CardTitle>
        </CardHeader>
        <CardContent>
          {loading && connectionStatus === 'checking' ? (
            <div className="text-center py-8">
              <RefreshCwIcon className="h-8 w-8 animate-spin mx-auto mb-2" />
              <p>Carregando...</p>
            </div>
          ) : files.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>Nenhum arquivo encontrado</p>
            </div>
          ) : (
            <div className="space-y-2">
              {files.map((file) => (
                <div
                  key={file.key}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50"
                >
                  <div className="flex items-center gap-3">
                    {file.isFolder ? (
                      <FolderIcon className="h-5 w-5 text-blue-500" />
                    ) : (
                      <FileIcon className="h-5 w-5 text-gray-500" />
                    )}
                    <div>
                      <p className="font-medium">{file.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {file.isFolder ? 'Pasta' : formatFileSize(file.size)}
                        {!file.isFolder && ' • ' + file.lastModified.toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {file.isFolder ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigateToFolder(file.name)}
                      >
                        Abrir
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDownload(file)}
                      >
                        <DownloadIcon className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(file)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default BackblazeUpload;
