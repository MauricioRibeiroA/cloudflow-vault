import { useState, useEffect } from "react";
import { useAuth } from "@/components/auth/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { FileText, Search, Download, Calendar } from "lucide-react";
import { Navigate } from "react-router-dom";

interface LogEntry {
  id: string;
  user_id: string;
  action: string;
  target_type: string;
  target_id: string;
  target_name: string;
  details: any;
  created_at: string;
  profiles?: {
    full_name: string;
    email: string;
  } | null;
}

const Logs = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("");

  useEffect(() => {
    fetchCurrentProfile();
  }, [user]);

  useEffect(() => {
    if (profile) {
      fetchLogs();
    }
  }, [profile, actionFilter, dateFilter]);

  // Verificar permissões após carregar o perfil
  if (profile && !["admin", "rh", "ti"].includes(profile.group_name)) {
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

  const fetchLogs = async () => {
    try {
      let query = supabase
        .from("logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);

      if (actionFilter !== "all") {
        query = query.eq("action", actionFilter);
      }

      if (dateFilter) {
        const startDate = new Date(dateFilter);
        const endDate = new Date(dateFilter);
        endDate.setDate(endDate.getDate() + 1);
        
        query = query
          .gte("created_at", startDate.toISOString())
          .lt("created_at", endDate.toISOString());
      }

      const { data: logsData, error } = await query;

      if (error) throw error;

      // Get unique user IDs to fetch profiles
      const userIds = [...new Set(logsData?.map(log => log.user_id).filter(Boolean))];
      
      let profilesMap = new Map();
      if (userIds.length > 0) {
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("user_id, full_name, email")
          .in("user_id", userIds);
        
        profilesData?.forEach(profile => {
          profilesMap.set(profile.user_id, profile);
        });
      }

      // Merge logs with profiles
      const logsWithProfiles = logsData?.map(log => ({
        ...log,
        profiles: profilesMap.get(log.user_id) || null
      })) || [];

      setLogs(logsWithProfiles);
    } catch (error) {
      console.error("Erro ao carregar logs:", error);
    } finally {
      setLoading(false);
    }
  };


  const filteredLogs = logs.filter((log) =>
    searchTerm === "" ||
    log.profiles?.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.profiles?.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.target_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.action.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getActionBadge = (action: string) => {
    const variants = {
      file_upload: "default",
      file_download: "default", 
      file_delete: "destructive",
      folder_create: "default",
      folder_delete: "destructive",
      view: "secondary",
      edit: "outline",
      login: "default",
      logout: "secondary",
      profile_update: "outline",
      admin_profile_update: "destructive",
    } as const;

    const labels = {
      file_upload: "Upload",
      file_download: "Download",
      file_delete: "Exclusão de Arquivo",
      folder_create: "Criação de Pasta",
      folder_delete: "Exclusão de Pasta",
      view: "Visualização",
      edit: "Edição",
      login: "Login",
      logout: "Logout",
      profile_update: "Atualização de Perfil",
      admin_profile_update: "Atualização Admin",
    };

    return (
      <Badge variant={variants[action as keyof typeof variants] || "outline"}>
        {labels[action as keyof typeof labels] || action}
      </Badge>
    );
  };

  const getTargetTypeBadge = (targetType: string) => {
    const labels = {
      file: "Arquivo",
      folder: "Pasta",
      user: "Usuário",
      profiles: "Perfil",
      system: "Sistema",
    };

    return (
      <Badge variant="outline">
        {labels[targetType as keyof typeof labels] || targetType}
      </Badge>
    );
  };

  const exportLogs = () => {
    const csvContent = [
      ["Data/Hora", "Usuário", "Email", "Ação", "Tipo", "Alvo", "Detalhes"].join(","),
      ...filteredLogs.map(log => [
        new Date(log.created_at).toLocaleString("pt-BR"),
        log.profiles?.full_name || "Sistema",
        log.profiles?.email || "",
        log.action,
        log.target_type,
        log.target_name || "",
        JSON.stringify(log.details || {})
      ].map(field => `"${field}"`).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `logs_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
          <h1 className="text-3xl font-bold text-foreground">Logs do Sistema</h1>
          <p className="text-muted-foreground">
            Auditoria completa de todas as ações realizadas no sistema
          </p>
        </div>
        <Button onClick={exportLogs} variant="outline">
          <Download className="mr-2 h-4 w-4" />
          Exportar CSV
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Filtros de Busca
          </CardTitle>
          <CardDescription>
            Use os filtros abaixo para encontrar logs específicos
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="search">Buscar</Label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Usuário, email, arquivo..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="action">Tipo de Ação</Label>
              <Select value={actionFilter} onValueChange={setActionFilter}>
                <SelectTrigger id="action">
                  <SelectValue placeholder="Todas as ações" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as ações</SelectItem>
                  <SelectItem value="file_upload">Upload</SelectItem>
                  <SelectItem value="file_download">Download</SelectItem>
                  <SelectItem value="file_delete">Exclusão de Arquivo</SelectItem>
                  <SelectItem value="folder_create">Criação de Pasta</SelectItem>
                  <SelectItem value="folder_delete">Exclusão de Pasta</SelectItem>
                  <SelectItem value="view">Visualização</SelectItem>
                  <SelectItem value="login">Login</SelectItem>
                  <SelectItem value="logout">Logout</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="date">Data</Label>
              <div className="relative">
                <Calendar className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="date"
                  type="date"
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            Registros de Auditoria ({filteredLogs.length})
          </CardTitle>
          <CardDescription>
            Histórico de ações realizadas no sistema ordenado por data
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data/Hora</TableHead>
                <TableHead>Usuário</TableHead>
                <TableHead>Ação</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Alvo</TableHead>
                <TableHead>Detalhes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLogs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="font-mono text-sm">
                    {new Date(log.created_at).toLocaleString("pt-BR")}
                  </TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium">
                        {log.profiles?.full_name || "Sistema"}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {log.profiles?.email || `ID: ${log.user_id}`}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{getActionBadge(log.action)}</TableCell>
                  <TableCell>{getTargetTypeBadge(log.target_type)}</TableCell>
                  <TableCell>
                    <div className="max-w-[200px] truncate">
                      {log.target_name || log.target_id}
                    </div>
                  </TableCell>
                  <TableCell>
                    {log.details && Object.keys(log.details).length > 0 && (
                      <div className="text-sm text-muted-foreground max-w-[200px] truncate">
                        {JSON.stringify(log.details)}
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default Logs;