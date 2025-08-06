import { useState, useEffect } from 'react';
import { useAuth } from '@/components/auth/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { 
  HardDrive, 
  Database, 
  Users, 
  FileText, 
  AlertTriangle, 
  TrendingUp, 
  Activity,
  DollarSign,
  Server,
  Zap,
  Eye,
  Building2,
  Calendar,
  Download,
  Upload,
  CreditCard,
  Clock,
  Settings
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useNavigate } from 'react-router-dom';

interface CompanyStats {
  totalFiles: number;
  totalSize: number;
  totalUsers: number;
  storageUsed: number;
  storageLimit: number;
  downloadUsed: number;
  downloadLimit: number;
  dailyUploads: number;
  avgFileSize: number;
  planName: string;
  planPrice: number;
  trialEndsAt?: string;
  isTrialActive: boolean;
  maxUsers: number;
  recentFiles: RecentFile[];
  activeUsers: ActiveUser[];
}

interface RecentFile {
  id: string;
  name: string;
  size: number;
  type: string;
  uploadedBy: string;
  uploadedAt: string;
}

interface ActiveUser {
  id: string;
  name: string;
  lastActivity: string;
  activityCount: number;
  group: string;
}

interface Profile {
  id: string;
  full_name: string;
  email: string;
  group_name: string;
  status: string;
  company_id: string;
}

interface Company {
  id: string;
  name: string;
  subscription_status: string;
  is_trial_active: boolean;
  trial_ends_at?: string;
  plan_name?: string;
  price_brl?: number;
  storage_limit_gb?: number;
  download_limit_gb?: number;
  max_users?: number;
}

const CompanyDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [stats, setStats] = useState<CompanyStats>({
    totalFiles: 0,
    totalSize: 0,
    totalUsers: 0,
    storageUsed: 0,
    storageLimit: 0,
    downloadUsed: 0,
    downloadLimit: 0,
    dailyUploads: 0,
    avgFileSize: 0,
    planName: '',
    planPrice: 0,
    isTrialActive: false,
    maxUsers: 0,
    recentFiles: [],
    activeUsers: []
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchProfile();
    }
  }, [user]);

  useEffect(() => {
    if (profile?.company_id) {
      fetchCompany(profile.company_id);
      fetchCompanyStats(profile.company_id);
    }
  }, [profile]);

  const fetchProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user?.id)
        .single();

      if (error) throw error;
      setProfile(data);
    } catch (error: any) {
      console.error('Error fetching profile:', error);
    }
  };

  const fetchCompany = async (companyId: string) => {
    try {
      const { data, error } = await supabase
        .from('companies')
        .select(`
          *,
          plans (
            id,
            name,
            price_brl,
            storage_limit_gb,
            download_limit_gb,
            max_users
          )
        `)
        .eq('id', companyId)
        .single();

      if (error) throw error;

      setCompany({
        id: data.id,
        name: data.name,
        subscription_status: data.subscription_status,
        is_trial_active: data.is_trial_active,
        trial_ends_at: data.trial_ends_at,
        plan_name: data.plans?.name,
        price_brl: data.plans?.price_brl,
        storage_limit_gb: data.plans?.storage_limit_gb,
        download_limit_gb: data.plans?.download_limit_gb,
        max_users: data.plans?.max_users
      });
    } catch (error: any) {
      console.error('Error fetching company:', error);
    }
  };

  const fetchCompanyStats = async (companyId: string) => {
    try {
      // Fetch files statistics
      const { data: filesData, error: filesError } = await supabase
        .from('files')
        .select('id, file_name, file_size, file_type, created_at, uploaded_by')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });

      if (filesError) throw filesError;

      // Fetch user count and activity
      const { data: usersData, error: usersError } = await supabase
        .from('profiles')
        .select('id, full_name, status, group_name, last_active_at')
        .eq('company_id', companyId);

      if (usersError) throw usersError;

      // Fetch recent user activity logs
      const { data: activityData, error: activityError } = await supabase
        .from('user_action_logs')
        .select('user_id, created_at, action_type')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false })
        .limit(100);

      if (activityError) throw activityError;

      // Process user activity for active users list
      const userActivity: Record<string, { count: number, lastActivity: string, name: string, group: string }> = {};
      
      activityData?.forEach(activity => {
        if (!userActivity[activity.user_id]) {
          const user = usersData?.find(u => u.id === activity.user_id);
          userActivity[activity.user_id] = {
            count: 0,
            lastActivity: activity.created_at,
            name: user?.full_name || 'Usuário Desconhecido',
            group: user?.group_name || 'user'
          };
        }
        
        userActivity[activity.user_id].count += 1;
        
        if (new Date(activity.created_at) > new Date(userActivity[activity.user_id].lastActivity)) {
          userActivity[activity.user_id].lastActivity = activity.created_at;
        }
      });
      
      const activeUsersList = Object.entries(userActivity).map(([id, data]) => ({
        id,
        name: data.name,
        lastActivity: data.lastActivity,
        activityCount: data.count,
        group: data.group
      })).sort((a, b) => new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime()).slice(0, 5);

      // Calculate dashboard stats
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      
      const totalFiles = filesData?.length || 0;
      const totalSize = filesData?.reduce((sum, file) => sum + (file.file_size || 0), 0) || 0;
      const totalUsers = usersData?.filter(u => u.status === 'active').length || 0;
      
      // Recent files (last 5)
      const recentFiles = filesData?.slice(0, 5).map(file => {
        const uploader = usersData?.find(u => u.id === file.uploaded_by);
        return {
          id: file.id,
          name: file.file_name,
          size: file.file_size,
          type: file.file_type,
          uploadedBy: uploader?.full_name || 'Usuário Desconhecido',
          uploadedAt: file.created_at
        };
      }) || [];
      
      // Daily uploads (last 24 hours)
      const dailyUploads = filesData?.filter(file => 
        new Date(file.created_at) > yesterday
      ).length || 0;

      const avgFileSize = totalFiles > 0 ? totalSize / totalFiles : 0;

      // Storage usage from file sizes
      const storageUsed = totalSize;
      
      setStats({
        totalFiles,
        totalSize,
        totalUsers,
        storageUsed,
        storageLimit: (company?.storage_limit_gb || 0) * 1024 * 1024 * 1024,
        downloadUsed: company?.download_limit_gb ? company.download_limit_gb * 0.2 * 1024 * 1024 * 1024 : 0, // Mock data (20% of limit)
        downloadLimit: (company?.download_limit_gb || 0) * 1024 * 1024 * 1024,
        dailyUploads,
        avgFileSize,
        planName: company?.plan_name || 'Plano Básico',
        planPrice: company?.price_brl || 0,
        trialEndsAt: company?.trial_ends_at,
        isTrialActive: company?.is_trial_active || false,
        maxUsers: company?.max_users || 0,
        recentFiles,
        activeUsers: activeUsersList
      });
    } catch (error: any) {
      console.error('Error fetching company stats:', error);
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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStorageUsagePercentage = () => {
    return stats.storageLimit > 0 ? (stats.storageUsed / stats.storageLimit) * 100 : 0;
  };

  const getDownloadUsagePercentage = () => {
    return stats.downloadLimit > 0 ? (stats.downloadUsed / stats.downloadLimit) * 100 : 0;
  };

  const getUsersUsagePercentage = () => {
    return stats.maxUsers > 0 ? (stats.totalUsers / stats.maxUsers) * 100 : 0;
  };

  const getUsageColor = (percentage: number) => {
    if (percentage > 90) return 'text-red-600';
    if (percentage > 75) return 'text-yellow-600';
    return 'text-green-600';
  };

  const getUsageVariant = (percentage: number) => {
    if (percentage > 90) return 'destructive';
    if (percentage > 75) return 'default';
    return 'default';
  };

  const getDaysRemaining = () => {
    if (!stats.trialEndsAt) return 0;
    
    const today = new Date();
    const endDate = new Date(stats.trialEndsAt);
    const diffTime = endDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return Math.max(0, diffDays);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const storagePercentage = getStorageUsagePercentage();
  const downloadPercentage = getDownloadUsagePercentage();
  const usersPercentage = getUsersUsagePercentage();
  const isStorageCritical = storagePercentage > 90;
  const isStorageWarning = storagePercentage > 75;
  const isDownloadCritical = downloadPercentage > 90;
  const daysRemaining = getDaysRemaining();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Dashboard Empresarial</h1>
          <p className="text-muted-foreground">
            {company?.name} - Monitoramento e estatísticas de uso
          </p>
        </div>
        {profile && (
          <div className="text-right space-y-2">
            <div>
              <p className="text-sm font-medium text-foreground">{profile.full_name}</p>
              <Badge variant="secondary" className="text-xs">
                {profile.group_name === 'company_admin' ? 'ADMIN DA EMPRESA' : profile.group_name.toUpperCase()}
              </Badge>
            </div>
          </div>
        )}
      </div>

      {/* Trial Alert */}
      {stats.isTrialActive && (
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

      {/* Storage Alerts */}
      {isStorageCritical && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Armazenamento Crítico!</AlertTitle>
          <AlertDescription>
            O uso de armazenamento está em {storagePercentage.toFixed(1)}%. 
            É necessário limpar arquivos ou atualizar seu plano.
          </AlertDescription>
        </Alert>
      )}

      {isStorageWarning && !isStorageCritical && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Aviso de Armazenamento</AlertTitle>
          <AlertDescription>
            O uso de armazenamento está em {storagePercentage.toFixed(1)}%. 
            Considere revisar os arquivos armazenados.
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
              {formatFileSize(stats.storageUsed)}
            </div>
            <p className="text-xs text-muted-foreground">
              de {formatFileSize(stats.storageLimit)} usados
            </p>
            <div className="mt-2">
              <Progress 
                value={storagePercentage} 
                className="h-2"
              />
            </div>
            <p className={`text-xs mt-1 ${getUsageColor(storagePercentage)}`}>
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
              {formatFileSize(stats.downloadUsed)}
            </div>
            <p className="text-xs text-muted-foreground">
              de {formatFileSize(stats.downloadLimit)} usados
            </p>
            <div className="mt-2">
              <Progress 
                value={downloadPercentage} 
                className="h-2"
              />
            </div>
            <p className={`text-xs mt-1 ${getUsageColor(downloadPercentage)}`}>
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
              {stats.planName}
            </div>
            <p className="text-xs text-muted-foreground">
              {formatCurrency(stats.planPrice)}/mês
            </p>
            <div className="mt-2">
              <Badge variant={stats.isTrialActive ? "default" : "outline"}>
                {stats.isTrialActive ? "Trial Ativo" : "Contratado"}
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
              {stats.totalUsers}
            </div>
            <p className="text-xs text-muted-foreground">
              de {stats.maxUsers} permitidos
            </p>
            <div className="mt-2">
              <Progress 
                value={usersPercentage} 
                className="h-2"
              />
            </div>
            <p className={`text-xs mt-1 ${getUsageColor(usersPercentage)}`}>
              {usersPercentage.toFixed(1)}% utilizado
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs for Detailed Info */}
      <Tabs defaultValue="storage" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="storage">Armazenamento</TabsTrigger>
          <TabsTrigger value="activity">Atividade Recente</TabsTrigger>
          <TabsTrigger value="files">Arquivos Recentes</TabsTrigger>
        </TabsList>
        
        {/* Storage Details Tab */}
        <TabsContent value="storage" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5" />
                  Detalhes do Armazenamento
                </CardTitle>
                <CardDescription>
                  Informações detalhadas sobre o uso de armazenamento
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm">Espaço usado:</span>
                  <span className="font-medium">{formatFileSize(stats.storageUsed)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Espaço disponível:</span>
                  <span className="font-medium">{formatFileSize(stats.storageLimit - stats.storageUsed)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Limite total:</span>
                  <span className="font-medium">{formatFileSize(stats.storageLimit)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Tamanho médio por arquivo:</span>
                  <span className="font-medium">{formatFileSize(stats.avgFileSize)}</span>
                </div>
                
                <div className="mt-4 p-3 bg-muted rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Status do Sistema:</span>
                    <Badge variant={isStorageCritical ? "destructive" : isStorageWarning ? "default" : "default"}>
                      {isStorageCritical ? "Crítico" : isStorageWarning ? "Atenção" : "Normal"}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Métricas de Performance
                </CardTitle>
                <CardDescription>
                  Estatísticas de uso e performance da sua empresa
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm">Uploads hoje:</span>
                  <span className="font-medium">{stats.dailyUploads}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Total de arquivos:</span>
                  <span className="font-medium">{stats.totalFiles.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Usuários ativos:</span>
                  <span className="font-medium">{stats.totalUsers}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Plano atual:</span>
                  <span className="font-medium">{stats.planName}</span>
                </div>

                <div className="mt-4 p-3 bg-muted rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Custo Mensal:</span>
                    <span className="font-medium">{formatCurrency(stats.planPrice)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        {/* Activity Tab */}
        <TabsContent value="activity">
          <Card>
            <CardHeader>
              <CardTitle>Usuários Mais Ativos</CardTitle>
              <CardDescription>
                Últimas atividades registradas no sistema
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {stats.activeUsers.map(user => (
                  <div key={user.id} className="flex items-center justify-between border-b pb-3">
                    <div className="flex items-center gap-4">
                      <div className="bg-primary/10 p-2 rounded-full">
                        <Users className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">{user.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {user.group === 'company_admin' ? 'Admin da Empresa' : 
                           user.group === 'super_admin' ? 'Super Admin' : 
                           user.group === 'hr' ? 'RH' : 'Colaborador'}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge variant="outline" className="mb-1">
                        {user.activityCount} ações recentes
                      </Badge>
                      <p className="text-xs text-muted-foreground">
                        Última atividade: {formatDate(user.lastActivity)}
                      </p>
                    </div>
                  </div>
                ))}
                
                {stats.activeUsers.length === 0 && (
                  <div className="p-4 text-center text-muted-foreground">
                    Nenhuma atividade de usuário registrada recentemente.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Recent Files Tab */}
        <TabsContent value="files">
          <Card>
            <CardHeader>
              <CardTitle>Arquivos Recentes</CardTitle>
              <CardDescription>
                Últimos arquivos carregados no sistema
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {stats.recentFiles.map(file => (
                  <div key={file.id} className="flex items-center justify-between border-b pb-3">
                    <div className="flex items-center gap-4">
                      <div className="bg-primary/10 p-2 rounded-full">
                        <FileText className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">{file.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {formatFileSize(file.size)} • {file.type}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm">{file.uploadedBy}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(file.uploadedAt)}
                      </p>
                    </div>
                  </div>
                ))}
                
                {stats.recentFiles.length === 0 && (
                  <div className="p-4 text-center text-muted-foreground">
                    Nenhum arquivo foi carregado recentemente.
                  </div>
                )}
                
                <div className="pt-4 flex justify-center">
                  <Button variant="outline" onClick={() => navigate('/upload')}>
                    <Upload className="mr-2 h-4 w-4" />
                    Gerenciar Arquivos
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Ações Rápidas
          </CardTitle>
          <CardDescription>
            Gerenciar e otimizar o uso do sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <Button variant="outline" size="sm" onClick={() => navigate('/upload')}>
              <Upload className="mr-2 h-4 w-4" />
              Upload de Arquivos
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate('/admin')}>
              <Users className="mr-2 h-4 w-4" />
              Gerenciar Colaboradores
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate('/plans')}>
              <CreditCard className="mr-2 h-4 w-4" />
              Planos e Cobranças
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate('/settings')}>
              <Settings className="mr-2 h-4 w-4" />
              Configurações
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default CompanyDashboard;
