import React, { useState } from 'react';
import { supabase } from '../integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertCircle, Building2, User, MapPin, Phone, Mail, FileText } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface FormData {
  // Dados da empresa
  companyName: string;
  cnpj: string;
  razaoSocial: string;
  inscricaoEstadual: string;
  setor: string;
  porte: string;
  
  // Endereço
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  estado: string;
  telefoneEmpresa: string;
  
  // Dados do administrador
  adminName: string;
  adminEmail: string;
  adminCpf: string;
  adminTelefone: string;
  adminCargo: string;
  adminPassword: string;
  confirmPassword: string;
}

const CompanySignup: React.FC = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  const [formData, setFormData] = useState<FormData>({
    companyName: '',
    cnpj: '',
    razaoSocial: '',
    inscricaoEstadual: '',
    setor: '',
    porte: '',
    cep: '',
    logradouro: '',
    numero: '',
    complemento: '',
    bairro: '',
    cidade: '',
    estado: '',
    telefoneEmpresa: '',
    adminName: '',
    adminEmail: '',
    adminCpf: '',
    adminTelefone: '',
    adminCargo: '',
    adminPassword: '',
    confirmPassword: ''
  });

  const handleInputChange = (field: keyof FormData, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    setError(''); // Limpar erro ao digitar
  };

  // Função para formatar CNPJ
  const formatCnpj = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    return numbers.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  };

  // Função para formatar CPF
  const formatCpf = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    return numbers.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  };

  // Função para formatar CEP
  const formatCep = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    return numbers.replace(/(\d{5})(\d{3})/, '$1-$2');
  };

  // Função para formatar telefone
  const formatPhone = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 10) {
      return numbers.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
    }
    return numbers.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
  };

  // Buscar endereço pelo CEP
  const fetchAddressByCep = async (cep: string) => {
    const cleanCep = cep.replace(/\D/g, '');
    if (cleanCep.length === 8) {
      try {
        const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
        const data = await response.json();
        
        if (!data.erro) {
          setFormData(prev => ({
            ...prev,
            logradouro: data.logradouro || '',
            bairro: data.bairro || '',
            cidade: data.localidade || '',
            estado: data.uf || ''
          }));
        }
      } catch (error) {
        console.log('Erro ao buscar CEP:', error);
      }
    }
  };

  // Validação dos dados
  const validateStep = (currentStep: number): boolean => {
    setError('');
    
    if (currentStep === 1) {
      // Validar dados da empresa
      if (!formData.companyName.trim()) {
        setError('Nome da empresa é obrigatório');
        return false;
      }
      if (!formData.cnpj.trim()) {
        setError('CNPJ é obrigatório');
        return false;
      }
      if (formData.cnpj.replace(/\D/g, '').length !== 14) {
        setError('CNPJ deve ter 14 dígitos');
        return false;
      }
      if (!formData.porte) {
        setError('Porte da empresa é obrigatório');
        return false;
      }
    }
    
    if (currentStep === 2) {
      // Validar endereço
      if (!formData.cep.trim()) {
        setError('CEP é obrigatório');
        return false;
      }
      if (!formData.logradouro.trim()) {
        setError('Logradouro é obrigatório');
        return false;
      }
      if (!formData.numero.trim()) {
        setError('Número é obrigatório');
        return false;
      }
      if (!formData.cidade.trim()) {
        setError('Cidade é obrigatória');
        return false;
      }
      if (!formData.estado.trim()) {
        setError('Estado é obrigatório');
        return false;
      }
    }
    
    if (currentStep === 3) {
      // Validar dados do administrador
      if (!formData.adminName.trim()) {
        setError('Nome do administrador é obrigatório');
        return false;
      }
      if (!formData.adminEmail.trim()) {
        setError('E-mail é obrigatório');
        return false;
      }
      if (!formData.adminEmail.includes('@')) {
        setError('E-mail deve ter formato válido');
        return false;
      }
      if (!formData.adminCpf.trim()) {
        setError('CPF é obrigatório');
        return false;
      }
      if (formData.adminCpf.replace(/\D/g, '').length !== 11) {
        setError('CPF deve ter 11 dígitos');
        return false;
      }
      if (!formData.adminCargo.trim()) {
        setError('Cargo é obrigatório');
        return false;
      }
      if (!formData.adminPassword.trim()) {
        setError('Senha é obrigatória');
        return false;
      }
      if (formData.adminPassword.length < 6) {
        setError('Senha deve ter pelo menos 6 caracteres');
        return false;
      }
      if (formData.adminPassword !== formData.confirmPassword) {
        setError('Senhas não coincidem');
        return false;
      }
    }
    
    return true;
  };

  // Avançar para próximo step
  const nextStep = () => {
    if (validateStep(step)) {
      if (step < 3) {
        setStep(step + 1);
      }
    }
  };

  // Voltar step anterior
  const prevStep = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  // Submeter formulário
  const handleSubmit = async () => {
    if (!validateStep(3)) return;

    try {
      setLoading(true);
      setError('');

      // 1. Registrar empresa no banco
      const { data: registrationResult, error: registrationError } = await supabase.rpc('register_company_with_trial', {
        p_company_name: formData.companyName,
        p_cnpj: formData.cnpj,
        p_razao_social: formData.razaoSocial || formData.companyName,
        p_inscricao_estadual: formData.inscricaoEstadual || null,
        p_setor: formData.setor || null,
        p_porte: formData.porte,
        p_cep: formData.cep,
        p_logradouro: formData.logradouro,
        p_numero: formData.numero,
        p_complemento: formData.complemento || null,
        p_bairro: formData.bairro,
        p_cidade: formData.cidade,
        p_estado: formData.estado,
        p_telefone_empresa: formData.telefoneEmpresa || null,
        p_admin_name: formData.adminName,
        p_admin_email: formData.adminEmail,
        p_admin_cpf: formData.adminCpf,
        p_admin_telefone: formData.adminTelefone || null,
        p_admin_cargo: formData.adminCargo
      });

      if (registrationError) {
        setError(`Erro ao registrar empresa: ${registrationError.message}`);
        return;
      }

      if (!registrationResult?.success) {
        setError(registrationResult?.error || 'Erro desconhecido');
        return;
      }

      // 2. Criar usuário no Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.adminEmail,
        password: formData.adminPassword,
        options: {
          data: {
            full_name: formData.adminName,
            company_id: registrationResult.company_id,
            company_name: formData.companyName
          }
        }
      });

      if (authError) {
        setError(`Erro ao criar conta: ${authError.message}`);
        return;
      }

      if (authData.user) {
        // 3. Finalizar registro do perfil
        const { data: completionResult, error: completionError } = await supabase.rpc('complete_company_registration', {
          p_company_id: registrationResult.company_id,
          p_user_id: authData.user.id,
          p_admin_name: formData.adminName,
          p_admin_cpf: formData.adminCpf,
          p_admin_telefone: formData.adminTelefone || null,
          p_admin_cargo: formData.adminCargo
        });

        if (completionError) {
          setError(`Erro ao finalizar cadastro: ${completionError.message}`);
          return;
        }

        setSuccess('🎉 Empresa cadastrada com sucesso! Trial de 7 dias ativado!');
        
        // Redirecionar para dashboard após 2 segundos
        setTimeout(() => {
          navigate('/dashboard');
        }, 2000);
      }

    } catch (err: any) {
      setError(`Erro: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const estados = [
    'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA',
    'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN',
    'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
  ];

  const setores = [
    'Tecnologia', 'Saúde', 'Educação', 'Varejo', 'Indústria',
    'Agricultura', 'Construção', 'Consultoria', 'Alimentação',
    'Transporte', 'Turismo', 'Financeiro', 'Imobiliário', 'Outro'
  ];

  const portes = [
    { value: 'MEI', label: 'MEI - Microempreendedor Individual' },
    { value: 'MICRO', label: 'Microempresa' },
    { value: 'PEQUENA', label: 'Pequena Empresa' },
    { value: 'MEDIA', label: 'Média Empresa' },
    { value: 'GRANDE', label: 'Grande Empresa' }
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-6 w-6 text-blue-600" />
            Cadastro da Empresa - Trial Gratuito
          </CardTitle>
          <CardDescription>
            Passo {step} de 3 - Complete seu cadastro e ganhe 7 dias grátis!
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Mensagens */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {success && (
            <Alert className="border-green-200 bg-green-50">
              <AlertCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">{success}</AlertDescription>
            </Alert>
          )}

          {/* Progress Bar */}
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
              style={{ width: `${(step / 3) * 100}%` }}
            />
          </div>

          {/* Step 1: Dados da Empresa */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-lg font-semibold text-gray-800">
                <Building2 className="h-5 w-5" />
                Dados da Empresa
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="companyName">Nome da Empresa *</Label>
                  <Input
                    id="companyName"
                    value={formData.companyName}
                    onChange={(e) => handleInputChange('companyName', e.target.value)}
                    placeholder="Ex: Minha Empresa Ltda"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cnpj">CNPJ *</Label>
                  <Input
                    id="cnpj"
                    value={formData.cnpj}
                    onChange={(e) => handleInputChange('cnpj', formatCnpj(e.target.value))}
                    placeholder="00.000.000/0000-00"
                    maxLength={18}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="razaoSocial">Razão Social</Label>
                  <Input
                    id="razaoSocial"
                    value={formData.razaoSocial}
                    onChange={(e) => handleInputChange('razaoSocial', e.target.value)}
                    placeholder="Razão social completa"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="inscricaoEstadual">Inscrição Estadual</Label>
                  <Input
                    id="inscricaoEstadual"
                    value={formData.inscricaoEstadual}
                    onChange={(e) => handleInputChange('inscricaoEstadual', e.target.value)}
                    placeholder="000.000.000.000"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="setor">Setor de Atividade</Label>
                  <Select value={formData.setor} onValueChange={(value) => handleInputChange('setor', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o setor" />
                    </SelectTrigger>
                    <SelectContent>
                      {setores.map(setor => (
                        <SelectItem key={setor} value={setor}>{setor}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="porte">Porte da Empresa *</Label>
                  <Select value={formData.porte} onValueChange={(value) => handleInputChange('porte', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o porte" />
                    </SelectTrigger>
                    <SelectContent>
                      {portes.map(porte => (
                        <SelectItem key={porte.value} value={porte.value}>{porte.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Endereço */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-lg font-semibold text-gray-800">
                <MapPin className="h-5 w-5" />
                Endereço da Empresa
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="cep">CEP *</Label>
                  <Input
                    id="cep"
                    value={formData.cep}
                    onChange={(e) => {
                      const newCep = formatCep(e.target.value);
                      handleInputChange('cep', newCep);
                      if (newCep.replace(/\D/g, '').length === 8) {
                        fetchAddressByCep(newCep);
                      }
                    }}
                    placeholder="00000-000"
                    maxLength={9}
                  />
                </div>

                <div className="md:col-span-2 space-y-2">
                  <Label htmlFor="logradouro">Logradouro *</Label>
                  <Input
                    id="logradouro"
                    value={formData.logradouro}
                    onChange={(e) => handleInputChange('logradouro', e.target.value)}
                    placeholder="Rua, Avenida, etc."
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="numero">Número *</Label>
                  <Input
                    id="numero"
                    value={formData.numero}
                    onChange={(e) => handleInputChange('numero', e.target.value)}
                    placeholder="123"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="complemento">Complemento</Label>
                  <Input
                    id="complemento"
                    value={formData.complemento}
                    onChange={(e) => handleInputChange('complemento', e.target.value)}
                    placeholder="Sala, Andar, etc."
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bairro">Bairro *</Label>
                  <Input
                    id="bairro"
                    value={formData.bairro}
                    onChange={(e) => handleInputChange('bairro', e.target.value)}
                    placeholder="Nome do bairro"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cidade">Cidade *</Label>
                  <Input
                    id="cidade"
                    value={formData.cidade}
                    onChange={(e) => handleInputChange('cidade', e.target.value)}
                    placeholder="Nome da cidade"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="estado">Estado *</Label>
                  <Select value={formData.estado} onValueChange={(value) => handleInputChange('estado', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="UF" />
                    </SelectTrigger>
                    <SelectContent>
                      {estados.map(estado => (
                        <SelectItem key={estado} value={estado}>{estado}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="telefoneEmpresa">Telefone da Empresa</Label>
                  <Input
                    id="telefoneEmpresa"
                    value={formData.telefoneEmpresa}
                    onChange={(e) => handleInputChange('telefoneEmpresa', formatPhone(e.target.value))}
                    placeholder="(00) 00000-0000"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Dados do Administrador */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-lg font-semibold text-gray-800">
                <User className="h-5 w-5" />
                Dados do Administrador
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="adminName">Nome Completo *</Label>
                  <Input
                    id="adminName"
                    value={formData.adminName}
                    onChange={(e) => handleInputChange('adminName', e.target.value)}
                    placeholder="Seu nome completo"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="adminEmail">E-mail *</Label>
                  <Input
                    id="adminEmail"
                    type="email"
                    value={formData.adminEmail}
                    onChange={(e) => handleInputChange('adminEmail', e.target.value)}
                    placeholder="seu@email.com"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="adminCpf">CPF *</Label>
                  <Input
                    id="adminCpf"
                    value={formData.adminCpf}
                    onChange={(e) => handleInputChange('adminCpf', formatCpf(e.target.value))}
                    placeholder="000.000.000-00"
                    maxLength={14}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="adminTelefone">Telefone</Label>
                  <Input
                    id="adminTelefone"
                    value={formData.adminTelefone}
                    onChange={(e) => handleInputChange('adminTelefone', formatPhone(e.target.value))}
                    placeholder="(00) 00000-0000"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="adminCargo">Cargo na Empresa *</Label>
                  <Input
                    id="adminCargo"
                    value={formData.adminCargo}
                    onChange={(e) => handleInputChange('adminCargo', e.target.value)}
                    placeholder="Ex: CEO, Diretor, Gerente"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="adminPassword">Senha *</Label>
                  <Input
                    id="adminPassword"
                    type="password"
                    value={formData.adminPassword}
                    onChange={(e) => handleInputChange('adminPassword', e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                  />
                </div>

                <div className="md:col-span-2 space-y-2">
                  <Label htmlFor="confirmPassword">Confirmar Senha *</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={formData.confirmPassword}
                    onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                    placeholder="Digite a senha novamente"
                  />
                </div>
              </div>

              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <h3 className="font-semibold text-blue-900 mb-2">🎉 Seu trial gratuito inclui:</h3>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>✅ 7 dias de acesso completo</li>
                  <li>✅ 50GB de armazenamento</li>
                  <li>✅ 15GB de download mensal</li>
                  <li>✅ Até 2 usuários</li>
                  <li>✅ Todas as funcionalidades do sistema</li>
                </ul>
              </div>
            </div>
          )}
        </CardContent>

        <CardFooter className="flex justify-between">
          <Button 
            variant="outline" 
            onClick={prevStep} 
            disabled={step === 1 || loading}
          >
            Voltar
          </Button>

          {step < 3 ? (
            <Button onClick={nextStep} disabled={loading}>
              Próximo
            </Button>
          ) : (
            <Button onClick={handleSubmit} disabled={loading}>
              {loading ? 'Criando conta...' : 'Finalizar Cadastro'}
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
};

export default CompanySignup;
