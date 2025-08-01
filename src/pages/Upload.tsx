import React, { useState, useCallback } from "react";
import { useAuth } from "@/components/auth/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileUp, FolderPlus, Upload, FileText, Folder, Download, Trash2, Cloud, HardDrive, BarChart3 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { FileUpload } from "@/components/ui/file-upload";
import { B2FileUpload } from "@/components/ui/b2-file-upload";

interface File {
  id: string;
  name: string;
  file_path: string;
  file_size: number;
  file_type: string;
  folder_id?: string;
  uploaded_by: string;
  created_at: string;
}

interface Folder {
  id: string;
  name: string;
  parent_id?: string;
  created_by: string;
  created_at: string;
}

interface StorageUsage {
  totalUsageBytes: number;
  totalUsageGB: number;
  storageLimitGB: number;
  usagePercentage: number;
}

const UploadFiles = () => {
  const { session } = useAuth();
  const accessToken = session?.access_token;
  const user = session?.user;
  const { toast } = useToast();
  const [files, setFiles] = useState<File[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [currentFolder, setCurrentFolder] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [showFolderDialog, setShowFolderDialog] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [storageUsage, setStorageUsage] = useState<StorageUsage | null>(null);

  const fetchFolders = async () => {
    try {
      const { data, error } = await supabase
        .from("folders")
        .select("*")
        .order("name");
      
      if (error) throw error;
      setFolders(data || []);
    } catch (error) {
      console.error("Erro ao carregar pastas:", error);
    }
  };

  const fetchFiles = async () => {
  try {
    const query = supabase
      .from("files")
      .select("*")
      .order("created_at", { ascending: false });

    if (currentFolder) {
      query.eq("folder_id", currentFolder);
    } else {
      query.is("folder_id", null);
    }

    const { data, error } = await query;

    if (error) throw error;
    setFiles(data || []);
  } catch (error) {
    console.error("Erro ao carregar arquivos:", error);
  }
};



 const fetchStorageUsage = async () => {
  if (!accessToken) return;

  try {
    const { data, error } = await supabase.functions.invoke('b2-file-manager', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        action: 'list_usage',
        group_name: user?.user_metadata.group_name,
        company_id: user?.user_metadata.company_id
      })
    });
    if (error) throw error;
    setStorageUsage(data);
  } catch (err: any) {
    console.error('Erro ao carregar uso de storage:', err);
    toast.error(err.message);
  }
};



  React.useEffect(() => {
    fetchFolders();
    fetchFiles();
    fetchStorageUsage();
  }, [currentFolder]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    setIsUploading(true);
    setUploadProgress(0);

    try {
      // Upload para storage
      const fileName = `${Date.now()}_${file.name}`;
      const filePath = currentFolder ? `${currentFolder}/${fileName}` : fileName;
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("files")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Salvar metadata no banco
      const { error: dbError } = await supabase
        .from("files")
        .insert({
          name: file.name,
          file_path: uploadData.path,
          file_size: file.size,
          file_type: file.type,
          folder_id: currentFolder,
          uploaded_by: user.id,
        });

      if (dbError) throw dbError;

      toast({
        title: "Sucesso",
        description: "Arquivo enviado com sucesso!",
      });

      fetchFiles();
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Erro ao enviar arquivo",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
      // Reset input
      event.target.value = "";
    }
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim() || !user) return;

    try {
      const { error } = await supabase
        .from("folders")
        .insert({
          name: newFolderName,
          parent_id: currentFolder,
          created_by: user.id,
        });

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Pasta criada com sucesso!",
      });

      setNewFolderName("");
      setShowFolderDialog(false);
      fetchFolders();
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Erro ao criar pasta",
        variant: "destructive",
      });
    }
  };

  const handleDownloadFromB2 = async (file: File) => {
    if (!session?.access_token) {
      toast({
        title: "Erro de autenticação",
        description: "Sessão não encontrada. Faça login novamente.",
        variant: "destructive",
      });
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('b2-download-url', {
        body: { fileId: file.id },
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });

      if (error) throw error;

      // Open the signed URL in a new tab for download
      window.open(data.signedUrl, '_blank');

      toast({
        title: "Download iniciado",
        description: `Download de ${data.fileName} foi iniciado.`,
      });
    } catch (error: any) {
      toast({
        title: "Erro no download",
        description: error.message || "Erro ao baixar arquivo",
        variant: "destructive",
      });
    }
  };

  const handleDeleteFromB2 = async (file: File) => {
    if (!session?.access_token) {
      toast({
        title: "Erro de autenticação",
        description: "Sessão não encontrada. Faça login novamente.",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase.functions.invoke('b2-file-manager', {
        body: { 
          action: 'delete',
          fileId: file.id 
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Arquivo excluído do Backblaze B2 com sucesso!",
      });

      fetchFiles();
      fetchStorageUsage();
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Erro ao excluir arquivo",
        variant: "destructive",
      });
    }
  };

  const handleDownload = async (file: File) => {
    try {
      const { data, error } = await supabase.storage
        .from("files")
        .download(file.file_path);

      if (error) throw error;

      // Criar URL para download
      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: "Sucesso",
        description: "Download iniciado!",
      });
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Erro ao baixar arquivo",
        variant: "destructive",
      });
    }
  };

  const handleDeleteFile = async (file: File) => {
    try {
      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from("files")
        .remove([file.file_path]);

      if (storageError) throw storageError;

      // Delete from database
      const { error: dbError } = await supabase
        .from("files")
        .delete()
        .eq("id", file.id);

      if (dbError) throw dbError;

      toast({
        title: "Sucesso",
        description: "Arquivo excluído com sucesso!",
      });

      fetchFiles();
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Erro ao excluir arquivo",
        variant: "destructive",
      });
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const getCurrentFolderName = () => {
    if (!currentFolder) return "Raiz";
    const folder = folders.find(f => f.id === currentFolder);
    return folder?.name || "Pasta Desconhecida";
  };

  const getVisibleFolders = () => {
    return folders.filter(folder => folder.parent_id === currentFolder);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Gerenciamento de Arquivos</h1>
          <p className="text-muted-foreground">
            Gerencie arquivos no Supabase Storage e Backblaze B2
          </p>
        </div>
        <div className="flex gap-2">
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
                  Digite o nome da nova pasta
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="folder-name">Nome da Pasta</Label>
                  <Input
                    id="folder-name"
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    placeholder="Nome da pasta"
                  />
                </div>
                <div className="flex justify-end space-x-2">
                  <Button variant="outline" onClick={() => setShowFolderDialog(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={handleCreateFolder}>
                    Criar
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
          
          <FileUpload 
            currentFolder={currentFolder} 
            onUploadComplete={() => {
              fetchFiles();
              fetchStorageUsage();
            }} 
          />
          
          <B2FileUpload 
            currentFolder={currentFolder} 
            onUploadComplete={() => {
              fetchFiles();
              fetchStorageUsage();
            }} 
          />
        </div>
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
              Monitoramento do espaço utilizado em sua conta
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">
                  {storageUsage.totalUsageGB.toFixed(2)} GB de {storageUsage.storageLimitGB} GB utilizados
                </span>
                <span className="text-sm text-muted-foreground">
                  {storageUsage.usagePercentage.toFixed(1)}%
                </span>
              </div>
              <Progress value={storageUsage.usagePercentage} className="h-2" />
              {storageUsage.usagePercentage > 90 && (
                <div className="text-sm text-amber-600">
                  ⚠️ Você está próximo do limite de armazenamento
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Breadcrumb */}
      <div className="flex items-center space-x-2 text-sm text-muted-foreground">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setCurrentFolder(null)}
          className="h-auto p-1"
        >
          Início
        </Button>
        {currentFolder && (
          <>
            <span>/</span>
            <span>{getCurrentFolderName()}</span>
          </>
        )}
      </div>

      {/* Upload Progress */}
      {isUploading && (
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Enviando arquivo...</span>
                <span>{Math.round(uploadProgress)}%</span>
              </div>
              <Progress value={uploadProgress} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Files and Folders Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Folder className="h-5 w-5" />
            {getCurrentFolderName()}
          </CardTitle>
          <CardDescription>
            Arquivos e pastas nesta localização
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Tamanho</TableHead>
                <TableHead>Storage</TableHead>
                <TableHead>Data de Criação</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {/* Folders */}
              {getVisibleFolders().map((folder) => (
                <TableRow
                  key={folder.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => setCurrentFolder(folder.id)}
                >
                  <TableCell className="flex items-center gap-2">
                    <Folder className="h-4 w-4 text-blue-500" />
                    <span className="font-medium">{folder.name}</span>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">Pasta</Badge>
                  </TableCell>
                  <TableCell>-</TableCell>
                  <TableCell>-</TableCell>
                  <TableCell>
                    {new Date(folder.created_at).toLocaleDateString("pt-BR")}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setCurrentFolder(folder.id);
                      }}
                    >
                      Abrir
                    </Button>
                  </TableCell>
                </TableRow>
              ))}

              {/* Files */}
              {files.map((file) => {
                const isB2File = file.file_path.includes('/');
                
                return (
                  <TableRow key={file.id}>
                    <TableCell className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-gray-500" />
                      <span>{file.name}</span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{file.file_type || "Arquivo"}</Badge>
                    </TableCell>
                    <TableCell>{formatFileSize(file.file_size)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {isB2File ? (
                          <>
                            <Cloud className="h-3 w-3 text-blue-500" />
                            <span className="text-xs">B2</span>
                          </>
                        ) : (
                          <>
                            <HardDrive className="h-3 w-3 text-green-500" />
                            <span className="text-xs">Supabase</span>
                          </>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {new Date(file.created_at).toLocaleDateString("pt-BR")}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => isB2File ? handleDownloadFromB2(file) : handleDownload(file)}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => isB2File ? handleDeleteFromB2(file) : handleDeleteFile(file)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}

              {getVisibleFolders().length === 0 && files.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    Nesta pasta não há arquivos nem pastas
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default UploadFiles;
