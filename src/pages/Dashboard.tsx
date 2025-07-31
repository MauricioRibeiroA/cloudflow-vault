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
  Eye
} from 'lucide-react';

interface StorageStats {
  totalFiles: number;
  totalSize: number;
  totalUsers: number;
  storageUsed: number;
  storageLimit: number;
  monthlyCost: number;
  dailyUploads: number;
  avgFileSize: number;
}

interface Profile {
  id: string;
  full_name: string;
  email: string;
  group_name: string;
  status: string;
}

const Dashboard = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [stats, setStats] = useState<StorageStats>({
    totalFiles: 0,
    totalSize: 0,
    totalUsers: 0,
    storageUsed: 0,
    storageLimit: 0, // Will be fetched from settings
    monthlyCost: 0,
    dailyUploads: 0,
    avgFileSize: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchProfile();
      fetchStorageStats();
    }
  }, [user]);

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

  const handleViewJWTToken = async () => {
    try {
      const { data } = await supabase.auth.getSession();
      console.log("Token JWT do super admin:", data.session?.access_token);
    } catch (error) {
      console.error('Error fetching JWT token:', error);
    }
  };

  const fetchStorageStats = async () => {
    try {
      // Fetch storage limit from settings
      const { data: settingsData, error: settingsError } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'storage_limit_gb')
        .single();

      // Default to 20GB if setting doesn't exist
      const storageLimitGB = settingsData?.value ? Number(settingsData.value) : 20;
      const storageLimit = storageLimitGB * 1024 * 1024 * 1024; // Convert GB to bytes

      // Fetch file statistics
      const { data: filesData, error: filesError } = await supabase
        .from('files')
        .select('file_size, created_at');

      if (filesError) throw filesError;

      // Fetch user count
      const { data: usersData, error: usersError } = await supabase
        .from('profiles')
        .select('id, status');

      if (usersError) throw usersError;

      // Calculate statistics
      const totalFiles = filesData?.length || 0;
      const totalSize = filesData?.reduce((sum, file) => sum + (file.file_size || 0), 0) || 0;
      const totalUsers = usersData?.filter(u => u.status === 'active').length || 0;
      
      // Calculate daily uploads (last 24 hours)
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const dailyUploads = filesData?.filter(file => 
        new Date(file.created_at) > yesterday
      ).length || 0;

      const avgFileSize = totalFiles > 0 ? totalSize / totalFiles : 0;

      // Storage usage calculation (based on actual file sizes)
      const storageUsed = totalSize;
      
      // Cost calculation (estimated based on Supabase pricing)
      const storageGB = storageUsed / (1024 * 1024 * 1024);
      const monthlyCost = Math.max(0, (storageGB - 1) * 0.021); // $0.021 per GB after first 1GB

      setStats({
        totalFiles,
        totalSize,
        totalUsers,
        storageUsed,
        storageLimit,
        monthlyCost,
        dailyUploads,
        avgFileSize,
      });
    } catch (error: any) {
      console.error('Error fetching storage stats:', error);
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
      currency: 'USD'
    }).format(amount);
  };

  const getStorageUsagePercentage = () => {
    return (stats.storageUsed / stats.storageLimit) * 100;
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const storagePercentage = getStorageUsagePercentage();
  const isStorageCritical = storagePercentage > 90;
  const isStorageWarning = storagePercentage > 75;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground">
            Monitoramento de armazenamento e recursos do sistema
          </p>
        </div>
        {profile && (
          <div className="text-right space-y-2">
            <div>
              <p className="text-sm font-medium text-foreground">{profile.full_name}</p>
              <Badge variant="secondary" className="text-xs">
                {profile.group_name.toUpperCase()}
              </Badge>
            </div>
            {profile.group_name === 'super_admin' && (
              <div className="space-y-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleViewJWTToken}
                  className="text-xs h-6 px-2 text-muted-foreground hover:text-foreground"
                >
                  <Eye className="mr-1 h-3 w-3" />
                  Ver Token JWT
                </Button>
                <p className="text-xs text-yellow-600">⚠️ Apenas para uso interno em desenvolvimento</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Alerts */}
      {isStorageCritical && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Armazenamento Crítico!</AlertTitle>
          <AlertDescription>
            O uso de armazenamento está em {storagePercentage.toFixed(1)}%. 
            É necessário limpar arquivos ou aumentar o limite.
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
            <CardTitle className="text-sm font-medium">Custo Mensal</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(stats.monthlyCost)}
            </div>
            <p className="text-xs text-muted-foreground">
              Baseado no uso atual
            </p>
            <div className="mt-2">
              <Badge variant={stats.monthlyCost > 5 ? "destructive" : "default"}>
                {stats.monthlyCost > 5 ? "Alto" : "Normal"}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Arquivos</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalFiles.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              +{stats.dailyUploads} hoje
            </p>
            <div className="mt-2">
              <div className="flex items-center gap-1">
                <TrendingUp className="h-3 w-3 text-green-600" />
                <span className="text-xs text-green-600">
                  {stats.dailyUploads} uploads hoje
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Usuários Ativos</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalUsers}</div>
            <p className="text-xs text-muted-foreground">
              Total de usuários ativos
            </p>
            <div className="mt-2">
              <Badge variant="outline">
                Sistema ativo
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Statistics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Storage Details */}
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

        {/* Performance Metrics */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Métricas de Performance
            </CardTitle>
            <CardDescription>
              Estatísticas de uso e performance do sistema
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
              <span className="text-sm">Custo estimado/mês:</span>
              <span className="font-medium">{formatCurrency(stats.monthlyCost)}</span>
            </div>

            <div className="mt-4 p-3 bg-muted rounded-lg">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Eficiência de Custo:</span>
                <Badge variant={stats.monthlyCost < 2 ? "default" : stats.monthlyCost < 5 ? "default" : "destructive"}>
                  {stats.monthlyCost < 2 ? "Ótima" : stats.monthlyCost < 5 ? "Boa" : "Revisar"}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

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
            <Button variant="outline" size="sm">
              <Server className="mr-2 h-4 w-4" />
              Limpar Cache
            </Button>
            <Button variant="outline" size="sm">
              <Database className="mr-2 h-4 w-4" />
              Otimizar BD
            </Button>
            <Button variant="outline" size="sm">
              <HardDrive className="mr-2 h-4 w-4" />
              Verificar Espaço
            </Button>
            <Button variant="outline" size="sm">
              <Activity className="mr-2 h-4 w-4" />
              Relatório de Uso
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Dashboard;