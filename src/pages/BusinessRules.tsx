import { useState, useEffect } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/components/auth/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Edit, Trash2, Building2, Briefcase } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Department {
  id: string;
  name: string;
  description?: string;
  created_at: string;
}

interface Position {
  id: string;
  name: string;
  description?: string;
  department_id: string;
  created_at: string;
}

export default function BusinessRules() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [activeTab, setActiveTab] = useState<'departments' | 'positions'>('departments');
  
  // Form states
  const [departmentForm, setDepartmentForm] = useState({ name: '', description: '' });
  const [positionForm, setPositionForm] = useState({ name: '', description: '', department_id: '' });
  const [editingDepartment, setEditingDepartment] = useState<Department | null>(null);
  const [editingPosition, setEditingPosition] = useState<Position | null>(null);
  const [showDepartmentDialog, setShowDepartmentDialog] = useState(false);
  const [showPositionDialog, setShowPositionDialog] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      if (user) {
        // Buscar perfil do usuário
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', user.id)
          .single();

        if (profileError) {
          console.error('Erro ao buscar perfil:', profileError);
          setLoading(false);
          return;
        }

        setProfile(profileData);

        // Buscar departamentos da empresa do usuário
        const { data: deptData, error: deptError } = await supabase
          .from('departments')
          .select('*')
          .eq('company_id', profileData.company_id)
          .order('name');

        if (deptError) {
          console.error('Erro ao buscar departamentos:', deptError);
        } else {
          setDepartments(deptData || []);
        }

        // Buscar cargos da empresa do usuário
        const { data: posData, error: posError } = await supabase
          .from('positions')
          .select('*, departments(name)')
          .eq('company_id', profileData.company_id)
          .order('name');

        if (posError) {
          console.error('Erro ao buscar cargos:', posError);
        } else {
          setPositions(posData || []);
        }
      }
      setLoading(false);
    };
    
    fetchData();
  }, [user]);

  // Verificar permissões após carregar dados
  if (!loading && profile && !["company_admin", "rh_manager"].includes(profile.group_name)) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleCreateDepartment = async () => {
    if (!departmentForm.name.trim()) {
      toast({
        title: "Erro",
        description: "Nome do setor é obrigatório",
        variant: "destructive",
      });
      return;
    }

    try {
      const { data, error } = await supabase
        .from('departments')
        .insert({
          name: departmentForm.name,
          description: departmentForm.description,
          company_id: profile.company_id
        })
        .select()
        .single();

      if (error) throw error;

      setDepartments([...departments, data]);
      setDepartmentForm({ name: '', description: '' });
      setShowDepartmentDialog(false);
      toast({
        title: "Sucesso",
        description: "Setor criado com sucesso",
      });
    } catch (error: any) {
      console.error('Erro ao criar setor:', error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao criar setor",
        variant: "destructive",
      });
    }
  };

  const handleUpdateDepartment = async () => {
    if (!editingDepartment || !departmentForm.name.trim()) return;

    try {
      const { error } = await supabase
        .from('departments')
        .update({
          name: departmentForm.name,
          description: departmentForm.description,
        })
        .eq('id', editingDepartment.id);

      if (error) throw error;

      const updatedDepartment = {
        ...editingDepartment,
        name: departmentForm.name,
        description: departmentForm.description,
      };

      setDepartments(departments.map(d => d.id === updatedDepartment.id ? updatedDepartment : d));
      setDepartmentForm({ name: '', description: '' });
      setEditingDepartment(null);
      setShowDepartmentDialog(false);
      toast({
        title: "Sucesso",
        description: "Setor atualizado com sucesso",
      });
    } catch (error: any) {
      console.error('Erro ao atualizar setor:', error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao atualizar setor",
        variant: "destructive",
      });
    }
  };

  const handleDeleteDepartment = async (id: string) => {
    try {
      const { error } = await supabase.from('departments').delete().eq('id', id);
      if (error) throw error;

      setDepartments(departments.filter(d => d.id !== id));
      toast({
        title: "Sucesso",
        description: "Setor deletado com sucesso",
      });
    } catch (error: any) {
      console.error('Erro ao deletar setor:', error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao deletar setor",
        variant: "destructive",
      });
    }
  };

  const handleCreatePosition = async () => {
    if (!positionForm.name.trim() || !positionForm.department_id) {
      toast({
        title: "Erro",
        description: "Nome do cargo e setor são obrigatórios",
        variant: "destructive",
      });
      return;
    }

    try {
      const { data, error } = await supabase
        .from('positions')
        .insert({
          name: positionForm.name,
          description: positionForm.description,
          department_id: positionForm.department_id,
          company_id: profile.company_id
        })
        .select()
        .single();

      if (error) throw error;

      setPositions([...positions, data]);
      setPositionForm({ name: '', description: '', department_id: '' });
      setShowPositionDialog(false);
      toast({
        title: "Sucesso",
        description: "Cargo criado com sucesso",
      });
    } catch (error: any) {
      console.error('Erro ao criar cargo:', error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao criar cargo",
        variant: "destructive",
      });
    }
  };

  const handleUpdatePosition = async () => {
    if (!editingPosition || !positionForm.name.trim() || !positionForm.department_id) return;

    try {
      const { error } = await supabase
        .from('positions')
        .update({
          name: positionForm.name,
          description: positionForm.description,
          department_id: positionForm.department_id,
        })
        .eq('id', editingPosition.id);

      if (error) throw error;

      const updatedPosition = {
        ...editingPosition,
        name: positionForm.name,
        description: positionForm.description,
        department_id: positionForm.department_id,
      };

      setPositions(positions.map(p => p.id === updatedPosition.id ? updatedPosition : p));
      setPositionForm({ name: '', description: '', department_id: '' });
      setEditingPosition(null);
      setShowPositionDialog(false);
      toast({
        title: "Sucesso",
        description: "Cargo atualizado com sucesso",
      });
    } catch (error: any) {
      console.error('Erro ao atualizar cargo:', error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao atualizar cargo",
        variant: "destructive",
      });
    }
  };

  const handleDeletePosition = async (id: string) => {
    try {
      const { error } = await supabase.from('positions').delete().eq('id', id);
      if (error) throw error;

      setPositions(positions.filter(p => p.id !== id));
      toast({
        title: "Sucesso",
        description: "Cargo deletado com sucesso",
      });
    } catch (error: any) {
      console.error('Erro ao deletar cargo:', error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao deletar cargo",
        variant: "destructive",
      });
    }
  };

  const openDepartmentDialog = (department?: Department) => {
    if (department) {
      setEditingDepartment(department);
      setDepartmentForm({ name: department.name, description: department.description || '' });
    } else {
      setEditingDepartment(null);
      setDepartmentForm({ name: '', description: '' });
    }
    setShowDepartmentDialog(true);
  };

  const openPositionDialog = (position?: Position) => {
    if (position) {
      setEditingPosition(position);
      setPositionForm({ 
        name: position.name, 
        description: position.description || '', 
        department_id: position.department_id 
      });
    } else {
      setEditingPosition(null);
      setPositionForm({ name: '', description: '', department_id: '' });
    }
    setShowPositionDialog(true);
  };

  const getDepartmentName = (departmentId: string) => {
    const dept = departments.find(d => d.id === departmentId);
    return dept?.name || 'N/A';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-surface flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-surface p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Regras de Negócio</h1>
          <p className="text-muted-foreground">Gerencie setores e cargos da plataforma</p>
        </div>

        {/* Tabs */}
        <div className="flex space-x-1 bg-muted p-1 rounded-lg w-fit">
          <Button
            variant={activeTab === 'departments' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setActiveTab('departments')}
            className="flex items-center gap-2"
          >
            <Building2 className="h-4 w-4" />
            Setores
          </Button>
          <Button
            variant={activeTab === 'positions' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setActiveTab('positions')}
            className="flex items-center gap-2"
          >
            <Briefcase className="h-4 w-4" />
            Cargos
          </Button>
        </div>

        {/* Departments Tab */}
        {activeTab === 'departments' && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Building2 className="h-5 w-5" />
                    Setores
                  </CardTitle>
                  <CardDescription>
                    Gerencie os setores da empresa
                  </CardDescription>
                </div>
                <Dialog open={showDepartmentDialog} onOpenChange={setShowDepartmentDialog}>
                  <DialogTrigger asChild>
                    <Button onClick={() => openDepartmentDialog()}>
                      <Plus className="h-4 w-4 mr-2" />
                      Novo Setor
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>
                        {editingDepartment ? 'Editar Setor' : 'Novo Setor'}
                      </DialogTitle>
                      <DialogDescription>
                        Preencha as informações do setor
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="dept-name">Nome do Setor</Label>
                        <Input
                          id="dept-name"
                          value={departmentForm.name}
                          onChange={(e) => setDepartmentForm({ ...departmentForm, name: e.target.value })}
                          placeholder="Ex: Recursos Humanos"
                        />
                      </div>
                      <div>
                        <Label htmlFor="dept-desc">Descrição</Label>
                        <Textarea
                          id="dept-desc"
                          value={departmentForm.description}
                          onChange={(e) => setDepartmentForm({ ...departmentForm, description: e.target.value })}
                          placeholder="Descrição do setor..."
                        />
                      </div>
                      <div className="flex justify-end space-x-2">
                        <Button variant="outline" onClick={() => setShowDepartmentDialog(false)}>
                          Cancelar
                        </Button>
                        <Button onClick={editingDepartment ? handleUpdateDepartment : handleCreateDepartment}>
                          {editingDepartment ? 'Atualizar' : 'Criar'}
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Data de Criação</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {departments.map((department) => (
                    <TableRow key={department.id}>
                      <TableCell className="font-medium">{department.name}</TableCell>
                      <TableCell>{department.description || '-'}</TableCell>
                      <TableCell>
                        {new Date(department.created_at).toLocaleDateString('pt-BR')}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openDepartmentDialog(department)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeleteDepartment(department.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {departments.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground">
                        Nenhum setor cadastrado
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* Positions Tab */}
        {activeTab === 'positions' && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Briefcase className="h-5 w-5" />
                    Cargos
                  </CardTitle>
                  <CardDescription>
                    Gerencie os cargos da empresa
                  </CardDescription>
                </div>
                <Dialog open={showPositionDialog} onOpenChange={setShowPositionDialog}>
                  <DialogTrigger asChild>
                    <Button onClick={() => openPositionDialog()}>
                      <Plus className="h-4 w-4 mr-2" />
                      Novo Cargo
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>
                        {editingPosition ? 'Editar Cargo' : 'Novo Cargo'}
                      </DialogTitle>
                      <DialogDescription>
                        Preencha as informações do cargo
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="pos-name">Nome do Cargo</Label>
                        <Input
                          id="pos-name"
                          value={positionForm.name}
                          onChange={(e) => setPositionForm({ ...positionForm, name: e.target.value })}
                          placeholder="Ex: Analista de RH"
                        />
                      </div>
                      <div>
                        <Label htmlFor="pos-dept">Setor</Label>
                        <select
                          id="pos-dept"
                          className="w-full p-2 border border-input rounded-md"
                          value={positionForm.department_id}
                          onChange={(e) => setPositionForm({ ...positionForm, department_id: e.target.value })}
                        >
                          <option value="">Selecione um setor</option>
                          {departments.map((dept) => (
                            <option key={dept.id} value={dept.id}>
                              {dept.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <Label htmlFor="pos-desc">Descrição</Label>
                        <Textarea
                          id="pos-desc"
                          value={positionForm.description}
                          onChange={(e) => setPositionForm({ ...positionForm, description: e.target.value })}
                          placeholder="Descrição do cargo..."
                        />
                      </div>
                      <div className="flex justify-end space-x-2">
                        <Button variant="outline" onClick={() => setShowPositionDialog(false)}>
                          Cancelar
                        </Button>
                        <Button onClick={editingPosition ? handleUpdatePosition : handleCreatePosition}>
                          {editingPosition ? 'Atualizar' : 'Criar'}
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Setor</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Data de Criação</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {positions.map((position) => (
                    <TableRow key={position.id}>
                      <TableCell className="font-medium">{position.name}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {getDepartmentName(position.department_id)}
                        </Badge>
                      </TableCell>
                      <TableCell>{position.description || '-'}</TableCell>
                      <TableCell>
                        {new Date(position.created_at).toLocaleDateString('pt-BR')}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openPositionDialog(position)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeletePosition(position.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {positions.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground">
                        Nenhum cargo cadastrado
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}