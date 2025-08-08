import React, { useState, useEffect } from 'react';
import { useAuth } from '@/components/auth/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  HardDrive, 
  Users, 
  Download,
  CreditCard,
  Shield,
  Zap,
  Headphones,
  Code,
  BarChart,
  Link,
  Palette,
  TrendingUp,
  Crown,
  Check,
  Star
} from 'lucide-react';

// Type definitions
interface Plan {
  id: string;
  name: string;
  price_brl: number;
  storage_limit_gb: number;
  download_limit_gb: number;
  max_users: number;
}

interface Addon {
  id: string;
  name: string;
  description: string;
  type: string;
  price_brl: number;
  billing_type: string;
  storage_gb: number;
  download_gb: number;
  additional_users: number;
  is_stackable: boolean;
  display_order: number;
  icon_name: string;
  color_class: string;
}

interface ComboPackage {
  id: string;
  name: string;
  description: string;
  price_brl: number;
  discount_percentage: number;
  total_storage_gb: number;
  total_download_gb: number;
  total_additional_users: number;
  includes_daily_backup: boolean;
  includes_priority_support: boolean;
  ondemand_backups_included: number;
  display_order: number;
  icon_name: string;
  color_class: string;
  is_popular: boolean;
}

const getIcon = (iconName: string) => {
  const icons = {
    HardDrive,
    Download,
    Users,
    Shield,
    Zap,
    Headphones,
    Code,
    BarChart,
    Link,
    Palette,
    TrendingUp,
    Crown
  };
  return icons[iconName as keyof typeof icons] || HardDrive;
};

