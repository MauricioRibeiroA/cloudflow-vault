import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import { toast } from "@/hooks/use-toast";
import { Eye, EyeOff, Lock, Mail, User, AlertCircle } from "lucide-react";
import { useAuth } from "@/components/auth/AuthContext";
import { loginSchema, signUpSchema, type LoginFormData, type SignUpFormData } from "@/lib/validation";

const Auth = () => {
  const navigate = useNavigate();
  const { signIn, signUp } = useAuth();
  
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // Redirect if already authenticated
  const { user } = useAuth();
  if (user && !loading) {
    navigate("/dashboard");
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationErrors({});
    setLoading(true);

    try {
      // Validate form data
      const formData = isLogin ? { email, password } : { email, password, fullName };
      const schema = isLogin ? loginSchema : signUpSchema;
      
      const validationResult = schema.safeParse(formData);
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

      if (isLogin) {
        const { error } = await signIn(email, password);
        if (error) {
          // Generic error message for security
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
      } else {
        const { error } = await signUp(email, password, fullName);
        if (error) {
          // More specific error handling for signup
          let errorMessage = "Ocorreu um erro durante o cadastro.";
          if (error.message.includes("already registered")) {
            errorMessage = "Este email já está cadastrado. Tente fazer login.";
          } else if (error.message.includes("Password")) {
            errorMessage = "A senha não atende aos requisitos de segurança.";
          }
          
          toast({
            title: "Erro no cadastro",
            description: errorMessage,
            variant: "destructive",
          });
        } else {
          toast({
            title: "Cadastro realizado com sucesso!",
            description: "Verifique seu email para confirmar a conta.",
          });
          setIsLogin(true);
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
                {isLogin ? "Bem-vindo de volta" : "Criar conta"}
              </CardTitle>
              <CardDescription className="text-muted-foreground mt-2">
                {isLogin
                  ? "Faça login para acessar o CloudFlow Vault"
                  : "Crie sua conta para começar a usar o sistema"}
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {!isLogin && (
                <div className="space-y-2">
                  <Label htmlFor="fullName" className="text-sm font-medium">
                    Nome Completo
                  </Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                    <Input
                      id="fullName"
                      type="text"
                      placeholder="Digite seu nome completo"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className={`pl-10 ${validationErrors.fullName ? 'border-destructive' : ''}`}
                      required
                    />
                    {validationErrors.fullName && (
                      <div className="flex items-center gap-2 text-sm text-destructive mt-1">
                        <AlertCircle className="h-4 w-4" />
                        {validationErrors.fullName}
                      </div>
                    )}
                  </div>
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
                    placeholder={isLogin ? "Digite sua senha" : "Crie uma senha segura"}
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


              {!isLogin && (
                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground">
                    Requisitos da senha:
                  </Label>
                  <ul className="text-xs text-muted-foreground space-y-1">
                    <li>• Mínimo de 8 caracteres</li>
                    <li>• Pelo menos uma letra maiúscula</li>
                    <li>• Pelo menos uma letra minúscula</li>
                    <li>• Pelo menos um número</li>
                    <li>• Pelo menos um caractere especial</li>
                  </ul>
                </div>
              )}

              <Button
                type="submit"
                className="w-full"
                disabled={loading}
                variant="gradient"
              >
                {loading ? (
                  <div className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    {isLogin ? "Entrando..." : "Criando conta..."}
                  </div>
                ) : (
                  isLogin ? "Entrar" : "Criar conta"
                )}
              </Button>

              <div className="text-center">
                <button
                  type="button"
                  onClick={() => {
                    setIsLogin(!isLogin);
                    setValidationErrors({});
                  }}
                  className="text-primary hover:text-primary/80 text-sm font-medium transition-colors"
                >
                  {isLogin ? "Não tem uma conta? Cadastre-se" : "Já tem uma conta? Faça login"}
                </button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Auth;