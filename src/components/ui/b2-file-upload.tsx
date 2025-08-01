
import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/auth/AuthContext';
import { toast } from '@/hooks/use-toast';
import { Upload, X, File, CheckCircle, AlertCircle, Cloud } from 'lucide-react';
import { cn } from '@/lib/utils';

interface B2FileUploadProps {
  currentFolder: string | null;
  onUploadComplete: () => void;
}

interface UploadFile {
  file: File;
  id: string;
  progress: number;
  status: 'pending' | 'getting_url' | 'uploading' | 'saving_metadata' | 'completed' | 'error';
  error?: string;
  signedUrl?: string;
  filePath?: string;
}

export function B2FileUpload({ currentFolder, onUploadComplete }: B2FileUploadProps) {
  const { user, session } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [uploadFiles, setUploadFiles] = useState<UploadFile[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const generateId = () => Math.random().toString(36).substr(2, 9);

  const handleFiles = (files: FileList) => {
    const newFiles: UploadFile[] = Array.from(files).map(file => ({
      file,
      id: generateId(),
      progress: 0,
      status: 'pending'
    }));
    
    setUploadFiles(prev => [...prev, ...newFiles]);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFiles(files);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFiles(files);
    }
  };

  const uploadFile = async (uploadFile: UploadFile) => {
    if (!user || !session) return;

    try {
      // Step 1: Get signed URL
      setUploadFiles(prev => 
        prev.map(f => f.id === uploadFile.id ? { 
          ...f, 
          status: 'getting_url' as const,
          progress: 10 
        } : f)
      );

      const { data: urlData, error: urlError } = await supabase.functions.invoke('b2-upload-url', {
        body: {
          fileName: uploadFile.file.name,
          fileSize: uploadFile.file.size,
          fileType: uploadFile.file.type || 'application/octet-stream',
          folderId: currentFolder
        }
      });

      if (urlError || !urlData.signedUrl) {
        throw new Error(urlError?.message || 'Failed to get upload URL');
      }

      // Step 2: Upload to B2
      setUploadFiles(prev => 
        prev.map(f => f.id === uploadFile.id ? { 
          ...f, 
          status: 'uploading' as const,
          progress: 20,
          signedUrl: urlData.signedUrl,
          filePath: urlData.filePath
        } : f)
      );

      const uploadResponse = await fetch(urlData.signedUrl, {
        method: 'PUT',
        body: uploadFile.file,
        headers: {
          'Content-Type': uploadFile.file.type || 'application/octet-stream',
        }
      });

      if (!uploadResponse.ok) {
        throw new Error(`Upload failed: ${uploadResponse.statusText}`);
      }

      // Update progress during upload
      setUploadFiles(prev => 
        prev.map(f => f.id === uploadFile.id ? { ...f, progress: 80 } : f)
      );

      // Step 3: Save metadata
      setUploadFiles(prev => 
        prev.map(f => f.id === uploadFile.id ? { 
          ...f, 
          status: 'saving_metadata' as const,
          progress: 90 
        } : f)
      );

      const { error: metadataError } = await supabase.functions.invoke('b2-file-manager', {
        body: {
          action: 'save_metadata',
          fileName: uploadFile.file.name,
          filePath: urlData.filePath,
          fileSize: uploadFile.file.size,
          fileType: uploadFile.file.type || 'application/octet-stream',
          folderId: currentFolder
        }
      });

      if (metadataError) {
        throw new Error('Failed to save file metadata');
      }

      // Step 4: Complete
      setUploadFiles(prev => 
        prev.map(f => f.id === uploadFile.id ? { 
          ...f, 
          status: 'completed' as const, 
          progress: 100 
        } : f)
      );

      toast({
        title: "Upload concluído",
        description: `${uploadFile.file.name} foi enviado para Backblaze B2 com sucesso.`
      });

    } catch (error: any) {
      console.error('Upload error:', error);
      setUploadFiles(prev => 
        prev.map(f => f.id === uploadFile.id ? { 
          ...f, 
          status: 'error' as const, 
          error: error.message 
        } : f)
      );

      toast({
        title: "Erro no upload",
        description: `Falha ao enviar ${uploadFile.file.name}: ${error.message}`,
        variant: "destructive"
      });
    }
  };

  const uploadAllFiles = async () => {
    const pendingFiles = uploadFiles.filter(f => f.status === 'pending');
    
    for (const file of pendingFiles) {
      await uploadFile(file);
    }
    
    // Refresh the file list
    onUploadComplete();
  };

  const removeFile = (id: string) => {
    setUploadFiles(prev => prev.filter(f => f.id !== id));
  };

  const clearCompleted = () => {
    setUploadFiles(prev => prev.filter(f => f.status !== 'completed'));
  };

  const getStatusIcon = (status: UploadFile['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'getting_url':
      case 'uploading':
      case 'saving_metadata':
        return <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />;
      default:
        return <File className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusText = (status: UploadFile['status']) => {
    switch (status) {
      case 'getting_url':
        return 'Obtendo URL...';
      case 'uploading':
        return 'Enviando para B2...';
      case 'saving_metadata':
        return 'Salvando metadados...';
      case 'completed':
        return 'Concluído';
      case 'error':
        return 'Erro';
      default:
        return 'Pendente';
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="default" className="flex items-center gap-2">
          <Cloud className="h-4 w-4" />
          Upload B2
        </Button>
      </DialogTrigger>
      
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Cloud className="h-5 w-5" />
            Upload para Backblaze B2
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Drop Zone */}
          <div
            className={cn(
              "border-2 border-dashed rounded-lg p-6 text-center transition-colors",
              isDragOver ? "border-primary bg-primary/5" : "border-muted-foreground/25"
            )}
            onDrop={handleDrop}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragOver(true);
            }}
            onDragLeave={() => setIsDragOver(false)}
          >
            <Cloud className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm text-muted-foreground mb-2">
              Arraste arquivos aqui ou clique para selecionar
            </p>
            <p className="text-xs text-muted-foreground mb-2">
              Arquivos serão enviados para Backblaze B2
            </p>
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
            >
              Selecionar Arquivos
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={handleFileSelect}
            />
          </div>

          {/* File List */}
          {uploadFiles.length > 0 && (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {uploadFiles.map((uploadFile) => (
                <Card key={uploadFile.id} className="p-3">
                  <div className="flex items-center gap-3">
                    {getStatusIcon(uploadFile.status)}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {uploadFile.file.name}
                      </p>
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-muted-foreground">
                          {formatFileSize(uploadFile.file.size)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {getStatusText(uploadFile.status)}
                        </p>
                      </div>
                      {uploadFile.status !== 'pending' && uploadFile.status !== 'completed' && uploadFile.status !== 'error' && (
                        <Progress value={uploadFile.progress} className="h-1 mt-1" />
                      )}
                      {uploadFile.error && (
                        <p className="text-xs text-red-500 mt-1">{uploadFile.error}</p>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => removeFile(uploadFile.id)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}

          {/* Actions */}
          {uploadFiles.length > 0 && (
            <div className="flex gap-2">
              <Button
                onClick={uploadAllFiles}
                disabled={uploadFiles.every(f => f.status !== 'pending')}
                className="flex-1"
              >
                Upload para B2
              </Button>
              <Button
                variant="outline"
                onClick={clearCompleted}
                disabled={!uploadFiles.some(f => f.status === 'completed')}
              >
                Limpar Concluídos
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
