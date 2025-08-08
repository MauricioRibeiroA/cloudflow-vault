import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/auth/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { 
  ArrowLeft, 
  Building2, 
  Users, 
  HardDrive, 
  Download,
  CreditCard,
  Calendar,
  Edit,
  Save,
  X
} from 'lucide-react';

interface Company {
  id: string;
  name: string;
  domain: string;
  status: string;
  created_at: string;
  current_storage_used_bytes: number;
  current_download_used_bytes: number;
  active_users_count: number;
  plan_id: string;
  plans?: {
    id: string;
    name: string;
    price_brl: number;
    storage_limit_gb: number;
    download_limit_gb: number;
    max_users: number;
  };
}

interface Plan {
  id: string;
  name: string;
  price_brl: number;
  storage_limit_gb: number;
  download_limit_gb: number;
  max_users: number;
}

export default function CompanyDetails() {
  const { companyId } = useParams<{ companyId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [company, setCompany] = useState<Company | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    domain: '',
    status: '',
    plan_id: ''
  });

  useEffect(() => {
    if (companyId) {
      loadCompanyDetails();
      loadPlans();
    }
  }, [companyId]);

  const loadCompanyDetails = async () => {
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
      
      setCompany(data);
      setFormData({
        name: data.name,
        domain: data.domain || '',
        status: data.status,
        plan_id: data.plan_id || ''
      });
    } catch (error) {
      console.error('Error loading company details:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os detalhes da empresa.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadPlans = async () => {
    try {
      const { data, error } = await supabase
        .from('plans')
        .select('*')
        .order('price_brl', { ascending: true });

      if (error) throw error;
      setPlans(data || []);
    } catch (error) {
      console.error('Error loading plans:', error);
    }
  };

  const handleSave = async () => {
    try {
      const updateData: any = {
        name: formData.name,
        domain: formData.domain,
        status: formData.status
      };

      // Only update plan_id if it's not empty
      if (formData.plan_id) {
        updateData.plan_id = formData.plan_id;
      }

      const { error } = await supabase
        .from('companies')
        .update(updateData)
        .eq('id', companyId);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Dados da empresa atualizados com sucesso!",
      });

      setEditing(false);
      loadCompanyDetails();
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Não foi possível atualizar os dados.",
        variant: "destructive",
      });
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 GB';
    const gb = bytes / (1024 * 1024 * 1024);
    return `${gb.toFixed(2)} GB`;
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
      default: return status;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!company) {
    return (
      <div className="text-center py-8">
        <h2 className="text-2xl font-bold">Empresa não encontrada</h2>
        <Button onClick={() => navigate('/companies')} className="mt-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar para Empresas
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button 
            variant="outline" 
            onClick={() => navigate('/companies')}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Building2 className="h-8 w-8" />
              {company.name}
            </h1>
            <p className="text-muted-foreground">
              Detalhes e configurações da empresa
            </p>
          </div>
        </div>
        
        <div className="flex gap-2">
          {editing ? (
            <>
              <Button onClick={() => setEditing(false)} variant="outline">
                <X className="h-4 w-4 mr-2" />
                Cancelar
              </Button>
              <Button onClick={handleSave}>
                <Save className="h-4 w-4 mr-2" />
                Salvar
              </Button>
            </>
          ) : (
            <Button onClick={() => setEditing(true)}>
              <Edit className="h-4 w-4 mr-2" />
              Editar
            </Button>
          )}
        </div>
      </div>

      {/* Company Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Informações Básicas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Nome da Empresa</Label>
              {editing ? (
                <Input 
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                />
              ) : (
                <p className="text-lg font-medium">{company.name}</p>
              )}
            </div>
            
            <div>
              <Label>Domínio</Label>
              {editing ? (
                <Input 
                  value={formData.domain}
                  onChange={(e) => setFormData({...formData, domain: e.target.value})}
                  placeholder="exemplo.com"
                />
              ) : (
                <p>{company.domain || 'Não informado'}</p>
              )}
            </div>
            
            <div>
              <Label>Status</Label>
              {editing ? (
                <Select value={formData.status} onValueChange={(value) => setFormData({...formData, status: value})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Ativa</SelectItem>
                    <SelectItem value="inactive">Inativa</SelectItem>
                    <SelectItem value="suspended">Suspensa</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <Badge className={`${getStatusColor(company.status)} text-white`}>
                  {getStatusLabel(company.status)}
                </Badge>
              )}
            </div>
            
            <div>
              <Label>Data de Criação</Label>
              <p className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                {new Date(company.created_at).toLocaleDateString('pt-BR')}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Plan Info */}
        <Card>
          <CardHeader>
            <CardTitle>Plano e Limites</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Plano Atual</Label>
              {editing ? (
                <Select value={formData.plan_id} onValueChange={(value) => setFormData({...formData, plan_id: value})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecionar plano" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Nenhum plano</SelectItem>
                    {plans.map(plan => (
                      <SelectItem key={plan.id} value={plan.id}>
                        {plan.name} - R$ {plan.price_brl.toFixed(2)}/mês
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4" />
                  <span className="font-medium">
                    {company.plans?.name || 'Nenhum plano'}
                  </span>
                  {company.plans?.price_brl && (
                    <span className="text-sm text-gray-500">
                      - R$ {company.plans.price_brl.toFixed(2)}/mês
                    </span>
                  )}
                </div>
              )}
            </div>

            {company.plans && (
              <>
                <div>
                  <Label>Armazenamento</Label>
                  <div className="flex items-center gap-2">
                    <HardDrive className="h-4 w-4" />
                    <span>{formatBytes(company.current_storage_used_bytes)}</span>
                    <span className="text-gray-500">/ {company.plans.storage_limit_gb} GB</span>
                  </div>
                </div>

                <div>
                  <Label>Download Mensal</Label>
                  <div className="flex items-center gap-2">
                    <Download className="h-4 w-4" />
                    <span>{formatBytes(company.current_download_used_bytes)}</span>
                    <span className="text-gray-500">/ {company.plans.download_limit_gb} GB</span>
                  </div>
                </div>

                <div>
                  <Label>Usuários</Label>
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    <span className="font-medium">{company.active_users_count}</span>
                    <span className="text-gray-500">/ {company.plans.max_users}</span>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
