import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from '@/integrations/supabase/client';
import { toast } from "@/hooks/use-toast";
import { Eye, EyeOff, Lock, Mail, AlertCircle } from "lucide-react";
import { useAuth } from "@/components/auth/AuthContext";
import { loginSchema } from "@/lib/validation";

const Auth = () => {
  const navigate = useNavigate();
  const { signIn, user } = useAuth();
  
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [needsBootstrap, setNeedsBootstrap] = useState(false);
  const [checkingBootstrap, setCheckingBootstrap] = useState(true);
  const [fullName, setFullName] = useState("");

  // Check if system needs bootstrap
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
        setCheckingBootstrap(false);
      }
    };

    checkForUsers();
  }, []);

  // Redirect if already authenticated
  useEffect(() => {
    if (user && !checkingBootstrap) {
      console.log('User authenticated, redirecting to dashboard');
      navigate("/dashboard");
    }
  }, [user, checkingBootstrap, navigate]);

  if (checkingBootstrap) {
    return (
      <div className="min-h-screen bg-gradient-surface flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Verificando sistema...</p>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationErrors({});
    setLoading(true);

    try {
      if (needsBootstrap) {
        await handleCreateSuperAdmin();
      } else {
        // Validate form data
        const formData = { email, password };
        const validationResult = loginSchema.safeParse(formData);
        
        if (!validationResult.success) {
          const errors: Record<string, string> = {};
          validationResult.error.issues.forEach((error) => {
            if (error.path.length > 0) {
              errors[error.path[0] as string] = error.message;
            }
          });
          setValidationErrors(errors);
          setLoading(false);
          return;
        }

        const { error } = await signIn(email, password);
        if (error) {
          toast({
            title: "Erro no login",
            description: "Email ou senha incorretos. Tente novamente.",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Login realizado com sucesso!",
            description: "Bem-vindo ao CloudFlow Vault.",
          });
          navigate("/dashboard");
        }
      }
    } catch (error) {
      toast({
        title: "Erro inesperado",
        description: "Ocorreu um erro durante a autenticação.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSuperAdmin = async () => {
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
        p_email: email,
        p_full_name: fullName,
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
      throw error;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-surface flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Card className="shadow-elegant border-0">
          <CardHeader className="text-center space-y-4">
            <div className="mx-auto w-16 h-16 bg-gradient-primary rounded-2xl flex items-center justify-center">
              <Lock className="h-8 w-8 text-white" />
            </div>
            <div>
              <CardTitle className="text-2xl font-bold text-foreground">
                {needsBootstrap ? 'Configuração Inicial' : 'Bem-vindo de volta'}
              </CardTitle>
              <CardDescription className="text-muted-foreground mt-2">
                {needsBootstrap 
                  ? 'Nenhum usuário encontrado. Crie o primeiro Super Admin para começar.'
                  : 'Faça login para acessar o CloudFlow Vault'
                }
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {needsBootstrap && (
                <div className="space-y-2">
                  <Label htmlFor="fullName" className="text-sm font-medium">
                    Nome Completo
                  </Label>
                  <Input
                    id="fullName"
                    type="text"
                    placeholder="Digite o nome completo"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                  />
                </div>
              )}
              
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium">
                  Email
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                  <Input
                    id="email"
                    type="email"
                    placeholder={needsBootstrap ? "Digite o email do administrador" : "Digite seu email"}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={`pl-10 ${validationErrors.email ? 'border-destructive' : ''}`}
                    required
                  />
                  {validationErrors.email && (
                    <div className="flex items-center gap-2 text-sm text-destructive mt-1">
                      <AlertCircle className="h-4 w-4" />
                      {validationErrors.email}
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium">
                  Senha
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder={needsBootstrap ? "Digite uma senha segura" : "Digite sua senha"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={`pl-10 pr-10 ${validationErrors.password ? 'border-destructive' : ''}`}
                    required
                    minLength={needsBootstrap ? 6 : undefined}
                  />
                  {validationErrors.password && (
                    <div className="flex items-center gap-2 text-sm text-destructive mt-1">
                      <AlertCircle className="h-4 w-4" />
                      {validationErrors.password}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={loading}
                variant="gradient"
              >
                {loading ? (
                  <div className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    {needsBootstrap ? 'Criando...' : 'Entrando...'}
                  </div>
                ) : (
                  needsBootstrap ? "Criar Super Admin" : "Entrar"
                )}
              </Button>

              {!needsBootstrap && (
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">
                    Não tem uma conta? Entre em contato com o administrador.
                  </p>
                </div>
              )}
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Auth;