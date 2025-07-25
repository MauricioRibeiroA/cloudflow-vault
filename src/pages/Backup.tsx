import { useState, useEffect } from "react";
import { useAuth } from "@/components/auth/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { HardDrive, Play, Settings, Clock, CheckCircle, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { Navigate } from "react-router-dom";

const backupConfigSchema = z.object({
  enabled: z.boolean(),
  frequency: z.enum(["daily", "weekly", "monthly"]),
  destination: z.enum(["google_drive", "amazon_s3"]),
  time: z.string(),
  google_drive_folder_id: z.string().optional(),
  s3_bucket: z.string().optional(),
  s3_region: z.string().optional(),
});

type BackupConfigData = z.infer<typeof backupConfigSchema>;

interface BackupHistory {
  id: string;
  started_at: string;
  completed_at?: string;
  status: "running" | "completed" | "failed";
  destination: string;
  files_count: number;
  error_message?: string;
}

const Backup = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [configLoading, setConfigLoading] = useState(false);
  const [manualBackupLoading, setManualBackupLoading] = useState(false);
  const [lastBackup, setLastBackup] = useState<string | null>(null);
  const [backupHistory, setBackupHistory] = useState<BackupHistory[]>([]);

  const form = useForm<BackupConfigData>({
    resolver: zodResolver(backupConfigSchema),
    defaultValues: {
      enabled: false,
      frequency: "weekly",
      destination: "google_drive",
      time: "02:00",
    },
  });

  // Verificar permissões
  if (!profile || !["admin", "ti"].includes(profile.group_name)) {
    return <Navigate to="/dashboard" replace />;
  }

  const fetchCurrentProfile = async () => {
    if (user) {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user.id)
        .single();
      setProfile(data);
    }
  };

  const loadBackupConfig = async () => {
    try {
      const { data, error } = await supabase
        .from("settings")
        .select("*")
        .eq("key", "backup_config")
        .single();

      if (error && error.code !== "PGRST116") throw error;

      if (data?.value) {
        form.reset(data.value as BackupConfigData);
      }
    } catch (error) {
      console.error("Erro ao carregar configuração de backup:", error);
    }
  };

  const loadBackupHistory = async () => {
    try {
      // Simular histórico de backup - em produção isso viria do banco
      const mockHistory: BackupHistory[] = [
        {
          id: "1",
          started_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
          completed_at: new Date(Date.now() - 24 * 60 * 60 * 1000 + 5 * 60 * 1000).toISOString(),
          status: "completed",
          destination: "google_drive",
          files_count: 45,
        },
        {
          id: "2",
          started_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
          completed_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000 + 8 * 60 * 1000).toISOString(),
          status: "completed",
          destination: "google_drive",
          files_count: 42,
        },
        {
          id: "3",
          started_at: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
          status: "failed",
          destination: "amazon_s3",
          files_count: 0,
          error_message: "Credenciais inválidas",
        },
      ];

      setBackupHistory(mockHistory);
      
      const completed = mockHistory.find(h => h.status === "completed");
      if (completed) {
        setLastBackup(completed.completed_at || completed.started_at);
      }
    } catch (error) {
      console.error("Erro ao carregar histórico de backup:", error);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      await Promise.all([fetchCurrentProfile(), loadBackupConfig(), loadBackupHistory()]);
      setLoading(false);
    };
    loadData();
  }, [user]);

  const saveBackupConfig = async (data: BackupConfigData) => {
    setConfigLoading(true);
    try {
      const { error } = await supabase
        .from("settings")
        .upsert({
          key: "backup_config",
          value: data,
          updated_by: profile?.user_id,
        });

      if (error) throw error;

      toast.success("Configuração de backup salva com sucesso");
    } catch (error: any) {
      console.error("Erro ao salvar configuração:", error);
      toast.error(error.message || "Erro ao salvar configuração");
    } finally {
      setConfigLoading(false);
    }
  };

  const runManualBackup = async () => {
    setManualBackupLoading(true);
    try {
      // Simular execução de backup manual
      // Em produção, isso chamaria uma edge function
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      toast.success("Backup manual iniciado com sucesso");
      
      // Recarregar histórico
      await loadBackupHistory();
    } catch (error: any) {
      console.error("Erro ao executar backup:", error);
      toast.error(error.message || "Erro ao executar backup manual");
    } finally {
      setManualBackupLoading(false);
    }
  };

  const getFrequencyLabel = (frequency: string) => {
    const labels = {
      daily: "Diário",
      weekly: "Semanal",
      monthly: "Mensal",
    };
    return labels[frequency as keyof typeof labels] || frequency;
  };

  const getDestinationLabel = (destination: string) => {
    const labels = {
      google_drive: "Google Drive",
      amazon_s3: "Amazon S3",
    };
    return labels[destination as keyof typeof labels] || destination;
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      completed: "default",
      running: "outline",
      failed: "destructive",
    } as const;

    const labels = {
      completed: "Concluído",
      running: "Em execução",
      failed: "Falhou",
    };

    return (
      <Badge variant={variants[status as keyof typeof variants] || "outline"}>
        {labels[status as keyof typeof labels] || status}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Configuração de Backup</h1>
          <p className="text-muted-foreground">
            Configure backups automáticos e monitore o histórico de execução
          </p>
        </div>
        <Button
          onClick={runManualBackup}
          disabled={manualBackupLoading}
          className="flex items-center gap-2"
        >
          <Play className="h-4 w-4" />
          {manualBackupLoading ? "Executando..." : "Backup Manual"}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Último backup</p>
                <p className="font-medium">
                  {lastBackup 
                    ? new Date(lastBackup).toLocaleString("pt-BR")
                    : "Nenhum backup realizado"
                  }
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Status do serviço</p>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-success" />
                  <span className="text-success">Ativo</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Configuração
            </CardTitle>
            <CardDescription>
              Configure a frequência e destino dos backups automáticos
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(saveBackupConfig)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="enabled"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Backup automático</FormLabel>
                        <p className="text-sm text-muted-foreground">
                          Ativar execução automática de backups
                        </p>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="frequency"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Frequência</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione a frequência" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="daily">Diário</SelectItem>
                            <SelectItem value="weekly">Semanal</SelectItem>
                            <SelectItem value="monthly">Mensal</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="time"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Horário</FormLabel>
                        <FormControl>
                          <Input type="time" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="destination"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Destino</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione o destino" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="google_drive">Google Drive</SelectItem>
                          <SelectItem value="amazon_s3">Amazon S3</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {form.watch("destination") === "google_drive" && (
                  <FormField
                    control={form.control}
                    name="google_drive_folder_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>ID da Pasta Google Drive</FormLabel>
                        <FormControl>
                          <Input placeholder="ID da pasta de destino" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {form.watch("destination") === "amazon_s3" && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="s3_bucket"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Bucket S3</FormLabel>
                          <FormControl>
                            <Input placeholder="Nome do bucket" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="s3_region"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Região</FormLabel>
                          <FormControl>
                            <Input placeholder="us-east-1" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                )}

                <Button type="submit" disabled={configLoading}>
                  {configLoading ? "Salvando..." : "Salvar Configuração"}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HardDrive className="h-5 w-5" />
            Histórico de Backups
          </CardTitle>
          <CardDescription>
            Últimas execuções de backup realizadas
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {backupHistory.map((backup) => (
              <div
                key={backup.id}
                className="flex items-center justify-between p-4 border rounded-lg"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium">
                      {new Date(backup.started_at).toLocaleString("pt-BR")}
                    </p>
                    {getStatusBadge(backup.status)}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Destino: {getDestinationLabel(backup.destination)} • {backup.files_count} arquivos
                  </p>
                  {backup.error_message && (
                    <p className="text-sm text-destructive">
                      Erro: {backup.error_message}
                    </p>
                  )}
                </div>
                <div className="text-right">
                  {backup.completed_at && (
                    <p className="text-sm text-muted-foreground">
                      Duração: {Math.round(
                        (new Date(backup.completed_at).getTime() - 
                         new Date(backup.started_at).getTime()) / 1000 / 60
                      )} min
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Backup;