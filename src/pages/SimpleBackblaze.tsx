import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { 
  CheckCircleIcon, 
  WifiOffIcon, 
  RefreshCwIcon,
  UploadIcon,
  FileIcon,
  FolderIcon,
  PlusIcon,
  TrashIcon,
  DownloadIcon,
  ArrowLeftIcon,
  HardDriveIcon
} from 'lucide-react';
import { unifiedBackblazeService, B2FileAlternative } from '@/services/backblaze-api';

const SimpleBackblaze: React.FC = () => {
  const [connectionStatus, setConnectionStatus] = useState<'checking' | 'connected' | 'error'>('checking');
  const [files, setFiles] = useState<B2FileAlternative[]>([]);
  const [currentPath, setCurrentPath] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [uploadFiles, setUploadFiles] = useState<FileList | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);  
  const [newFolderName, setNewFolderName] = useState('');
  const [usageStats, setUsageStats] = useState<any>(null);
  const { toast } = useToast();

  // Teste de conexão na inicialização
  useEffect(() => {
    testConnection();
  }, []);

  // Carrega arquivos quando a conexão é estabelecida ou path muda
  useEffect(() => {
    if (connectionStatus === 'connected') {
      loadFiles();
      loadUsageStats();
    }
  }, [currentPath, connectionStatus]);

  const testConnection = async () => {
    setConnectionStatus('checking');
    
    try {
      const result = await unifiedBackblazeService.testConnection();
      
      if (result.success) {
        setConnectionStatus('connected');
        toast({
          title: "✅ Sistema Conectado",
          description: `Usando ${result.method === 'supabase' ? 'Supabase Storage' : 'Backblaze B2'}`,
          duration: 3000,
        });
      } else {
        setConnectionStatus('error');
        toast({
          title: "❌ Erro de Conexão",
          description: "Não foi possível estabelecer conexão",
          variant: "destructive",
        });
      }
    } catch (error) {
      setConnectionStatus('error');
      toast({
        title: "❌ Erro Inesperado",
        description: "Falha ao testar conexão",
        variant: "destructive",
      });
    }
  };

  const loadFiles = async () => {
    setLoading(true);
    try {
      const fileList = await unifiedBackblazeService.listFiles(currentPath);
      setFiles(fileList);
    } catch (error) {
      console.error('Erro ao carregar arquivos:', error);
      toast({
        title: "Erro",
        description: "Falha ao carregar arquivos",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadUsageStats = async () => {
    try {
      const stats = await unifiedBackblazeService.getUsageStats();
      setUsageStats(stats);
    } catch (error) {
      console.error('Erro ao carregar estatísticas:', error);
    }
  };

  const handleUpload = async () => {
    if (!uploadFiles || uploadFiles.length === 0) return;

    setLoading(true);
    setUploadProgress(0);

    try {
      for (let i = 0; i < uploadFiles.length; i++) {
        const file = uploadFiles[i];
        setUploadProgress((i / uploadFiles.length) * 100);
        
        await unifiedBackblazeService.uploadFile(currentPath, file);
        
        toast({
          title: "✅ Upload Concluído",
          description: `${file.name} enviado com sucesso`,
        });
      }
      
      setUploadFiles(null);
      setUploadProgress(100);
      await loadFiles();
      await loadUsageStats();
      
      // Reset progress after 2 seconds
      setTimeout(() => setUploadProgress(0), 2000);
    } catch (error) {
      console.error('Erro no upload:', error);
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
      await unifiedBackblazeService.createFolder(currentPath, newFolderName);
      setNewFolderName('');
      
      toast({
        title: "✅ Pasta Criada",
        description: `Pasta "${newFolderName}" criada com sucesso`,
      });
      
      await loadFiles();
    } catch (error) {
      console.error('Erro ao criar pasta:', error);
      toast({
        title: "Erro",
        description: "Falha ao criar pasta",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (file: B2FileAlternative) => {
    if (!confirm(`Tem certeza que deseja deletar "${file.name}"?`)) return;

    setLoading(true);
    try {
      await unifiedBackblazeService.deleteFile(file.key);
      
      toast({
        title: "✅ Arquivo Deletado",
        description: `${file.name} foi removido`,
      });
      
      await loadFiles();
      await loadUsageStats();
    } catch (error) {
      console.error('Erro ao deletar:', error);
      toast({
        title: "Erro",
        description: "Falha ao deletar arquivo",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (file: B2FileAlternative) => {
    if (file.isFolder) return;

    try {
      const downloadUrl = await unifiedBackblazeService.getDownloadUrl(file.key);
      window.open(downloadUrl, '_blank');
      
      toast({
        title: "✅ Download Iniciado",
        description: `Baixando ${file.name}`,
      });
    } catch (error) {
      console.error('Erro no download:', error);
      toast({
        title: "Erro no Download",
        description: "Falha ao gerar link de download",
        variant: "destructive",
      });
    }
  };

  const navigateToFolder = (folderName: string) => {
    const newPath = currentPath ? `${currentPath}${folderName}/` : `${folderName}/`;
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

  const getConnectionBadge = () => {
    switch (connectionStatus) {
      case 'checking':
        return (
          <Badge variant="secondary" className="ml-2">
            <RefreshCwIcon className="h-3 w-3 mr-1 animate-spin" />
            Conectando...
          </Badge>
        );
      case 'connected':
        return (
          <Badge variant="default" className="ml-2 bg-green-500">
            <CheckCircleIcon className="h-3 w-3 mr-1" />
            Conectado
          </Badge>
        );
      case 'error':
        return (
          <Badge variant="destructive" className="ml-2">
            <WifiOffIcon className="h-3 w-3 mr-1" />
            Erro
          </Badge>
        );
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
              Não foi possível conectar ao sistema de armazenamento.
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
      {/* Header com status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center">
              <HardDriveIcon className="h-5 w-5 mr-2" />
              Gerenciador de Arquivos
              {getConnectionBadge()}
            </div>
            <Button onClick={testConnection} variant="outline" size="sm">
              <RefreshCwIcon className="h-4 w-4" />
            </Button>
          </CardTitle>
        </CardHeader>
        
        {/* Estatísticas de uso */}
        {usageStats && (
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Armazenamento usado:</span>
                <span>{usageStats.totalSizeGB} GB / 10 GB</span>
              </div>
              <Progress value={usageStats.usagePercentage} className="h-2" />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{usageStats.totalFiles} arquivos</span>
                <span>{Math.round(100 - usageStats.usagePercentage)}% disponível</span>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Navegação e ações */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              {currentPath && (
                <Button onClick={goBack} variant="outline" size="sm">
                  <ArrowLeftIcon className="h-4 w-4" />
                </Button>
              )}
              <span className="text-sm text-muted-foreground">
                /{currentPath}
              </span>
            </div>
            
            <div className="flex space-x-2">
              {/* Upload de arquivos */}
              <div className="flex items-center space-x-2">
                <Input
                  type="file"
                  multiple
                  onChange={(e) => setUploadFiles(e.target.files)}
                  className="w-48"
                  disabled={loading}
                />
                <Button 
                  onClick={handleUpload} 
                  disabled={!uploadFiles || loading}
                  size="sm"
                >
                  <UploadIcon className="h-4 w-4 mr-1" />
                  Upload
                </Button>
              </div>

              {/* Criar pasta */}
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <PlusIcon className="h-4 w-4 mr-1" />
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
                    <Button onClick={handleCreateFolder} className="w-full">
                      Criar Pasta
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>

        {/* Progress bar do upload */}
        {uploadProgress > 0 && uploadProgress < 100 && (
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Enviando arquivos...</span>
                <span>{Math.round(uploadProgress)}%</span>
              </div>
              <Progress value={uploadProgress} />
            </div>
          </CardContent>
        )}

        {/* Lista de arquivos */}
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCwIcon className="h-6 w-6 animate-spin mr-2" />
              Carregando...
            </div>
          ) : files.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
              Nenhum arquivo encontrado nesta pasta
            </div>
          ) : (
            <div className="space-y-2">
              {files.map((file, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50"
                >
                  <div className="flex items-center space-x-3">
                    {file.isFolder ? (
                      <FolderIcon className="h-5 w-5 text-blue-500" />
                    ) : (
                      <FileIcon className="h-5 w-5 text-gray-500" />
                    )}
                    <div>
                      <p 
                        className={`font-medium ${file.isFolder ? 'cursor-pointer hover:text-blue-600' : ''}`}
                        onClick={() => file.isFolder && navigateToFolder(file.name)}
                      >
                        {file.name}
                      </p>
                      {!file.isFolder && file.size && (
                        <p className="text-xs text-muted-foreground">
                          {formatFileSize(file.size)}
                        </p>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex space-x-1">
                    {!file.isFolder && (
                      <Button
                        onClick={() => handleDownload(file)}
                        variant="ghost"
                        size="sm"
                      >
                        <DownloadIcon className="h-4 w-4" />
                      </Button>
                    )}
                    
                    <Button
                      onClick={() => handleDelete(file)}
                      variant="ghost"
                      size="sm"
                      className="text-red-600 hover:text-red-700"
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

export default SimpleBackblaze;
