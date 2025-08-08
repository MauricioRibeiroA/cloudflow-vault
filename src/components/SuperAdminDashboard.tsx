import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Building2, 
  Users, 
  HardDrive, 
  Download, 
  CreditCard, 
  Eye,
  Edit,
  TrendingUp,
  AlertCircle
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface Company {
  id: string;
  name: string;
  domain: string;
  status: string;
  created_at: string;
  plan_id: string;
  current_storage_used_bytes: number;
  current_download_used_bytes: number;
  active_users_count: number;
  stripe_customer_id: string;
  stripe_status: string;
}

interface Plan {
  id: string;
  name: string;
  price_brl: number;
  storage_limit_gb: number;
  download_limit_gb: number;
  max_users: number;
}

interface CompanyWithPlan extends Company {
  plan_name?: string;
  storage_limit_gb?: number;
  download_limit_gb?: number;
  max_users?: number;
  price_brl?: number;
  // Real-time usage data
  storage_used_gb?: number;
  download_used_gb?: number;
  storage_percentage?: number;
  download_percentage?: number;
}

interface DashboardStats {
  totalCompanies: number;
  activeCompanies: number;
  totalRevenue: number;
  totalUsers: number;
}

interface UsageTotals {
  totalStorageUsed: number;
  totalStorageAvailable: number;
  totalDownloadUsed: number;
  totalDownloadAvailable: number;
}

