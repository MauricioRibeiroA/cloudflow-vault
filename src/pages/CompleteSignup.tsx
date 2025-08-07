import React, { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Shield, Eye, EyeOff, CheckCircle, AlertCircle } from 'lucide-react'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'

interface PendingUser {
  user_id: string
  full_name: string
  email: string
  group_name: string
  department_name?: string
  position_name?: string
  created_at: string
}

const CompleteSignup = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const email = searchParams.get('email')
  const token = searchParams.get('token')
  
  const [formData, setFormData] = useState({
    email: email || '',
    password: '',
    confirmPassword: ''
  })
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [pendingUser, setPendingUser] = useState<PendingUser | null>(null)
  const [loadingUserInfo, setLoadingUserInfo] = useState(true)

  useEffect(() => {
    if (email) {
      checkPendingUser(email)
    } else {
      setLoadingUserInfo(false)
    }
  }, [email])

  const checkPendingUser = async (userEmail: string) => {
    try {
      // Verificar se existe um perfil pendente para este email
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          user_id,
          full_name,
          email,
          group_name,
          department:departments(name),
          position:positions(name),
          created_at
        `)
        .eq('email', userEmail)
        .eq('status', 'pending_activation')
        .single()

      if (error) {
        if (error.code === 'PGRST116') {
          // Não encontrado
          toast.error('Convite não encontrado ou já foi usado. Verifique o email ou entre em contato com o administrador.')
        } else {
          console.error('Erro ao verificar convite:', error)
          toast.error('Erro ao verificar convite')
        }
        return
      }

      setPendingUser({
        user_id: data.user_id,
        full_name: data.full_name,
        email: data.email,
        group_name: data.group_name,
        department_name: data.department?.name,
        position_name: data.position?.name,
        created_at: data.created_at
      })

    } catch (error) {
      console.error('Erro ao buscar usuário pendente:', error)
      toast.error('Erro ao carregar informações do convite')
    } finally {
      setLoadingUserInfo(false)
    }
  }

  const validatePassword = (password: string) => {
    const minLength = password.length >= 8
    const hasUpper = /[A-Z]/.test(password)
    const hasLower = /[a-z]/.test(password)
    const hasNumber = /\d/.test(password)
    const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password)

    return {
      minLength,
      hasUpper,
      hasLower,
      hasNumber,
      hasSpecial,
      isValid: minLength && hasUpper && hasLower && hasNumber && hasSpecial
    }
  }

  const passwordValidation = validatePassword(formData.password)

  const handleCompleteSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!pendingUser) {
      toast.error('Informações do convite não encontradas')
      return
    }

    if (formData.password !== formData.confirmPassword) {
      toast.error('As senhas não coincidem')
      return
    }

    if (!passwordValidation.isValid) {
      toast.error('A senha não atende aos requisitos mínimos')
      return
    }

    setLoading(true)

    try {
      // Criar conta no Supabase Auth
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            full_name: pendingUser.full_name,
            completing_signup: true
          }
        }
      })

      if (signUpError) {
        console.error('Erro no signup:', signUpError)
        toast.error(signUpError.message || 'Erro ao criar conta')
        return
      }

      if (signUpData.user) {
        // Atualizar o perfil existente com o user_id real
        const { error: updateError } = await supabase
          .from('profiles')
          .update({
            user_id: signUpData.user.id,
            status: 'active',
            updated_at: new Date().toISOString()
          })
          .eq('email', formData.email)
          .eq('status', 'pending_activation')

        if (updateError) {
          console.error('Erro ao atualizar perfil:', updateError)
          toast.error('Erro ao ativar perfil')
          return
        }

        toast.success(
          `Conta criada com sucesso! Seja bem-vindo(a), ${pendingUser.full_name}!`
        )

        // Redirecionar para o dashboard
        setTimeout(() => {
          navigate('/dashboard')
        }, 2000)
      }

    } catch (error: any) {
      console.error('Erro ao completar cadastro:', error)
      toast.error(error.message || 'Erro ao completar cadastro')
    } finally {
      setLoading(false)
    }
  }

  if (loadingUserInfo) {
    return (
      <div className="min-h-screen bg-gradient-surface flex items-center justify-center p-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (!email) {
    return (
      <div className="min-h-screen bg-gradient-surface flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex items-center justify-center mb-4">
              <Shield className="h-12 w-12 text-primary" />
            </div>
            <CardTitle>Link Inválido</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Link de convite inválido ou incompleto. Entre em contato com o administrador da sua empresa.
              </AlertDescription>
            </Alert>
            <Button 
              onClick={() => navigate('/auth')} 
              className="w-full"
            >
              Ir para Login
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!pendingUser) {
    return (
      <div className="min-h-screen bg-gradient-surface flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex items-center justify-center mb-4">
              <Shield className="h-12 w-12 text-primary" />
            </div>
            <CardTitle>Convite Não Encontrado</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Convite não encontrado ou já foi utilizado. Verifique se você está usando o link correto ou entre em contato com o administrador.
              </AlertDescription>
            </Alert>
            <Button 
              onClick={() => navigate('/auth')} 
              className="w-full"
            >
              Ir para Login
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-surface flex items-center justify-center p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <div className="flex items-center justify-center mb-4">
            <Shield className="h-12 w-12 text-primary" />
          </div>
          <CardTitle>Complete Seu Cadastro</CardTitle>
          <CardDescription>
            Finalize sua conta no CloudFlow Vault
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {/* Informações do usuário */}
          <div className="bg-blue-50 dark:bg-blue-950/20 p-4 rounded-lg space-y-2">
            <h3 className="font-semibold text-blue-800 dark:text-blue-200">
              Informações do Convite
            </h3>
            <div className="text-sm space-y-1">
              <p><strong>Nome:</strong> {pendingUser.full_name}</p>
              <p><strong>Email:</strong> {pendingUser.email}</p>
              <p><strong>Função:</strong> {
                pendingUser.group_name === 'company_admin' ? 'Admin da Empresa' :
                pendingUser.group_name === 'hr' ? 'RH' : 'Usuário'
              }</p>
              {pendingUser.department_name && (
                <p><strong>Setor:</strong> {pendingUser.department_name}</p>
              )}
              {pendingUser.position_name && (
                <p><strong>Cargo:</strong> {pendingUser.position_name}</p>
              )}
            </div>
          </div>

          <form onSubmit={handleCompleteSignup} className="space-y-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                disabled
                className="bg-gray-100 dark:bg-gray-800"
              />
            </div>

            <div>
              <Label htmlFor="password">Senha</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="Crie uma senha segura"
                  required
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <div>
              <Label htmlFor="confirmPassword">Confirmar Senha</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                  placeholder="Digite a senha novamente"
                  required
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            {/* Requisitos da senha */}
            {formData.password && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Requisitos da senha:</p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className={`flex items-center gap-1 ${passwordValidation.minLength ? 'text-green-600' : 'text-gray-500'}`}>
                    <CheckCircle className="h-3 w-3" />
                    Mín. 8 caracteres
                  </div>
                  <div className={`flex items-center gap-1 ${passwordValidation.hasUpper ? 'text-green-600' : 'text-gray-500'}`}>
                    <CheckCircle className="h-3 w-3" />
                    Letra maiúscula
                  </div>
                  <div className={`flex items-center gap-1 ${passwordValidation.hasLower ? 'text-green-600' : 'text-gray-500'}`}>
                    <CheckCircle className="h-3 w-3" />
                    Letra minúscula
                  </div>
                  <div className={`flex items-center gap-1 ${passwordValidation.hasNumber ? 'text-green-600' : 'text-gray-500'}`}>
                    <CheckCircle className="h-3 w-3" />
                    Número
                  </div>
                  <div className={`flex items-center gap-1 ${passwordValidation.hasSpecial ? 'text-green-600' : 'text-gray-500'}`}>
                    <CheckCircle className="h-3 w-3" />
                    Caractere especial
                  </div>
                </div>
              </div>
            )}

            {formData.password && formData.confirmPassword && formData.password !== formData.confirmPassword && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  As senhas não coincidem
                </AlertDescription>
              </Alert>
            )}

            <Button 
              type="submit" 
              className="w-full" 
              disabled={loading || !passwordValidation.isValid || formData.password !== formData.confirmPassword}
            >
              {loading ? 'Criando conta...' : 'Completar Cadastro'}
            </Button>
          </form>

          <div className="text-center text-sm text-muted-foreground">
            Já tem uma conta?{' '}
            <Button 
              variant="link" 
              className="p-0 h-auto text-primary"
              onClick={() => navigate('/auth')}
            >
              Fazer login
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default CompleteSignup
