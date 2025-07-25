import { useState, useEffect } from 'react';
import { useAuth } from '@/components/auth/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/hooks/use-toast';
import { 
  Search, 
  Upload, 
  Folder, 
  File, 
  Grid3x3, 
  List, 
  Download, 
  Trash2, 
  Eye,
  Settings,
  LogOut,
  Shield,
  Plus
} from 'lucide-react';

interface Profile {
  id: string;
  full_name: string;
  email: string;
  group_name: string;
  status: string;
}

interface Folder {
  id: string;
  name: string;
  parent_id: string | null;
  created_at: string;
  created_by: string;
}

interface FileItem {
  id: string;
  name: string;
  file_size: number;
  file_type: string;
  created_at: string;
  uploaded_by: string;
}

const Dashboard = () => {
  const { user, signOut } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [currentFolder, setCurrentFolder] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchProfile();
      fetchFolders();
      fetchFiles();
    }
  }, [user, currentFolder]);

  const fetchProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user?.id)
        .single();

      if (error) throw error;
      setProfile(data);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar perfil",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const fetchFolders = async () => {
    try {
      const { data, error } = await supabase
        .from('folders')
        .select('*')
        .eq('parent_id', currentFolder)
        .order('name');

      if (error) throw error;
      setFolders(data || []);
    } catch (error: any) {
      console.error('Error fetching folders:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchFiles = async () => {
    try {
      const { data, error } = await supabase
        .from('files')
        .select('*')
        .eq('folder_id', currentFolder)
        .order('name');

      if (error) throw error;
      setFiles(data || []);
    } catch (error: any) {
      console.error('Error fetching files:', error);
    }
  };

  const handleLogout = async () => {
    await signOut();
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const filteredFolders = folders.filter(folder =>
    folder.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredFiles = files.filter(file =>
    file.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-surface flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-surface">
      {/* Header */}
      <header className="bg-card shadow-soft border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <Shield className="h-8 w-8 text-primary" />
              <h1 className="text-xl font-bold text-foreground">CloudFlow Vault</h1>
            </div>
            
            <div className="flex items-center gap-4">
              {profile && (
                <div className="text-right">
                  <p className="text-sm font-medium text-foreground">{profile.full_name}</p>
                  <Badge variant="secondary" className="text-xs">
                    {profile.group_name.toUpperCase()}
                  </Badge>
                </div>
              )}
              
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon">
                  <Settings className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={handleLogout}>
                  <LogOut className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Search and Controls */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Buscar arquivos e pastas..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => setViewMode('grid')}>
              <Grid3x3 className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={() => setViewMode('list')}>
              <List className="h-4 w-4" />
            </Button>
            <Button variant="default" className="flex items-center gap-2">
              <Upload className="h-4 w-4" />
              Upload
            </Button>
            <Button variant="outline" className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Nova Pasta
            </Button>
          </div>
        </div>

        {/* Breadcrumb */}
        {currentFolder && (
          <nav className="flex items-center gap-2 mb-6 text-sm text-muted-foreground">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCurrentFolder(null)}
              className="text-primary"
            >
              Início
            </Button>
            <span>/</span>
            <span>Pasta Atual</span>
          </nav>
        )}

        {/* Content */}
        <Tabs defaultValue="files" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="files">Arquivos e Pastas</TabsTrigger>
            <TabsTrigger value="recent">Recentes</TabsTrigger>
          </TabsList>
          
          <TabsContent value="files" className="space-y-6">
            {/* Folders */}
            {filteredFolders.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <Folder className="h-5 w-5 text-primary" />
                  Pastas
                </h3>
                <div className={viewMode === 'grid' ? 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4' : 'space-y-2'}>
                  {filteredFolders.map((folder) => (
                    <Card
                      key={folder.id}
                      className="cursor-pointer hover:shadow-medium transition-all duration-200 border-l-4 border-l-primary"
                      onClick={() => setCurrentFolder(folder.id)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                          <Folder className="h-8 w-8 text-primary" />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{folder.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(folder.created_at).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Files */}
            {filteredFiles.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <File className="h-5 w-5 text-primary" />
                  Arquivos
                </h3>
                <div className={viewMode === 'grid' ? 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4' : 'space-y-2'}>
                  {filteredFiles.map((file) => (
                    <Card key={file.id} className="hover:shadow-medium transition-all duration-200">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                          <File className="h-8 w-8 text-muted-foreground" />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{file.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {formatFileSize(file.file_size)}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(file.created_at).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 mt-3">
                          <Button size="icon" variant="ghost" className="h-8 w-8">
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-8 w-8">
                            <Download className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Empty State */}
            {filteredFolders.length === 0 && filteredFiles.length === 0 && (
              <Card className="text-center py-12">
                <CardContent>
                  <Folder className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                  <CardTitle className="mb-2">Nenhum arquivo encontrado</CardTitle>
                  <CardDescription className="mb-6">
                    {searchTerm ? 'Nenhum resultado para sua busca.' : 'Esta pasta está vazia. Faça upload de arquivos ou crie novas pastas.'}
                  </CardDescription>
                  <div className="flex items-center justify-center gap-2">
                    <Button variant="default" className="flex items-center gap-2">
                      <Upload className="h-4 w-4" />
                      Fazer Upload
                    </Button>
                    <Button variant="outline" className="flex items-center gap-2">
                      <Plus className="h-4 w-4" />
                      Nova Pasta
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
          
          <TabsContent value="recent">
            <Card>
              <CardHeader>
                <CardTitle>Arquivos Recentes</CardTitle>
                <CardDescription>
                  Seus arquivos mais recentemente acessados
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">Em desenvolvimento...</p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Dashboard;