export default function SuperAdminDashboard() {
  const [companies, setCompanies] = useState<CompanyWithPlan[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [stats, setStats] = useState<DashboardStats>({
    totalCompanies: 0,
    activeCompanies: 0,
    totalRevenue: 0,
    totalUsers: 0
  });
  const [usageTotals, setUsageTotals] = useState<UsageTotals>({
    totalStorageUsed: 0,
    totalStorageAvailable: 0,
    totalDownloadUsed: 0,
    totalDownloadAvailable: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingCompany, setEditingCompany] = useState<CompanyWithPlan | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<string>('');

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        loadCompanies(),
        loadPlans(),
        loadStats()
      ]);
    } catch (err: any) {
      setError(err.message);
      console.error('Erro ao carregar dados do dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadCompanies = async () => {
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
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Load real-time usage data for each company
    const companiesWithUsage = await Promise.all(
      data.map(async (company) => {
        let usageData = {
          storage_used_gb: 0,
          download_used_gb: 0,
          storage_percentage: 0,
          download_percentage: 0
        };

        try {
          // Get real usage data directly from files table (same as company dashboard)
          const { data: companyFiles } = await supabase
            .from('files')
            .select('file_size')
            .eq('company_id', company.id);

          const totalStorageBytes = companyFiles?.reduce((sum, file) => sum + (file.file_size || 0), 0) || 0;
          const totalStorageGB = totalStorageBytes / (1024 * 1024 * 1024);
          
          // Get storage limit from plans (or use default from Free Trial)
          const storageLimitGB = company.plans?.storage_limit_gb || 10;
          const downloadLimitGB = company.plans?.download_limit_gb || 3;
          
          usageData = {
            storage_used_gb: totalStorageGB,
            download_used_gb: 0, // We don't track download usage in files table
            storage_percentage: storageLimitGB > 0 
              ? Math.min((totalStorageGB / storageLimitGB) * 100, 100)
              : 0,
            download_percentage: 0 // Since we don't have download tracking
          };
        } catch (err) {
          console.warn(`Failed to load usage for company ${company.name}:`, err);
        }

        return {
          ...company,
          plan_name: company.plans?.name || 'Sem Plano',
          storage_limit_gb: company.plans?.storage_limit_gb || 0,
          download_limit_gb: company.plans?.download_limit_gb || 0,
          max_users: company.plans?.max_users || 0,
          price_brl: company.plans?.price_brl || 0,
          ...usageData
        };
      })
    );

    setCompanies(companiesWithUsage);
    
    // Calculate usage totals
    const totals = companiesWithUsage.reduce(
      (acc, company) => {
        const storageUsed = company.storage_used_gb || 0;
        const storageLimit = company.storage_limit_gb || 0;
        const downloadUsed = company.download_used_gb || 0;
        const downloadLimit = company.download_limit_gb || 0;
        
        return {
          totalStorageUsed: acc.totalStorageUsed + storageUsed,
          totalStorageAvailable: acc.totalStorageAvailable + storageLimit,
          totalDownloadUsed: acc.totalDownloadUsed + downloadUsed,
          totalDownloadAvailable: acc.totalDownloadAvailable + downloadLimit
        };
      },
      {
        totalStorageUsed: 0,
        totalStorageAvailable: 0,
        totalDownloadUsed: 0,
        totalDownloadAvailable: 0
      }
    );
    
    setUsageTotals(totals);
  };

  const loadPlans = async () => {
    const { data, error } = await supabase
      .from('plans')
      .select('*')
      .order('price_brl', { ascending: true });

    if (error) throw error;
    setPlans(data || []);
  };

  const loadStats = async () => {
    const { data: companiesData } = await supabase
      .from('companies')
      .select(`
        status,
        active_users_count,
        plans!inner (price_brl)
      `);

    if (companiesData) {
      const totalCompanies = companiesData.length;
      const activeCompanies = companiesData.filter(c => c.status === 'active').length;
      const totalUsers = companiesData.reduce((sum, c) => sum + (c.active_users_count || 0), 0);
      const totalRevenue = companiesData
        .filter(c => c.status === 'active' && c.plans)
        .reduce((sum, c) => sum + (c.plans.price_brl || 0), 0);

      setStats({
        totalCompanies,
        activeCompanies,
        totalRevenue,
        totalUsers
      });
    }
  };

  const updateCompanyPlan = async (companyId: string, planId: string) => {
    try {
      const { error } = await supabase
        .from('companies')
        .update({ plan_id: planId })
        .eq('id', companyId);

      if (error) throw error;

      // Recarregar dados
      await loadDashboardData();
      setEditingCompany(null);
      setSelectedPlan('');
      
      // Mostrar sucesso
      alert('Plano atualizado com sucesso!');
    } catch (err: any) {
      console.error('Erro ao atualizar plano:', err);
      alert('Erro ao atualizar plano: ' + err.message);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    
    const kb = bytes / 1024;
    const mb = bytes / (1024 * 1024);
    const gb = bytes / (1024 * 1024 * 1024);
    
    if (gb >= 1) {
      return `${gb.toFixed(2)} GB`;
    } else if (mb >= 1) {
      return `${mb.toFixed(2)} MB`;
    } else if (kb >= 1) {
      return `${kb.toFixed(2)} KB`;
    } else {
      return `${bytes.toFixed(0)} B`;
    }
  };

  const formatStorageUsage = (usageGB: number) => {
    if (usageGB === 0) return '0 B';
    
    const bytes = usageGB * 1024 * 1024 * 1024;
    return formatBytes(bytes);
  };

  const getUsagePercentage = (used: number, limit: number) => {
    if (limit === 0) return 0;
    return Math.min((used / (limit * 1024 * 1024 * 1024)) * 100, 100);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-500';
      case 'inactive': return 'bg-yellow-500';
      case 'suspended': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'active': return 'Ativa';
      case 'inactive': return 'Inativa';
      case 'suspended': return 'Suspensa';
      default: return 'Desconhecido';
    }
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
      <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
        Erro: {error}
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Dashboard Super Admin</h1>
          <p className="text-gray-600 mt-1">Gerenciamento de empresas e planos</p>
        </div>
        <Button onClick={loadDashboardData} variant="outline">
          <TrendingUp className="w-4 h-4 mr-2" />
          Atualizar Dados
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Empresas</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalCompanies}</div>
            <p className="text-xs text-muted-foreground">
              {stats.activeCompanies} ativas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Receita Mensal</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">R$ {stats.totalRevenue.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">
              De empresas ativas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Usuários</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalUsers}</div>
            <p className="text-xs text-muted-foreground">
              Em todas as empresas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Taxa de Conversão</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.totalCompanies > 0 ? ((stats.activeCompanies / stats.totalCompanies) * 100).toFixed(1) : 0}%
            </div>
            <p className="text-xs text-muted-foreground">
              Empresas ativas
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Usage Totals Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Armazenamento Total</CardTitle>
            <HardDrive className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>{formatStorageUsage(usageTotals.totalStorageUsed)}</span>
                <span>{usageTotals.totalStorageAvailable.toFixed(2)} GB</span>
              </div>
              <Progress 
                value={usageTotals.totalStorageAvailable > 0 
                  ? (usageTotals.totalStorageUsed / usageTotals.totalStorageAvailable) * 100 
                  : 0
                } 
                className="w-full h-2"
              />
              <div className="text-xs text-muted-foreground text-center">
                {usageTotals.totalStorageAvailable > 0 
                  ? ((usageTotals.totalStorageUsed / usageTotals.totalStorageAvailable) * 100).toFixed(4)
                  : 0
                }% usado de todas as empresas
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Download Total Mensal</CardTitle>
            <Download className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>{usageTotals.totalDownloadUsed.toFixed(2)} GB</span>
                <span>{usageTotals.totalDownloadAvailable.toFixed(2)} GB</span>
              </div>
              <Progress 
                value={usageTotals.totalDownloadAvailable > 0 
                  ? (usageTotals.totalDownloadUsed / usageTotals.totalDownloadAvailable) * 100 
                  : 0
                } 
                className="w-full h-2"
              />
              <div className="text-xs text-muted-foreground text-center">
                {usageTotals.totalDownloadAvailable > 0 
                  ? ((usageTotals.totalDownloadUsed / usageTotals.totalDownloadAvailable) * 100).toFixed(1)
                  : 0
                }% usado de todas as empresas
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Companies Table */}
      <Card>
        <CardHeader>
          <CardTitle>Empresas Cadastradas</CardTitle>
          <p className="text-sm text-gray-600">
            Gerencie os planos e monitore o uso de cada empresa
          </p>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Plano Atual</TableHead>
                  <TableHead>Armazenamento</TableHead>
                  <TableHead>Download Mensal</TableHead>
                  <TableHead>Usuários</TableHead>
                  <TableHead>Receita</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {companies.map((company) => (
                  <TableRow key={company.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{company.name}</div>
                        <div className="text-sm text-gray-500">{company.domain}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={`${getStatusColor(company.status)} text-white`}>
                        {getStatusLabel(company.status)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">{company.plan_name}</span>
                        {company.price_brl > 0 && (
                          <span className="text-sm text-gray-500">
                            R$ {company.price_brl.toFixed(2)}/mês
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span>{formatStorageUsage(company.storage_used_gb || 0)}</span>
                          <span>{company.storage_limit_gb} GB</span>
                        </div>
                        <Progress 
                          value={company.storage_percentage || 0} 
                          className="w-full h-2"
                        />
                        <div className="text-xs text-gray-500 text-center">
                          {(company.storage_percentage || 0).toFixed(4)}% usado
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span>{company.download_used_gb?.toFixed(2) || '0.00'} GB</span>
                          <span>{company.download_limit_gb} GB</span>
                        </div>
                        <Progress 
                          value={company.download_percentage || 0} 
                          className="w-full h-2"
                        />
                        <div className="text-xs text-gray-500 text-center">
                          {(company.download_percentage || 0).toFixed(1)}% usado
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-center">
                        <div className="font-medium">{company.active_users_count}</div>
                        <div className="text-sm text-gray-500">/ {company.max_users}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium text-green-600">
                        R$ {company.price_brl.toFixed(2)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        <Button size="sm" variant="outline">
                          <Eye className="w-4 h-4" />
                        </Button>
                        
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => {
                                setEditingCompany(company);
                                setSelectedPlan(company.plan_id || '');
                              }}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Editar Plano - {company.name}</DialogTitle>
                              <DialogDescription>
                                Altere o plano atual da empresa
                              </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                              <div className="space-y-2">
                                <label className="text-sm font-medium">Plano Atual:</label>
                                <p className="text-sm text-gray-600">{company.plan_name}</p>
                              </div>
                              
                              <div className="space-y-2">
                                <label className="text-sm font-medium">Novo Plano:</label>
                                <Select value={selectedPlan} onValueChange={setSelectedPlan}>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Selecione um plano" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="">Remover Plano</SelectItem>
                                    {plans.map((plan) => (
                                      <SelectItem key={plan.id} value={plan.id}>
                                        {plan.name} - R$ {plan.price_brl.toFixed(2)}/mês
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                            
                            <div className="flex justify-end space-x-2">
                              <Button
                                variant="outline"
                                onClick={() => {
                                  setEditingCompany(null);
                                  setSelectedPlan('');
                                }}
                              >
                                Cancelar
                              </Button>
                              <Button
                                onClick={() => updateCompanyPlan(company.id, selectedPlan)}
                              >
                                Salvar Alterações
                              </Button>
                            </div>
                          </DialogContent>
                        </Dialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Alerts Section */}
      {companies.some(c => (c.storage_percentage || 0) > 80 || (c.download_percentage || 0) > 80) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <AlertCircle className="w-5 h-5 mr-2 text-orange-500" />
              Alertas de Uso
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {companies
                .filter(c => (c.storage_percentage || 0) > 80 || (c.download_percentage || 0) > 80)
                .map(company => {
                  const storageHigh = (company.storage_percentage || 0) > 80;
                  const downloadHigh = (company.download_percentage || 0) > 80;
                  
                  return (
                    <div key={company.id} className="flex items-center justify-between p-3 bg-orange-50 rounded-lg">
                      <div>
                        <span className="font-medium">{company.name}</span>
                        <div className="text-sm text-gray-600 mt-1">
                          {storageHigh && (
                            <div>🗂️ Armazenamento: {(company.storage_percentage || 0).toFixed(1)}% usado</div>
                          )}
                          {downloadHigh && (
                            <div>📥 Download: {(company.download_percentage || 0).toFixed(1)}% usado este mês</div>
                          )}
                        </div>
                      </div>
                      <Button size="sm" variant="outline">
                        Contactar Cliente
                      </Button>
                    </div>
                  );
                })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
