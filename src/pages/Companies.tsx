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
import { Plus, Building2, Settings, Users, UserPlus } from 'lucide-react';
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
  const [adminDialogOpen, setAdminDialogOpen] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    domain: '',
    storage_limit_gb: 10
  });
  const [adminFormData, setAdminFormData] = useState({
    full_name: '',
    email: '',
    password: ''
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

  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedCompany) return;

    try {
      // Create user in Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: adminFormData.email,
        password: adminFormData.password,
      });

      if (authError) throw authError;

      if (authData.user) {
        // Create profile for the new admin
        const { error: profileError } = await supabase
          .from('profiles')
          .insert({
            user_id: authData.user.id,
            email: adminFormData.email,
            full_name: adminFormData.full_name,
            company_id: selectedCompany.id,
            group_name: 'company_admin',
            status: 'active'
          });

        if (profileError) throw profileError;

        toast({
          title: "Sucesso",
          description: `Admin criado com sucesso para ${selectedCompany.name}!`,
        });

        setAdminDialogOpen(false);
        setAdminFormData({ full_name: '', email: '', password: '' });
        setSelectedCompany(null);
      }
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Não foi possível criar o admin.",
        variant: "destructive",
      });
    }
  };

  const handleOpenAdminDialog = (company: Company) => {
    setSelectedCompany(company);
    setAdminDialogOpen(true);
  };

  const handleOpenCompanyDetails = (companyId: string) => {
    navigate(`/companies/${companyId}`);
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
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleOpenCompanyDetails(company.id)}
                        title="Ver detalhes da empresa"
                      >
                        <Settings className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleOpenAdminDialog(company)}
                        title="Criar admin para empresa"
                      >
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

      {/* Admin Creation Modal */}
      <Dialog open={adminDialogOpen} onOpenChange={setAdminDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Criar Admin para {selectedCompany?.name}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateAdmin} className="space-y-4">
            <div>
              <Label htmlFor="admin_name">Nome Completo</Label>
              <Input
                id="admin_name"
                value={adminFormData.full_name}
                onChange={(e) => setAdminFormData({ ...adminFormData, full_name: e.target.value })}
                required
                placeholder="Nome do administrador"
              />
            </div>
            <div>
              <Label htmlFor="admin_email">Email</Label>
              <Input
                id="admin_email"
                type="email"
                value={adminFormData.email}
                onChange={(e) => setAdminFormData({ ...adminFormData, email: e.target.value })}
                required
                placeholder="email@exemplo.com"
              />
            </div>
            <div>
              <Label htmlFor="admin_password">Senha Temporária</Label>
              <Input
                id="admin_password"
                type="password"
                value={adminFormData.password}
                onChange={(e) => setAdminFormData({ ...adminFormData, password: e.target.value })}
                required
                placeholder="Senha que o admin usará para fazer login"
                minLength={6}
              />
            </div>
            <div className="bg-blue-50 p-3 rounded-lg">
              <p className="text-sm text-blue-700">
                <strong>💡 Dica:</strong> O admin criado terá acesso total à empresa {selectedCompany?.name}.
                Compartilhe as credenciais de forma segura com a pessoa responsável.
              </p>
            </div>
            <div className="flex justify-end space-x-2">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => {
                  setAdminDialogOpen(false);
                  setAdminFormData({ full_name: '', email: '', password: '' });
                  setSelectedCompany(null);
                }}
              >
                Cancelar
              </Button>
              <Button type="submit">
                <UserPlus className="h-4 w-4 mr-2" />
                Criar Admin
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Companies;
