import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';

interface BootstrapCheckProps {
  children: React.ReactNode;
}

export const BootstrapCheck = ({ children }: BootstrapCheckProps) => {
  const [needsBootstrap, setNeedsBootstrap] = useState(false);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    fullName: ''
  });
  const { toast } = useToast();

  useEffect(() => {
    const checkForUsers = async () => {
      try {
        const { count, error } = await supabase
          .from('profiles')
          .select('*', { count: 'exact', head: true });

        if (error) {
          console.error('Error checking for users:', error);
          setNeedsBootstrap(false);
        } else {
          setNeedsBootstrap(count === 0);
        }
      } catch (error) {
        console.error('Error checking for users:', error);
        setNeedsBootstrap(false);
      } finally {
        setLoading(false);
      }
    };

    checkForUsers();
  }, []);

  const handleCreateSuperAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);

    try {
      // First, check if there are any companies
      const { data: companies, error: companiesError } = await supabase
        .from('companies')
        .select('id')
        .limit(1);

      if (companiesError) {
        throw new Error('Failed to check companies');
      }

      let companyId;
      if (!companies || companies.length === 0) {
        // Create default company
        const { data: newCompany, error: createCompanyError } = await supabase
          .from('companies')
          .insert([{
            name: 'Sistema Principal',
            status: 'active'
          }])
          .select()
          .single();

        if (createCompanyError) {
          throw new Error('Failed to create default company');
        }
        companyId = newCompany.id;
      } else {
        companyId = companies[0].id;
      }

      // Create the super admin user using the admin function
      const { error: createError } = await supabase.rpc('admin_create_user', {
        p_email: formData.email,
        p_full_name: formData.fullName,
        p_group_name: 'super_admin',
        p_company_id: companyId
      });

      if (createError) {
        throw new Error(createError.message);
      }

      toast({
        title: 'Super Admin criado com sucesso!',
        description: 'Agora você pode fazer login com as credenciais criadas.',
      });

      setNeedsBootstrap(false);
    } catch (error: any) {
      console.error('Error creating super admin:', error);
      toast({
        title: 'Erro ao criar Super Admin',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-surface flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Verificando sistema...</p>
        </div>
      </div>
    );
  }

  if (!needsBootstrap) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-gradient-surface flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle>Configuração Inicial do Sistema</CardTitle>
          <CardDescription>
            Nenhum usuário encontrado no sistema. Crie o primeiro Super Admin para começar.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreateSuperAdmin} className="space-y-4">
            <div>
              <Label htmlFor="fullName">Nome Completo</Label>
              <Input
                id="fullName"
                type="text"
                value={formData.fullName}
                onChange={(e) => setFormData(prev => ({ ...prev, fullName: e.target.value }))}
                required
                placeholder="Digite o nome completo"
              />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                required
                placeholder="Digite o email do administrador"
              />
            </div>
            <div>
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                value={formData.password}
                onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                required
                placeholder="Digite uma senha segura"
                minLength={6}
              />
            </div>
            <Button 
              type="submit" 
              className="w-full" 
              disabled={creating}
            >
              {creating ? 'Criando...' : 'Criar Super Admin'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};