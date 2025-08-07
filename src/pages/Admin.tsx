import { useState, useEffect } from "react";
import { useAuth } from "@/components/auth/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, UserPlus, Edit, LogOut, Clock, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Navigate } from "react-router-dom";

interface Profile {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  group_name: string;
  status: string;
  department_id?: string;
  position_id?: string;
  department?: { id: string; name: string };
  position?: { id: string; name: string };
  created_at: string;
}

interface Invitation {
  id: string;
  email: string;
  full_name: string;
  group_name: string;
  status: string;
  department_id?: string;
  position_id?: string;
  department?: { id: string; name: string };
  position?: { id: string; name: string };
  created_at: string;
  expires_at: string;
  invited_by: string;
}

interface Department {
  id: string;
  name: string;
}

interface Position {
  id: string;
  name: string;
  department_id: string;
}

const Admin = () => {
  const { user, signOut } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<Profile | null>(null);
  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    password: "",
    group_name: "user",
    status: "active",
    department_id: "",
    position_id: "",
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
        .select(`
          *,
          department:departments(id, name),
          position:positions(id, name)
        `)
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

  const fetchInvitations = async () => {
    try {
      const { data, error } = await supabase
        .from("user_invitations")
        .select(`
          *,
          department:departments(id, name),
          position:positions(id, name)
        `)
        .in('status', ['pending', 'email_sent'])
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Erro ao carregar convites:", error);
        return;
      }
      
      setInvitations(data || []);
    } catch (error) {
      console.error("Erro ao carregar convites:", error);
    }
  };

  const fetchDepartmentsAndPositions = async () => {
    try {
      // Fetch departments
      const { data: deptData } = await supabase
        .from("departments")
        .select("*")
        .order("name");
      setDepartments(deptData || []);

      // Fetch positions
      const { data: posData } = await supabase
        .from("positions")
        .select("*")
        .order("name");
      setPositions(posData || []);
    } catch (error) {
      console.error("Erro ao carregar setores e cargos:", error);
    }
  };

  useEffect(() => {
    fetchCurrentProfile();
    fetchProfiles();
    fetchInvitations();
    fetchDepartmentsAndPositions();
  }, [user]);

  const handleCreateUser = async () => {
    try {
      console.log("🚀 Iniciando criação de perfil de usuário com envio de email...");
      
      // Validações básicas
      if (!formData.full_name || !formData.email) {
        throw new Error("Por favor, preencha nome completo e email");
      }

      console.log("👤 Criando perfil e enviando convite por email...");
      
      // Usar a nova função que envia email automaticamente
      const { data, error } = await supabase.rpc('admin_create_user_with_email', {
        p_email: formData.email,
        p_full_name: formData.full_name,
        p_group_name: formData.group_name,
        p_department_id: formData.department_id || null,
        p_position_id: formData.position_id || null
      });

      if (error) {
        console.error("❌ Erro ao criar perfil:", error);
        throw new Error(error.message || 'Erro ao criar perfil do usuário');
      }

      if (!data || !data.success) {
        throw new Error(data?.message || 'Falha na criação do perfil');
      }

      console.log("✅ Perfil criado com sucesso:", data);
      
      // Verificar se precisa enviar email
      if (data.should_send_email) {
        console.log("📧 Enviando email via Edge Function (solução CORS)...");
        
        try {
          // Chamar Edge Function usando supabase.functions.invoke
          console.log(`📡 Invocando Edge Function: send-invitation-email`);
          
          const { data: emailResult, error: emailError } = await supabase.functions.invoke('send-invitation-email', {
            body: {
              email: data.email,
              fullName: data.full_name,
              companyName: data.company_name,
              inviteLink: data.invite_link
            }
          });
          
          console.log('📧 Resposta da Edge Function:', { emailResult, emailError });
          
          if (emailError) {
            console.error('❌ emailError:', emailError);
            throw new Error(`Edge Function error: ${emailError.message || JSON.stringify(emailError)}`);
          }
          
          if (!emailResult) {
            throw new Error('Edge Function retornou resposta vazia');
          }
          
          // Verificar se a resposta indica sucesso
          if (emailResult.success === true) {
            // ✅ EMAIL ENVIADO COM SUCESSO VIA RESEND
            console.log("✅ Email enviado com sucesso via Edge Function:", emailResult);
            
            // Atualizar status no banco
            await supabase.rpc('update_invitation_email_status', {
              p_invitation_id: data.invitation_id,
              p_email_sent: true,
              p_email_id: emailResult.emailId
            });
            
            toast.success(
              `🎉 Usuário ${data.full_name} criado e email enviado via Resend!`,
              {
                description: `📧 Email de convite enviado automaticamente para ${data.email} via Edge Function + Resend API. O usuário deve verificar a caixa de entrada (e spam) para completar o cadastro.`,
                duration: 6000,
              }
            );
          } else {
            // ❌ EMAIL FALHOU - MOSTRAR DETALHES COMPLETOS
            console.error('❌ DETALHES COMPLETOS DO ERRO DA EDGE FUNCTION:');
            console.error('- emailResult completo:', emailResult);
            console.error('- emailResult.error:', emailResult?.error);
            console.error('- emailResult.details:', emailResult?.details);
            console.error('- emailResult.httpStatus:', emailResult?.httpStatus);
            console.error('- emailResult.resendError (JSON):', JSON.stringify(emailResult?.resendError, null, 2));
            console.error('- emailResult.debugInfo (JSON):', JSON.stringify(emailResult?.debugInfo, null, 2));
            
            const errorMsg = emailResult ? 
              (emailResult.error || emailResult.details || `Falha no envio: ${JSON.stringify(emailResult)}`) : 
              'Edge Function retornou resposta vazia';
            console.error('❌ Mensagem de erro final:', errorMsg);
            throw new Error(errorMsg);
          }
          
        } catch (emailError: any) {
          console.error("❌ Erro ao enviar email via Edge Function:", emailError);
          
          // Determinar mensagem de erro adequada
          let errorMessage = 'Erro desconhecido no envio de email';
          if (emailError && emailError.message) {
            errorMessage = emailError.message;
          } else if (emailError && typeof emailError === 'string') {
            errorMessage = emailError;
          }
          
          // Atualizar status no banco (email falhou)
          await supabase.rpc('update_invitation_email_status', {
            p_invitation_id: data.invitation_id,
            p_email_sent: false,
            p_error_message: errorMessage
          });
          
          // Mostrar erro com link manual
          const completionLink = data.invite_link;
          
          toast.error(
            `⚠️ Usuário ${data.full_name} criado, mas email não foi enviado`,
            {
              description: `Problema: ${errorMessage}. Use o link manual: ${completionLink}`,
              duration: 10000,
              action: {
                label: "Copiar Link",
                onClick: () => {
                  navigator.clipboard.writeText(completionLink);
                  toast.success("Link copiado!");
                }
              }
            }
          );
        }
      } else {
        // Fallback - email já foi enviado ou não deve ser enviado
        const completionLink = data.invite_link;
        
        toast.success(
          `✅ Usuário ${data.full_name} criado com sucesso!`,
          {
            description: `Link de convite: ${completionLink}`,
            duration: 8000,
            action: {
              label: "Copiar Link",
              onClick: () => {
                navigator.clipboard.writeText(completionLink);
                toast.success("Link copiado!");
              }
            }
          }
        );
      }
      
      setDialogOpen(false);
      resetForm();
      fetchProfiles();
      fetchInvitations();
      
    } catch (error: any) {
      console.error("💥 Erro ao criar perfil:", error);
      toast.error(error.message || "Erro ao criar perfil do usuário");
    }
  };

  const handleUpdateUser = async () => {
    if (!editingUser) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: formData.full_name,
          email: formData.email,
          group_name: formData.group_name,
          status: formData.status,
          department_id: formData.department_id || null,
          position_id: formData.position_id || null,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', editingUser.user_id);

      if (error) throw error;

      toast.success("Usuário atualizado com sucesso");
      setDialogOpen(false);
      setEditingUser(null);
      resetForm();
      fetchProfiles();
    } catch (error: any) {
      console.error("Erro ao atualizar usuário:", error);
      toast.error(error.message || "Erro ao atualizar usuário");
    }
  };

  const handleToggleStatus = async (user: Profile) => {
    try {
      const newStatus = user.status === "active" ? "inactive" : "active";
      
      const { error } = await supabase
        .from('profiles')
        .update({ 
          status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', user.user_id);

      if (error) throw error;

      toast.success(`Usuário ${newStatus === "active" ? "ativado" : "desativado"} com sucesso`);
      fetchProfiles();
    } catch (error: any) {
      console.error("Erro ao alterar status:", error);
      toast.error(error.message || "Erro ao alterar status do usuário");
    }
  };

  const handleDeleteInvitation = async (invitation: Invitation) => {
    try {
      const { data, error } = await supabase.rpc('delete_invitation', {
        p_invitation_id: invitation.id
      });

      if (error) {
        console.error("Erro ao deletar convite:", error);
        throw new Error(error.message || 'Erro ao deletar convite');
      }

      if (!data || !data.success) {
        throw new Error(data?.message || 'Falha ao deletar convite');
      }

      toast.success(`Convite para ${invitation.full_name} (${invitation.email}) excluído com sucesso!`);
      fetchInvitations();
      
    } catch (error: any) {
      console.error("Erro ao deletar convite:", error);
      toast.error(error.message || "Erro ao excluir convite");
    }
  };

  const resetForm = () => {
    setFormData({
      full_name: "",
      email: "",
      password: "",
      group_name: "user",
      status: "active",
      department_id: "",
      position_id: "",
    });
  };

  const openCreateDialog = () => {
    setEditingUser(null);
    resetForm();
    setDialogOpen(true);
  };

  const openEditDialog = (user: Profile) => {
    setEditingUser(user);
    setFormData({
      full_name: user.full_name,
      email: user.email,
      password: "",
      group_name: user.group_name,
      status: user.status,
      department_id: user.department_id || "",
      position_id: user.position_id || "",
    });
    setDialogOpen(true);
  };

  const getFilteredPositions = () => {
    if (!formData.department_id) return [];
    return positions.filter(pos => pos.department_id === formData.department_id);
  };

  const getGroupBadge = (group: string) => {
    const variants = {
      super_admin: "destructive",
      company_admin: "default",
      hr: "secondary",
      user: "outline",
    } as const;

    const labels = {
      super_admin: "Gestor do Sistema",
      company_admin: "Admin da Empresa",
      hr: "RH",
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
  if (!loading && profile && !["company_admin", "super_admin", "hr"].includes(profile.group_name)) {
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
          <h1 className="text-3xl font-bold text-foreground">Colaboradores</h1>
          <p className="text-muted-foreground">
            Gerencie usuários, grupos e permissões do sistema
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={openCreateDialog}>
                <UserPlus className="mr-2 h-4 w-4" />
                Novo Usuário
              </Button>
            </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
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
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="full_name">Nome Completo</Label>
                  <Input
                    id="full_name"
                    value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    placeholder="Nome completo"
                  />
                </div>
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="email@exemplo.com"
                    disabled={!!editingUser}
                  />
                </div>
              </div>

              {!editingUser && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-md">
                  <p className="text-sm text-green-800">
                    <strong>📧 Envio automático:</strong> Um email de convite será enviado automaticamente para <strong>{formData.email || 'o email fornecido'}</strong> com todas as instruções para completar o cadastro.
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="group">Grupo de Acesso</Label>
                  <Select
                    value={formData.group_name}
                    onValueChange={(value) =>
                      setFormData({ ...formData, group_name: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="user">Usuário</SelectItem>
                      {(profile?.group_name === "company_admin" || profile?.group_name === "super_admin") && (
                        <SelectItem value="hr">RH</SelectItem>
                      )}
                      {(profile?.group_name === "company_admin" || profile?.group_name === "super_admin") && (
                        <SelectItem value="company_admin">Admin da Empresa</SelectItem>
                      )}
                      {profile?.group_name === "super_admin" && (
                        <SelectItem value="super_admin">Gestor do Sistema</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="status">Status</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value) =>
                      setFormData({ ...formData, status: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Ativo</SelectItem>
                      <SelectItem value="inactive">Inativo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="department">Setor</Label>
                  <Select
                    value={formData.department_id}
                    onValueChange={(value) => {
                      setFormData({ 
                        ...formData, 
                        department_id: value,
                        position_id: "" // Reset position when department changes
                      });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um setor" />
                    </SelectTrigger>
                    <SelectContent>
                      {departments.map((dept) => (
                        <SelectItem key={dept.id} value={dept.id}>
                          {dept.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="position">Cargo</Label>
                  <Select
                    value={formData.position_id}
                    onValueChange={(value) =>
                      setFormData({ ...formData, position_id: value })
                    }
                    disabled={!formData.department_id}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um cargo" />
                    </SelectTrigger>
                    <SelectContent>
                      {getFilteredPositions().map((pos) => (
                        <SelectItem key={pos.id} value={pos.id}>
                          {pos.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex justify-end space-x-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                >
                  Cancelar
                </Button>
                <Button onClick={editingUser ? handleUpdateUser : handleCreateUser}>
                  {editingUser ? "Atualizar" : "Criar"}
                </Button>
              </div>
            </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {invitations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Convites Pendentes ({invitations.length})
            </CardTitle>
            <CardDescription>
              Usuários que foram convidados mas ainda não completaram o cadastro
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Setor</TableHead>
                  <TableHead>Cargo</TableHead>
                  <TableHead>Grupo</TableHead>
                  <TableHead>Criado em</TableHead>
                  <TableHead>Expira em</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invitations.map((invitation) => {
                  const isExpired = new Date(invitation.expires_at) < new Date();
                  
                  return (
                    <TableRow key={invitation.id}>
                      <TableCell className="font-medium">{invitation.full_name}</TableCell>
                      <TableCell>{invitation.email}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {invitation.department?.name || 'Não definido'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {invitation.position?.name || 'Não definido'}
                        </Badge>
                      </TableCell>
                      <TableCell>{getGroupBadge(invitation.group_name)}</TableCell>
                      <TableCell>
                        {new Date(invitation.created_at).toLocaleDateString("pt-BR")}
                      </TableCell>
                      <TableCell>
                        <Badge variant={isExpired ? "destructive" : "secondary"}>
                          {isExpired ? "Expirado" : new Date(invitation.expires_at).toLocaleDateString("pt-BR")}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              const completionLink = `${window.location.origin}/complete-signup?email=${encodeURIComponent(invitation.email)}`;
                              navigator.clipboard.writeText(completionLink);
                              toast.success("Link copiado!");
                            }}
                          >
                            <Send className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleDeleteInvitation(invitation)}
                            title="Excluir convite"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

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
                <TableHead>Setor</TableHead>
                <TableHead>Cargo</TableHead>
                <TableHead>Grupo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Data de Criação</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {profiles.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.full_name}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {user.department?.name || 'Não definido'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {user.position?.name || 'Não definido'}
                    </Badge>
                  </TableCell>
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
              {profiles.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground">
                    Nenhum usuário encontrado
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default Admin;