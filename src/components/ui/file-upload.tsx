import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/auth/AuthContext';
import { toast } from '@/hooks/use-toast';
import { Upload, X, File, CheckCircle, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FileUploadProps {
  currentFolder: string | null;
  onUploadComplete: () => void;
}

interface UploadFile {
  file: File;
  id: string;
  progress: number;
  status: 'pending' | 'uploading' | 'completed' | 'error';
  error?: string;
}

export function FileUpload({ currentFolder, onUploadComplete }: FileUploadProps) {
  const { user } = useAuth();
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
    if (!user) return;

    setUploadFiles(prev => 
      prev.map(f => f.id === uploadFile.id ? { ...f, status: 'uploading' as const } : f)
    );

    try {
      // Get user's company_id
      const { data: companyIdData, error: companyIdError } = await supabase
        .rpc('get_user_company_id', { user_id: user.id });
      
      if (companyIdError) throw companyIdError;
      const companyId = companyIdData;

      // Create file path
      const timestamp = Date.now();
      const filename = `${timestamp}-${uploadFile.file.name}`;
      const filePath = currentFolder ? `${currentFolder}/${filename}` : filename;

      // Upload to Supabase Storage
      const { data: storageData, error: storageError } = await supabase.storage
        .from('files')
        .upload(filePath, uploadFile.file, {
          cacheControl: '3600',
          upsert: false
        });

      if (storageError) throw storageError;

      // Save file metadata to database
      const { error: dbError } = await supabase
        .from('files')
        .insert({
          name: uploadFile.file.name,
          file_path: storageData.path,
          file_size: uploadFile.file.size,
          file_type: uploadFile.file.type || 'application/octet-stream',
          folder_id: currentFolder,
          uploaded_by: user.id,
          company_id: companyId
        });

      if (dbError) throw dbError;

      // Log the upload action
      await supabase
        .from('logs')
        .insert({
          user_id: user.id,
          company_id: companyId,
          action: 'file_upload',
          target_type: 'file',
          target_name: uploadFile.file.name,
          details: {
            file_size: uploadFile.file.size,
            file_type: uploadFile.file.type,
            folder_id: currentFolder
          }
        });

      setUploadFiles(prev => 
        prev.map(f => f.id === uploadFile.id ? { ...f, status: 'completed' as const, progress: 100 } : f)
      );

      toast({
        title: "Upload concluído",
        description: `${uploadFile.file.name} foi enviado com sucesso.`
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
      case 'uploading':
        return <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />;
      default:
        return <File className="h-4 w-4 text-muted-foreground" />;
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
          <Upload className="h-4 w-4" />
          Upload
        </Button>
      </DialogTrigger>
      
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Upload de Arquivos</DialogTitle>
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
            <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm text-muted-foreground mb-2">
              Arraste arquivos aqui ou clique para selecionar
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
                      <p className="text-xs text-muted-foreground">
                        {formatFileSize(uploadFile.file.size)}
                      </p>
                      {uploadFile.status === 'uploading' && (
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
                Fazer Upload
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