import { useState, useEffect } from "react";
import { useAuth } from "@/components/auth/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Users, UserPlus, Edit, Trash2, Shield } from "lucide-react";
import { toast } from "sonner";
import { Navigate } from "react-router-dom";

interface Profile {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  group_name: string;
  status: string;
  created_at: string;
}

const userFormSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(8, "Senha deve ter pelo menos 8 caracteres").optional(),
  full_name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  group_name: z.enum(["user", "rh", "admin", "ti"]),
  status: z.enum(["active", "inactive"]),
});

type UserFormData = z.infer<typeof userFormSchema>;

const Admin = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<Profile | null>(null);

  const form = useForm<UserFormData>({
    resolver: zodResolver(userFormSchema),
    defaultValues: {
      email: "",
      password: "",
      full_name: "",
      group_name: "user",
      status: "active",
    },
  });

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

  const fetchProfiles = async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setProfiles(data || []);
    } catch (error) {
      console.error("Erro ao carregar usuários:", error);
      toast.error("Erro ao carregar usuários");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCurrentProfile();
    fetchProfiles();
  }, [user]);

  const handleCreateUser = async (data: UserFormData) => {
    try {
      // Criar usuário no auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: data.email,
        password: data.password || "",
        options: {
          data: {
            full_name: data.full_name,
            group_name: data.group_name,
          },
        },
      });

      if (authError) throw authError;

      if (authData.user) {
        // Atualizar perfil diretamente usando função admin
        const { error: updateError } = await supabase.rpc("admin_update_profile", {
          p_user_id: authData.user.id,
          p_full_name: data.full_name,
          p_email: data.email,
          p_group_name: data.group_name,
          p_status: data.status,
        });

        if (updateError) throw updateError;
      }

      toast.success("Usuário criado com sucesso");
      setDialogOpen(false);
      form.reset();
      fetchProfiles();
    } catch (error: any) {
      console.error("Erro ao criar usuário:", error);
      toast.error(error.message || "Erro ao criar usuário");
    }
  };

  const handleUpdateUser = async (data: UserFormData) => {
    if (!editingUser) return;

    try {
      const { error } = await supabase.rpc("admin_update_profile", {
        p_user_id: editingUser.user_id,
        p_full_name: data.full_name,
        p_email: data.email,
        p_group_name: data.group_name,
        p_status: data.status,
      });

      if (error) throw error;

      toast.success("Usuário atualizado com sucesso");
      setDialogOpen(false);
      setEditingUser(null);
      form.reset();
      fetchProfiles();
    } catch (error: any) {
      console.error("Erro ao atualizar usuário:", error);
      toast.error(error.message || "Erro ao atualizar usuário");
    }
  };

  const handleToggleStatus = async (user: Profile) => {
    try {
      const newStatus = user.status === "active" ? "inactive" : "active";
      
      const { error } = await supabase.rpc("admin_update_profile", {
        p_user_id: user.user_id,
        p_status: newStatus,
      });

      if (error) throw error;

      toast.success(`Usuário ${newStatus === "active" ? "ativado" : "desativado"} com sucesso`);
      fetchProfiles();
    } catch (error: any) {
      console.error("Erro ao alterar status:", error);
      toast.error(error.message || "Erro ao alterar status do usuário");
    }
  };

  const openCreateDialog = () => {
    setEditingUser(null);
    form.reset({
      email: "",
      password: "",
      full_name: "",
      group_name: "user",
      status: "active",
    });
    setDialogOpen(true);
  };

  const openEditDialog = (user: Profile) => {
    setEditingUser(user);
    form.reset({
      email: user.email,
      password: "", // Não mostrar senha atual
      full_name: user.full_name,
      group_name: user.group_name as any,
      status: user.status as any,
    });
    setDialogOpen(true);
  };

  const getGroupBadge = (group: string) => {
    const variants = {
      admin: "destructive",
      rh: "default",
      ti: "secondary",
      user: "outline",
    } as const;

    const labels = {
      admin: "Admin",
      rh: "RH",
      ti: "TI",
      user: "Usuário",
    };

    return (
      <Badge variant={variants[group as keyof typeof variants] || "outline"}>
        {labels[group as keyof typeof labels] || group}
      </Badge>
    );
  };

  const getStatusBadge = (status: string) => {
    return (
      <Badge variant={status === "active" ? "default" : "secondary"}>
        {status === "active" ? "Ativo" : "Inativo"}
      </Badge>
    );
  };

  // Verificar permissões após carregar dados
  if (!loading && profile && !["admin", "rh"].includes(profile.group_name)) {
    return <Navigate to="/dashboard" replace />;
  }

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
          <h1 className="text-3xl font-bold text-foreground">Administração de Usuários</h1>
          <p className="text-muted-foreground">
            Gerencie usuários, grupos e permissões do sistema
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreateDialog}>
              <UserPlus className="mr-2 h-4 w-4" />
              Novo Usuário
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>
                {editingUser ? "Editar Usuário" : "Criar Novo Usuário"}
              </DialogTitle>
              <DialogDescription>
                {editingUser 
                  ? "Atualize as informações do usuário." 
                  : "Adicione um novo usuário ao sistema."}
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(editingUser ? handleUpdateUser : handleCreateUser)}
                className="space-y-4"
              >
                <FormField
                  control={form.control}
                  name="full_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome Completo</FormLabel>
                      <FormControl>
                        <Input placeholder="Digite o nome completo" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="Digite o email"
                          {...field}
                          disabled={!!editingUser}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {!editingUser && (
                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Senha</FormLabel>
                        <FormControl>
                          <Input
                            type="password"
                            placeholder="Digite a senha"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
                <FormField
                  control={form.control}
                  name="group_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Grupo</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione o grupo" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="user">Usuário</SelectItem>
                          <SelectItem value="rh">RH</SelectItem>
                          <SelectItem value="ti">TI</SelectItem>
                          {profile?.group_name === "admin" && (
                            <SelectItem value="admin">Admin</SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione o status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="active">Ativo</SelectItem>
                          <SelectItem value="inactive">Inativo</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex justify-end space-x-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setDialogOpen(false)}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit">
                    {editingUser ? "Atualizar" : "Criar"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Usuários Cadastrados ({profiles.length})
          </CardTitle>
          <CardDescription>
            Lista de todos os usuários com suas respectivas informações e permissões
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Grupo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Criado em</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {profiles.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.full_name}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>{getGroupBadge(user.group_name)}</TableCell>
                  <TableCell>{getStatusBadge(user.status)}</TableCell>
                  <TableCell>
                    {new Date(user.created_at).toLocaleDateString("pt-BR")}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openEditDialog(user)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant={user.status === "active" ? "secondary" : "default"}
                        onClick={() => handleToggleStatus(user)}
                      >
                        {user.status === "active" ? "Desativar" : "Ativar"}
                      </Button>
                    </div>
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

export default Admin;