export default function Upgrades() {
  const { user } = useAuth();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [addons, setAddons] = useState<Addon[]>([]);
  const [combos, setCombos] = useState<ComboPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // Load plans (excluding Free Trial)
      const { data: plansData, error: plansError } = await supabase
        .from('plans')
        .select('*')
        .gt('price_brl', 0)
        .order('price_brl', { ascending: true });

      if (plansError) throw plansError;

      // Load add-ons
      const { data: addonsData, error: addonsError } = await supabase
        .from('addons')
        .select('*')
        .eq('is_active', true)
        .order('display_order', { ascending: true });

      if (addonsError) throw addonsError;

      // Load combo packages
      const { data: combosData, error: combosError } = await supabase
        .from('combo_packages')
        .select('*')
        .eq('is_active', true)
        .order('display_order', { ascending: true });

      if (combosError) throw combosError;

      setPlans(plansData || []);
      setAddons(addonsData || []);
      setCombos(combosData || []);
    } catch (err: any) {
      setError(err.message);
      console.error('Erro ao carregar dados:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(amount);
  };

  const getBillingText = (billingType: string) => {
    switch (billingType) {
      case 'monthly': return '/mês';
      case 'per_use': return '/uso';
      case 'one_time': return 'única';
      default: return '';
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4">Upgrades & Add-ons</h1>
        <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
          Expanda suas funcionalidades com nossos planos e add-ons flexíveis. 
          Escolha apenas o que precisa e pague conforme usa.
        </p>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
          Erro: {error}
        </div>
      )}

      <Tabs defaultValue="plans" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="plans">Planos Base</TabsTrigger>
          <TabsTrigger value="addons">Add-ons Individuais</TabsTrigger>
          <TabsTrigger value="combos">Pacotes Combo</TabsTrigger>
        </TabsList>

        {/* Base Plans Section */}
        <TabsContent value="plans" className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold mb-2">Planos Base</h2>
            <p className="text-muted-foreground mb-6">
              Escolha o plano que melhor atende às necessidades da sua empresa
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {plans.map((plan) => (
              <Card key={plan.id} className="relative">
                <CardHeader className="text-center">
                  <CardTitle className="text-2xl">{plan.name}</CardTitle>
                  <div className="text-4xl font-bold text-primary">
                    {formatCurrency(plan.price_brl)}
                    <span className="text-sm text-muted-foreground">/mês</span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center">
                      <HardDrive className="w-4 h-4 text-green-500 mr-2" />
                      {plan.storage_limit_gb} GB de armazenamento
                    </div>
                    <div className="flex items-center">
                      <Users className="w-4 h-4 text-green-500 mr-2" />
                      {plan.max_users} usuários
                    </div>
                    <div className="flex items-center">
                      <Download className="w-4 h-4 text-green-500 mr-2" />
                      {plan.download_limit_gb} GB/mês de download
                    </div>
                  </div>
                  <Button className="w-full">Contratar Plano</Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Individual Add-ons Section */}
        <TabsContent value="addons" className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold mb-2">Add-ons Individuais</h2>
            <p className="text-muted-foreground mb-6">
              Expanda funcionalidades específicas conforme sua necessidade
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {addons.map((addon) => {
              const IconComponent = getIcon(addon.icon_name);
              return (
                <Card key={addon.id} className="hover:shadow-md transition-shadow">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className={`p-2 rounded-lg ${addon.color_class}`}>
                        <IconComponent className="w-6 h-6 text-white" />
                      </div>
                      {addon.is_stackable && (
                        <Badge variant="secondary">Empilhável</Badge>
                      )}
                    </div>
                    <CardTitle className="text-lg">{addon.name}</CardTitle>
                    <CardDescription>{addon.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-baseline justify-between">
                      <span className="text-2xl font-bold">
                        {formatCurrency(addon.price_brl)}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {getBillingText(addon.billing_type)}
                      </span>
                    </div>
                    
                    {/* Show what this add-on provides */}
                    {(addon.storage_gb > 0 || addon.download_gb > 0 || addon.additional_users > 0) && (
                      <div className="space-y-1 text-sm">
                        {addon.storage_gb > 0 && (
                          <div className="flex items-center">
                            <Check className="w-3 h-3 text-green-500 mr-1" />
                            +{addon.storage_gb} GB armazenamento
                          </div>
                        )}
                        {addon.download_gb > 0 && (
                          <div className="flex items-center">
                            <Check className="w-3 h-3 text-green-500 mr-1" />
                            +{addon.download_gb} GB download mensal
                          </div>
                        )}
                        {addon.additional_users > 0 && (
                          <div className="flex items-center">
                            <Check className="w-3 h-3 text-green-500 mr-1" />
                            +{addon.additional_users} usuário{addon.additional_users > 1 ? 's' : ''}
                          </div>
                        )}
                      </div>
                    )}
                    
                    <Button className="w-full" variant="outline">
                      Adicionar
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* Combo Packages Section */}
        <TabsContent value="combos" className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold mb-2">Pacotes Combo</h2>
            <p className="text-muted-foreground mb-6">
              Economize combinando múltiplos add-ons em pacotes especiais
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {combos.map((combo) => {
              const IconComponent = getIcon(combo.icon_name);
              return (
                <Card key={combo.id} className={`relative ${combo.is_popular ? 'ring-2 ring-primary' : ''}`}>
                  {combo.is_popular && (
                    <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                      <Badge className="bg-primary text-primary-foreground">
                        <Star className="w-3 h-3 mr-1" />
                        Mais Popular
                      </Badge>
                    </div>
                  )}
                  
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className={`p-3 rounded-lg ${combo.color_class}`}>
                        <IconComponent className="w-8 h-8 text-white" />
                      </div>
                      {combo.discount_percentage > 0 && (
                        <Badge variant="destructive">
                          -{combo.discount_percentage.toFixed(0)}%
                        </Badge>
                      )}
                    </div>
                    <CardTitle className="text-xl">{combo.name}</CardTitle>
                    <CardDescription>{combo.description}</CardDescription>
                  </CardHeader>
                  
                  <CardContent className="space-y-4">
                    <div className="flex items-baseline justify-between">
                      <span className="text-3xl font-bold">
                        {formatCurrency(combo.price_brl)}
                      </span>
                      <span className="text-sm text-muted-foreground">/mês</span>
                    </div>
                    
                    {/* Show what this combo includes */}
                    <div className="space-y-2 text-sm">
                      {combo.total_storage_gb > 0 && (
                        <div className="flex items-center">
                          <Check className="w-4 h-4 text-green-500 mr-2" />
                          +{combo.total_storage_gb} GB armazenamento
                        </div>
                      )}
                      {combo.total_download_gb > 0 && (
                        <div className="flex items-center">
                          <Check className="w-4 h-4 text-green-500 mr-2" />
                          +{combo.total_download_gb} GB download mensal
                        </div>
                      )}
                      {combo.total_additional_users > 0 && (
                        <div className="flex items-center">
                          <Check className="w-4 h-4 text-green-500 mr-2" />
                          +{combo.total_additional_users} usuários
                        </div>
                      )}
                      {combo.includes_daily_backup && (
                        <div className="flex items-center">
                          <Check className="w-4 h-4 text-green-500 mr-2" />
                          Backup diário automático
                        </div>
                      )}
                      {combo.includes_priority_support && (
                        <div className="flex items-center">
                          <Check className="w-4 h-4 text-green-500 mr-2" />
                          Suporte prioritário
                        </div>
                      )}
                      {combo.ondemand_backups_included > 0 && (
                        <div className="flex items-center">
                          <Check className="w-4 h-4 text-green-500 mr-2" />
                          {combo.ondemand_backups_included} backups sob demanda/mês
                        </div>
                      )}
                    </div>
                    
                    <Button className="w-full" size="lg">
                      Contratar Combo
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
