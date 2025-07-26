import { useState, useEffect } from 'react';
import { useAuth } from '@/components/auth/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { Settings, Save, HardDrive } from 'lucide-react';

interface SystemSettings {
  storage_limit_gb: number;
}

const SettingsPage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [settings, setSettings] = useState<SystemSettings>({
    storage_limit_gb: 20
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (user) {
      checkAdminStatus();
      fetchSettings();
    }
  }, [user]);

  const checkAdminStatus = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('group_name')
        .eq('user_id', user?.id)
        .single();

      if (error) throw error;
      setIsAdmin(data.group_name === 'admin');
    } catch (error: any) {
      console.error('Error checking admin status:', error);
    }
  };

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('settings')
        .select('key, value')
        .eq('key', 'storage_limit_gb')
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      
      if (data?.value) {
        setSettings({
          storage_limit_gb: Number(data.value)
        });
      }
    } catch (error: any) {
      console.error('Error fetching settings:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar as configurações.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!isAdmin) {
      toast({
        title: "Acesso negado",
        description: "Apenas administradores podem alterar as configurações.",
        variant: "destructive"
      });
      return;
    }

    if (settings.storage_limit_gb < 1 || settings.storage_limit_gb > 1000) {
      toast({
        title: "Valor inválido",
        description: "O limite de armazenamento deve estar entre 1GB e 1000GB.",
        variant: "destructive"
      });
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('settings')
        .upsert({
          key: 'storage_limit_gb',
          value: settings.storage_limit_gb.toString(),
          updated_by: user?.id
        });

      if (error) throw error;

      toast({
        title: "Configurações salvas",
        description: "As configurações do sistema foram atualizadas com sucesso.",
      });
    } catch (error: any) {
      console.error('Error saving settings:', error);
      toast({
        title: "Erro",
        description: "Não foi possível salvar as configurações.",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const handleStorageLimitChange = (value: string) => {
    const numValue = parseInt(value);
    if (!isNaN(numValue)) {
      setSettings(prev => ({
        ...prev,
        storage_limit_gb: numValue
      }));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Configurações</h1>
          <p className="text-muted-foreground">
            Configurações do sistema
          </p>
        </div>
        <Alert variant="destructive">
          <AlertDescription>
            Acesso negado. Apenas administradores podem acessar as configurações do sistema.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Configurações do Sistema</h1>
        <p className="text-muted-foreground">
          Gerencie as configurações globais do sistema
        </p>
      </div>

      {/* Storage Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HardDrive className="h-5 w-5" />
            Configurações de Armazenamento
          </CardTitle>
          <CardDescription>
            Configure os limites de armazenamento do sistema
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="storage-limit">Limite de Armazenamento (GB)</Label>
            <Input
              id="storage-limit"
              type="number"
              min="1"
              max="1000"
              value={settings.storage_limit_gb}
              onChange={(e) => handleStorageLimitChange(e.target.value)}
              placeholder="20"
            />
            <p className="text-sm text-muted-foreground">
              Define o limite máximo de armazenamento em gigabytes. 
              Valores entre 1GB e 1000GB são aceitos.
            </p>
          </div>

          <div className="pt-4">
            <Button 
              onClick={handleSave} 
              disabled={saving}
              className="w-full sm:w-auto"
            >
              <Save className="mr-2 h-4 w-4" />
              {saving ? 'Salvando...' : 'Salvar Configurações'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* System Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Informações do Sistema
          </CardTitle>
          <CardDescription>
            Configurações atuais do sistema
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-sm font-medium">Limite de Armazenamento</Label>
              <p className="text-lg font-semibold">{settings.storage_limit_gb} GB</p>
            </div>
            <div>
              <Label className="text-sm font-medium">Equivalente em Bytes</Label>
              <p className="text-lg font-semibold">
                {(settings.storage_limit_gb * 1024 * 1024 * 1024).toLocaleString()} bytes
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SettingsPage;