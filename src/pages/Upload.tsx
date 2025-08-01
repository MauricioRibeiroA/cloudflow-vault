// src/pages/Upload.tsx
import React, { useState, useCallback, useEffect } from "react";
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
import { FileUp, FolderPlus, FileText, Folder, Download, Trash2, Cloud, HardDrive, BarChart3 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
// import { FileUpload } from "@/components/ui/file-upload";  // Removido
import { B2FileUpload } from "@/components/ui/b2-file-upload";

interface Folder {
  id: string;
  name: string;
}

interface FileRecord {
  id: string;
  name: string;
  file_path: string;
  file_size: number;
  file_type: string;
  folder_id: string | null;
  created_at: string;
}

interface StorageUsage {
  totalUsageGB: number;
  storageLimitGB: number;
  usagePercentage: number;
}

const UploadFiles: React.FC = () => {
  const { session } = useAuth();
  const accessToken = session?.access_token;
  const { toast } = useToast();

  const [folders, setFolders] = useState<Folder[]>([]);
  const [files, setFiles] = useState<FileRecord[]>([]);
  const [currentFolder, setCurrentFolder] = useState<string | null>(null);
  const [showFolderDialog, setShowFolderDialog] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [storageUsage, setStorageUsage] = useState<StorageUsage | null>(null);

  const fetchFolders = async () => {
    const { data, error } = await supabase.from("folders").select("*").order("name");
    if (!error) setFolders(data || []);
  };

  const fetchFiles = async () => {
    let query = supabase.from("files").select("*").order("created_at", { ascending: false });
    if (currentFolder) query = query.eq("folder_id", currentFolder);
    const { data, error } = await query;
    if (!error) setFiles(data || []);
  };

  const fetchStorageUsage = async () => {
    const { data, error } = await supabase.functions.invoke("list_usage", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!error) setStorageUsage(data as StorageUsage);
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    const { error } = await supabase.from("folders").insert({
      name: newFolderName.trim(),
      parent: currentFolder,
    });
    if (!error) {
      setNewFolderName("");
      setShowFolderDialog(false);
      fetchFolders();
    }
  };

  useEffect(() => {
    if (!accessToken) return;
    fetchFolders();
    fetchFiles();
    fetchStorageUsage();
  }, [currentFolder, accessToken]);

  if (!accessToken) return null;

  return (
    <div className="space-y-6">
      {/* Header & Actions */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Gerenciamento de Arquivos</h1>
          <p className="text-muted-foreground">
            Gerencie arquivos no Supabase Storage e Backblaze B2
          </p>
        </div>
        <div className="flex gap-2">
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
                <DialogDescription>Digite o nome da nova pasta</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 mt-4">
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

          {/* Botão “Upload” do Supabase removido */}
          
          {/* Upload B2 */}
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
              {storageUsage.totalUsageGB.toFixed(2)} GB de{" "}
              {storageUsage.storageLimitGB.toFixed(2)} GB utilizados
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
          </CardContent>
        </Card>
      )}

      {/* Table of Folders and Files */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {currentFolder ? folders.find((f) => f.id === currentFolder)?.name : "Raiz"}
          </CardTitle>
          <CardDescription>Pastas e arquivos nesta localização</CardDescription>
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
                <TableRow key={f.id}>
                  <TableCell><Folder className="h-4 w-4" /></TableCell>
                  <TableCell>{f.name}</TableCell>
                  <TableCell>—</TableCell>
                  <TableCell>—</TableCell>
                  <TableCell className="text-right">{/* ações pasta */}</TableCell>
                </TableRow>
              ))}
              {files.map((file) => (
                <TableRow key={file.id}>
                  <TableCell><FileText className="h-4 w-4" /></TableCell>
                  <TableCell>{file.name}</TableCell>
                  <TableCell>{(file.file_size / 1024).toFixed(2)} KB</TableCell>
                  <TableCell>{file.file_type}</TableCell>
                  <TableCell>{new Date(file.created_at).toLocaleString()}</TableCell>
                  <TableCell className="text-right">{/* ações arquivo */}</TableCell>
                </TableRow>
              ))}
              {folders.length === 0 && files.length === 0 && (
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
