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
import { Plus, Building2, Settings, Users, UserPlus, Copy, ExternalLink } from 'lucide-react';
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
  const [credentialsDialogOpen, setCredentialsDialogOpen] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [createdAdminData, setCreatedAdminData] = useState<{
    email: string;
    password: string;
    fullName: string;
    companyName: string;
  } | null>(null);
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
        // Wait for the trigger to create the profile and then update it
        let profileUpdated = false;
        let attempts = 0;
        const maxAttempts = 5;
        
        while (!profileUpdated && attempts < maxAttempts) {
          attempts++;
          
          // Wait a bit before each attempt
          await new Promise(resolve => setTimeout(resolve, 500));
          
          // Check if profile exists
          const { data: existingProfile } = await supabase
            .from('profiles')
            .select('id')
            .eq('user_id', authData.user.id)
            .single();
            
          if (existingProfile) {
            // Update the profile that was automatically created by the trigger
            const { error: profileError } = await supabase
              .from('profiles')
              .update({
                full_name: adminFormData.full_name,
                company_id: selectedCompany.id,
                group_name: 'company_admin',
                status: 'active'
              })
              .eq('user_id', authData.user.id);
              
            if (profileError) {
              console.error('Profile update error:', profileError);
              throw profileError;
            }
            
            profileUpdated = true;
          }
        }
        
        if (!profileUpdated) {
          throw new Error('Não foi possível atualizar o perfil do usuário após várias tentativas.');
        }

        // Store admin data for credentials display
        setCreatedAdminData({
          email: adminFormData.email,
          password: adminFormData.password,
          fullName: adminFormData.full_name,
          companyName: selectedCompany.name
        });

        toast({
          title: "Sucesso",
          description: `Admin criado com sucesso para ${selectedCompany.name}!`,
        });

        setAdminDialogOpen(false);
        setCredentialsDialogOpen(true);
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

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: "Copiado!",
        description: `${label} copiado para a área de transferência.`,
      });
    } catch (error) {
      toast({
        title: "Erro ao copiar",
        description: "Não foi possível copiar para a área de transferência.",
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

      {/* Credentials Display Modal */}
      <Dialog open={credentialsDialogOpen} onOpenChange={setCredentialsDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-green-600" />
              Admin Criado com Sucesso!
            </DialogTitle>
          </DialogHeader>
          
          {createdAdminData && (
            <div className="space-y-6">
              <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                <p className="text-sm text-green-800 mb-2">
                  <strong>✅ {createdAdminData.fullName}</strong> foi criado como administrador da empresa <strong>{createdAdminData.companyName}</strong>.
                </p>
                <p className="text-xs text-green-700">
                  O admin já pode fazer login usando as credenciais abaixo. Compartilhe-as de forma segura.
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <Label className="text-sm font-medium text-gray-700">Nome Completo</Label>
                  <div className="flex items-center space-x-2 mt-1">
                    <Input 
                      value={createdAdminData.fullName} 
                      readOnly 
                      className="bg-gray-50"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => copyToClipboard(createdAdminData.fullName, 'Nome')}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div>
                  <Label className="text-sm font-medium text-gray-700">Email de Login</Label>
                  <div className="flex items-center space-x-2 mt-1">
                    <Input 
                      value={createdAdminData.email} 
                      readOnly 
                      className="bg-gray-50"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => copyToClipboard(createdAdminData.email, 'Email')}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div>
                  <Label className="text-sm font-medium text-gray-700">Senha Temporária</Label>
                  <div className="flex items-center space-x-2 mt-1">
                    <Input 
                      value={createdAdminData.password} 
                      readOnly 
                      className="bg-gray-50"
                      type="text"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => copyToClipboard(createdAdminData.password, 'Senha')}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div>
                  <Label className="text-sm font-medium text-gray-700">Empresa</Label>
                  <div className="flex items-center space-x-2 mt-1">
                    <Input 
                      value={createdAdminData.companyName} 
                      readOnly 
                      className="bg-gray-50"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => copyToClipboard(createdAdminData.companyName, 'Empresa')}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>

              <div className="bg-amber-50 p-3 rounded-lg border border-amber-200">
                <p className="text-sm text-amber-800">
                  <strong>⚠️ Importante:</strong> Recomende ao admin alterar a senha no primeiro login por segurança.
                </p>
              </div>

              <div className="flex justify-center">
                <Button
                  onClick={() => {
                    setCredentialsDialogOpen(false);
                    setCreatedAdminData(null);
                  }}
                  className="w-full"
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Fechar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Companies;
