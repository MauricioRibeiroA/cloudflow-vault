import { useState, useEffect } from 'react';
import { useAuth } from '@/components/auth/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { Plus, Building2, Settings, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface Company {
  id: string;
  name: string;
  domain: string;
  status: string;
  created_at: string;
  settings: any;
}

interface Profile {
  group_name: string;
}

const Companies = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    domain: '',
    storage_limit_gb: 10
  });

  useEffect(() => {
    if (user) {
      fetchProfile();
      fetchCompanies();
    }
  }, [user]);

  const fetchProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('group_name')
        .eq('user_id', user?.id)
        .single();

      if (error) throw error;
      setProfile(data);
    } catch (error) {
      console.error('Error fetching profile:', error);
    }
  };

  const fetchCompanies = async () => {
    try {
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCompanies(data || []);
    } catch (error) {
      console.error('Error fetching companies:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar as empresas.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const { error } = await supabase
        .from('companies')
        .insert([{
          name: formData.name,
          domain: formData.domain,
          settings: { storage_limit_gb: formData.storage_limit_gb },
          created_by: user?.id
        }]);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Empresa criada com sucesso!",
      });

      setDialogOpen(false);
      setFormData({ name: '', domain: '', storage_limit_gb: 10 });
      fetchCompanies();
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Não foi possível criar a empresa.",
        variant: "destructive",
      });
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive"> = {
      active: "default",
      inactive: "secondary",
      suspended: "destructive"
    };
    
    return (
      <Badge variant={variants[status] || "secondary"}>
        {status === 'active' ? 'Ativa' : status === 'inactive' ? 'Inativa' : 'Suspensa'}
      </Badge>
    );
  };

  // Redirect if not super admin
  if (!loading && profile?.group_name !== 'super_admin') {
    navigate('/dashboard');
    return null;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Gestão de Empresas</h1>
          <p className="text-muted-foreground">
            Gerencie as empresas clientes do sistema
          </p>
        </div>
        
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="gradient">
              <Plus className="h-4 w-4 mr-2" />
              Nova Empresa
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Criar Nova Empresa</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreateCompany} className="space-y-4">
              <div>
                <Label htmlFor="name">Nome da Empresa</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="domain">Domínio (opcional)</Label>
                <Input
                  id="domain"
                  type="text"
                  placeholder="exemplo.com"
                  value={formData.domain}
                  onChange={(e) => setFormData({ ...formData, domain: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="storage_limit">Limite de Armazenamento (GB)</Label>
                <Input
                  id="storage_limit"
                  type="number"
                  min="1"
                  value={formData.storage_limit_gb}
                  onChange={(e) => setFormData({ ...formData, storage_limit_gb: parseInt(e.target.value) })}
                  required
                />
              </div>
              <div className="flex justify-end space-x-2">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit">Criar Empresa</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Empresas Cadastradas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Domínio</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Limite de Storage</TableHead>
                <TableHead>Data de Criação</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {companies.map((company) => (
                <TableRow key={company.id}>
                  <TableCell className="font-medium">{company.name}</TableCell>
                  <TableCell>{company.domain || '-'}</TableCell>
                  <TableCell>{getStatusBadge(company.status)}</TableCell>
                  <TableCell>{company.settings.storage_limit_gb} GB</TableCell>
                  <TableCell>
                    {new Date(company.created_at).toLocaleDateString('pt-BR')}
                  </TableCell>
                  <TableCell>
                    <div className="flex space-x-2">
                      <Button variant="outline" size="sm">
                        <Settings className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="sm">
                        <Users className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default Companies;