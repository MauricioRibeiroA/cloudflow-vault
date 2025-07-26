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

  // Bootstrap functionality removed for security - no longer allowing public super admin creation

  // Redirect if already authenticated
  useEffect(() => {
    if (user) {
      console.log('User authenticated, redirecting to dashboard');
      navigate("/dashboard");
    }
  }, [user, navigate]);


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationErrors({});
    setLoading(true);

    try {
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
                Bem-vindo de volta
              </CardTitle>
              <CardDescription className="text-muted-foreground mt-2">
                Faça login para acessar o CloudFlow Vault
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium">
                  Email
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="Digite seu email"
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
                    placeholder="Digite sua senha"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={`pl-10 pr-10 ${validationErrors.password ? 'border-destructive' : ''}`}
                    required
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
                    Entrando...
                  </div>
                ) : (
                  "Entrar"
                )}
              </Button>

              <div className="text-center">
                <p className="text-sm text-muted-foreground">
                  Não tem uma conta? Entre em contato com o administrador.
                </p>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Auth;