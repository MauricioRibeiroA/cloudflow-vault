import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/components/auth/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { Eye, EyeOff, Shield, Users, FileText } from 'lucide-react';

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    fullName: '',
    groupName: 'user'
  });

  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await signIn(formData.email, formData.password);
        if (error) {
          toast({
            title: "Erro no login",
            description: error.message,
            variant: "destructive"
          });
        } else {
          toast({
            title: "Login realizado com sucesso!",
            description: "Redirecionando para o dashboard...",
            variant: "default"
          });
          navigate('/dashboard');
        }
      } else {
        if (formData.password !== formData.confirmPassword) {
          toast({
            title: "Erro no cadastro",
            description: "As senhas não coincidem",
            variant: "destructive"
          });
          return;
        }

        const { error } = await signUp(
          formData.email,
          formData.password,
          formData.fullName,
          formData.groupName
        );

        if (error) {
          toast({
            title: "Erro no cadastro",
            description: error.message,
            variant: "destructive"
          });
        } else {
          toast({
            title: "Cadastro realizado com sucesso!",
            description: "Verifique seu email e faça login.",
            variant: "default"
          });
          setIsLogin(true);
        }
      }
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-surface flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 text-2xl font-bold text-primary mb-2">
            <Shield className="h-8 w-8" />
            CloudFlow Vault
          </div>
          <p className="text-muted-foreground">
            Sistema de gestão de arquivos corporativo
          </p>
        </div>

        <Card className="shadow-medium">
          <CardHeader className="text-center">
            <CardTitle className="text-xl">
              {isLogin ? 'Fazer Login' : 'Criar Conta'}
            </CardTitle>
            <CardDescription>
              {isLogin 
                ? 'Acesse sua conta para gerenciar arquivos'
                : 'Crie uma conta para começar a usar o sistema'
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {!isLogin && (
                <div className="space-y-2">
                  <Label htmlFor="fullName">Nome Completo</Label>
                  <Input
                    id="fullName"
                    type="text"
                    placeholder="Seu nome completo"
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    required
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="seu@email.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Sua senha"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    required
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff /> : <Eye />}
                  </Button>
                </div>
              </div>

              {!isLogin && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirmar Senha</Label>
                    <div className="relative">
                      <Input
                        id="confirmPassword"
                        type={showConfirmPassword ? "text" : "password"}
                        placeholder="Confirme sua senha"
                        value={formData.confirmPassword}
                        onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                        required
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      >
                        {showConfirmPassword ? <EyeOff /> : <Eye />}
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="group">Grupo</Label>
                    <Select
                      value={formData.groupName}
                      onValueChange={(value) => setFormData({ ...formData, groupName: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione seu grupo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="user">
                          <div className="flex items-center gap-2">
                            <Users className="h-4 w-4" />
                            Usuário
                          </div>
                        </SelectItem>
                        <SelectItem value="financeiro">
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4" />
                            Financeiro
                          </div>
                        </SelectItem>
                        <SelectItem value="rh">
                          <div className="flex items-center gap-2">
                            <Users className="h-4 w-4" />
                            RH
                          </div>
                        </SelectItem>
                        <SelectItem value="ti">
                          <div className="flex items-center gap-2">
                            <Shield className="h-4 w-4" />
                            TI
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}

              <Button
                type="submit"
                className="w-full"
                variant="gradient"
                disabled={loading}
              >
                {loading ? "Carregando..." : (isLogin ? "Entrar" : "Criar Conta")}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <Button
                variant="ghost"
                onClick={() => setIsLogin(!isLogin)}
                className="text-sm"
              >
                {isLogin ? (
                  <>Não tem uma conta? <span className="text-primary ml-1">Cadastre-se</span></>
                ) : (
                  <>Já tem uma conta? <span className="text-primary ml-1">Fazer login</span></>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Auth;