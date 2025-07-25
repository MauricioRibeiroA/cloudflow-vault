import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/auth/AuthContext';
import { toast } from '@/hooks/use-toast';
import { Plus, Folder } from 'lucide-react';

interface FolderCreateProps {
  currentFolder: string | null;
  onFolderCreated: () => void;
}

export function FolderCreate({ currentFolder, onFolderCreated }: FolderCreateProps) {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [folderName, setFolderName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const validateFolderName = (name: string): string | null => {
    if (!name.trim()) {
      return 'Nome da pasta é obrigatório';
    }
    
    if (name.length < 2) {
      return 'Nome deve ter pelo menos 2 caracteres';
    }
    
    if (name.length > 100) {
      return 'Nome não pode exceder 100 caracteres';
    }
    
    // Check for invalid characters
    const invalidChars = /[<>:"/\\|?*]/;
    if (invalidChars.test(name)) {
      return 'Nome contém caracteres inválidos';
    }
    
    // Check for reserved names
    const reservedNames = ['CON', 'PRN', 'AUX', 'NUL', 'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9', 'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'];
    if (reservedNames.includes(name.toUpperCase())) {
      return 'Nome de pasta reservado pelo sistema';
    }
    
    return null;
  };

  const createFolder = async () => {
    if (!user) return;

    const trimmedName = folderName.trim();
    const validationError = validateFolderName(trimmedName);
    
    if (validationError) {
      toast({
        title: "Nome inválido",
        description: validationError,
        variant: "destructive"
      });
      return;
    }

    setIsCreating(true);

    try {
      // Check if folder with same name already exists in current location
      const { data: existingFolders, error: checkError } = await supabase
        .from('folders')
        .select('name')
        .eq('parent_id', currentFolder)
        .eq('name', trimmedName);

      if (checkError) throw checkError;

      if (existingFolders && existingFolders.length > 0) {
        toast({
          title: "Pasta já existe",
          description: `Uma pasta com o nome "${trimmedName}" já existe neste local.`,
          variant: "destructive"
        });
        return;
      }

      // Create the folder
      const { data: folderData, error: createError } = await supabase
        .from('folders')
        .insert({
          name: trimmedName,
          parent_id: currentFolder,
          created_by: user.id
        })
        .select()
        .single();

      if (createError) throw createError;

      // Log the folder creation
      await supabase
        .from('logs')
        .insert({
          user_id: user.id,
          action: 'folder_create',
          target_type: 'folder',
          target_id: folderData.id,
          target_name: trimmedName,
          details: {
            parent_id: currentFolder
          }
        });

      toast({
        title: "Pasta criada",
        description: `A pasta "${trimmedName}" foi criada com sucesso.`
      });

      // Reset form and close dialog
      setFolderName('');
      setIsOpen(false);
      onFolderCreated();

    } catch (error: any) {
      console.error('Create folder error:', error);
      toast({
        title: "Erro ao criar pasta",
        description: error.message || "Falha ao criar a pasta. Tente novamente.",
        variant: "destructive"
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createFolder();
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Nova Pasta
        </Button>
      </DialogTrigger>
      
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Folder className="h-5 w-5 text-primary" />
            Criar Nova Pasta
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="folder-name">Nome da Pasta</Label>
            <Input
              id="folder-name"
              value={folderName}
              onChange={(e) => setFolderName(e.target.value)}
              placeholder="Digite o nome da pasta..."
              maxLength={100}
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              O nome não pode conter: &lt; &gt; : " / \ | ? *
            </p>
          </div>
          
          <div className="flex gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsOpen(false)}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isCreating || !folderName.trim()}
              className="flex-1"
            >
              {isCreating ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent mr-2" />
                  Criando...
                </>
              ) : (
                'Criar Pasta'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}