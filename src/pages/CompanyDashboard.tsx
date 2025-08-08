import React, { useState, useEffect } from 'react';
import { useAuth } from '@/components/auth/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { 
  HardDrive, 
  Users, 
  Download,
  CreditCard,
  Clock,
  AlertTriangle
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function CompanyDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [company, setCompany] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadCompanyData();
  }, [user]);

  const loadCompanyData = async () => {
    try {
      if (!user) return;

      // Get user profile with company_id
      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id, full_name, group_name')
        .eq('user_id', user.id)
        .single();

      if (!profile?.company_id) return;

      // Get company data with plan information
      const { data: companyData, error } = await supabase
        .from('companies')
        .select(`
          *,
          plans (
            name,
            price_brl,
            storage_limit_gb,
            download_limit_gb,
            max_users
          )
        `)
        .eq('id', profile.company_id)
        .single();

      if (error) throw error;

      // Get files count and size
      const { data: files } = await supabase
        .from('files')
        .select('file_size')
        .eq('company_id', profile.company_id);

      // Get active users count
      const { data: users } = await supabase
        .from('profiles')
        .select('id')
        .eq('company_id', profile.company_id)
        .eq('status', 'active');

      const totalFiles = files?.length || 0;
      const totalSize = files?.reduce((sum, file) => sum + (file.file_size || 0), 0) || 0;
      const totalUsers = users?.length || 0;

      setCompany({
        ...companyData,
        profile,
        totalFiles,
        totalSize,
        totalUsers,
        storageUsed: companyData.current_storage_used_bytes || totalSize,
        downloadUsed: companyData.current_download_used_bytes || 0
      });

    } catch (err: any) {
      console.error('Error loading company data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(amount);
  };

  const getDaysRemaining = () => {
    if (!company?.trial_ends_at) return 0;
    const today = new Date();
    const endDate = new Date(company.trial_ends_at);
    const diffTime = endDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Erro</AlertTitle>
        <AlertDescription>
          {error}
        </AlertDescription>
      </Alert>
    );
  }

  if (!company) {
    return (
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Sem dados</AlertTitle>
        <AlertDescription>
          Não foi possível carregar os dados da empresa.
        </AlertDescription>
      </Alert>
    );
  }

  const plan = company.plans;
  const storageLimit = (plan?.storage_limit_gb || 0) * 1024 * 1024 * 1024;
  const downloadLimit = (plan?.download_limit_gb || 0) * 1024 * 1024 * 1024;
  const storagePercentage = storageLimit > 0 ? (company.storageUsed / storageLimit) * 100 : 0;
  const downloadPercentage = downloadLimit > 0 ? (company.downloadUsed / downloadLimit) * 100 : 0;
  const usersPercentage = plan?.max_users > 0 ? (company.totalUsers / plan.max_users) * 100 : 0;
  const daysRemaining = getDaysRemaining();

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Dashboard Empresarial</h1>
          <p className="text-muted-foreground">
            {company.name} - Monitoramento e estatísticas de uso
          </p>
        </div>
        {company.profile && (
          <div className="text-right space-y-2">
            <div>
              <p className="text-sm font-medium">{company.profile.full_name}</p>
              <Badge variant="secondary" className="text-xs">
                {company.profile.group_name === 'company_admin' ? 'ADMIN DA EMPRESA' : company.profile.group_name.toUpperCase()}
              </Badge>
            </div>
          </div>
        )}
      </div>

      {/* Trial Alert */}
      {company.is_trial_active && (
        <Alert variant={daysRemaining <= 2 ? "destructive" : "default"}>
          <Clock className="h-4 w-4" />
          <AlertTitle>{daysRemaining <= 2 ? "Seu trial está acabando!" : "Você está usando o trial gratuito"}</AlertTitle>
          <AlertDescription>
            {daysRemaining === 0 
              ? "Seu período de teste expira hoje. Contrate um plano para continuar utilizando o sistema."
              : `Restam ${daysRemaining} dias de trial. Após esse período, será necessário contratar um plano.`}
            <Button className="mt-2" variant="outline" size="sm" onClick={() => navigate('/plans')}>
              Ver Planos Disponíveis
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Main Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Armazenamento</CardTitle>
            <HardDrive className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatFileSize(company.storageUsed)}
            </div>
            <p className="text-xs text-muted-foreground">
              de {formatFileSize(storageLimit)} usados
            </p>
            <div className="mt-2">
              <Progress 
                value={storagePercentage} 
                className="h-2"
              />
            </div>
            <p className="text-xs mt-1 text-green-600">
              {storagePercentage.toFixed(1)}% utilizado
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Download Mensal</CardTitle>
            <Download className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatFileSize(company.downloadUsed)}
            </div>
            <p className="text-xs text-muted-foreground">
              de {formatFileSize(downloadLimit)} usados
            </p>
            <div className="mt-2">
              <Progress 
                value={downloadPercentage} 
                className="h-2"
              />
            </div>
            <p className="text-xs mt-1 text-green-600">
              {downloadPercentage.toFixed(1)}% utilizado
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Plano Atual</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {plan?.name || 'Free Trial'}
            </div>
            <p className="text-xs text-muted-foreground">
              {formatCurrency(plan?.price_brl || 0)}/mês
            </p>
            <div className="mt-2">
              <Badge variant={company.is_trial_active ? "default" : "outline"}>
                {company.is_trial_active ? "Trial Ativo" : "Contratado"}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Usuários</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {company.totalUsers}
            </div>
            <p className="text-xs text-muted-foreground">
              de {plan?.max_users || 0} permitidos
            </p>
            <div className="mt-2">
              <Progress 
                value={usersPercentage} 
                className="h-2"
              />
            </div>
            <p className="text-xs mt-1 text-green-600">
              {usersPercentage.toFixed(1)}% utilizado
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Summary Card */}
      <Card>
        <CardHeader>
          <CardTitle>Resumo da Empresa</CardTitle>
          <CardDescription>
            Informações detalhadas sobre sua conta
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex justify-between items-center">
              <span className="text-sm">Total de arquivos:</span>
              <span className="font-medium">{company.totalFiles}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">Status da assinatura:</span>
              <span className="font-medium capitalize">{company.subscription_status}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">Plano atual:</span>
              <span className="font-medium">{plan?.name || 'Free Trial'}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm">Custo mensal:</span>
              <span className="font-medium">{formatCurrency(plan?.price_brl || 0)}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
