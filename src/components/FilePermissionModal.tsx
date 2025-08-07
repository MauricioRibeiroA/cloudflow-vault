import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  Building2, 
  Briefcase, 
  User, 
  Shield, 
  Eye, 
  Edit, 
  Crown,
  Plus,
  X,
  AlertCircle
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/auth/AuthContext';

interface Department {
  id: string;
  name: string;
  description?: string;
}

interface Position {
  id: string;
  name: string;
  description?: string;
  department_id: string;
}

interface User {
  user_id: string;
  full_name: string;
  email: string;
  department_id?: string;
  position_id?: string;
  department?: { name: string };
  position?: { name: string };
}

interface Permission {
  id: string;
  type: 'department' | 'position' | 'user';
  target_id: string;
  target_name: string;
  permission_level: 'read' | 'write' | 'admin';
  department_name?: string;
}

interface FilePermissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (permissions: Permission[]) => Promise<void>;
  folderName: string;
  folderPath: string;
}

export const FilePermissionModal: React.FC<FilePermissionModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  folderName,
  folderPath
}) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  
  // Dados disponíveis
  const [departments, setDepartments] = useState<Department[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  
  // Estado do formulário
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [activeTab, setActiveTab] = useState<'departments' | 'positions' | 'users'>('departments');
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [permissionLevel, setPermissionLevel] = useState<'read' | 'write' | 'admin'>('read');

  // Carregar dados quando o modal abrir
  useEffect(() => {
    if (isOpen && user) {
      loadData();
    }
  }, [isOpen, user]);

  const loadData = async () => {
    try {
      setLoading(true);

      // Carregar perfil do usuário
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user?.id)
        .single();
      
      setProfile(profileData);

      if (!profileData?.company_id) return;

      // Carregar departamentos
      const { data: deptData } = await supabase
        .from('departments')
        .select('*')
        .eq('company_id', profileData.company_id)
        .order('name');

      setDepartments(deptData || []);

      // Carregar cargos
      const { data: posData } = await supabase
        .from('positions')
        .select('*, departments(name)')
        .eq('company_id', profileData.company_id)
        .order('name');

      setPositions(posData || []);

      // Carregar usuários da empresa
      const { data: userData } = await supabase
        .from('profiles')
        .select(`
          user_id, 
          full_name, 
          email, 
          department_id, 
          position_id,
          departments(name),
          positions(name)
        `)
        .eq('company_id', profileData.company_id)
        .eq('status', 'active')
        .order('full_name');

      setUsers(userData || []);

    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddPermissions = () => {
    const newPermissions: Permission[] = [];

    selectedItems.forEach(itemId => {
      let permission: Permission;

      if (activeTab === 'departments') {
        const dept = departments.find(d => d.id === itemId);
        if (dept) {
          permission = {
            id: `dept-${itemId}-${permissionLevel}`,
            type: 'department',
            target_id: itemId,
            target_name: dept.name,
            permission_level: permissionLevel
          };
        }
      } else if (activeTab === 'positions') {
        const pos = positions.find(p => p.id === itemId);
        if (pos) {
          permission = {
            id: `pos-${itemId}-${permissionLevel}`,
            type: 'position',
            target_id: itemId,
            target_name: pos.name,
            permission_level: permissionLevel,
            department_name: pos.departments?.name
          };
        }
      } else if (activeTab === 'users') {
        const usr = users.find(u => u.user_id === itemId);
        if (usr) {
          permission = {
            id: `user-${itemId}-${permissionLevel}`,
            type: 'user',
            target_id: itemId,
            target_name: usr.full_name,
            permission_level: permissionLevel,
            department_name: usr.department?.name
          };
        }
      }

      if (permission!) {
        // Verificar se já existe permissão similar
        const existingIndex = permissions.findIndex(p => 
          p.type === permission.type && 
          p.target_id === permission.target_id
        );

        if (existingIndex >= 0) {
          // Atualizar permissão existente
          permissions[existingIndex] = permission;
        } else {
          newPermissions.push(permission);
        }
      }
    });

    setPermissions([...permissions, ...newPermissions]);
    setSelectedItems(new Set());
  };

  const removePermission = (permissionId: string) => {
    setPermissions(permissions.filter(p => p.id !== permissionId));
  };

  const handleConfirm = async () => {
    try {
      setLoading(true);
      await onConfirm(permissions);
      setPermissions([]);
      setSelectedItems(new Set());
      onClose();
    } catch (error) {
      console.error('Erro ao aplicar permissões:', error);
    } finally {
      setLoading(false);
    }
  };

  const getPermissionIcon = (level: string) => {
    switch (level) {
      case 'admin': return <Crown className="h-3 w-3" />;
      case 'write': return <Edit className="h-3 w-3" />;
      default: return <Eye className="h-3 w-3" />;
    }
  };

  const getPermissionColor = (level: string) => {
    switch (level) {
      case 'admin': return 'destructive';
      case 'write': return 'default';
      default: return 'secondary';
    }
  };

  const renderTabContent = () => {
    if (activeTab === 'departments') {
      return (
        <div className="space-y-2">
          {departments.map((dept) => (
            <div key={dept.id} className="flex items-center space-x-2 p-2 rounded-lg border hover:bg-accent/50">
              <Checkbox
                id={`dept-${dept.id}`}
                checked={selectedItems.has(dept.id)}
                onCheckedChange={(checked) => {
                  const newSelected = new Set(selectedItems);
                  if (checked) {
                    newSelected.add(dept.id);
                  } else {
                    newSelected.delete(dept.id);
                  }
                  setSelectedItems(newSelected);
                }}
              />
              <Building2 className="h-4 w-4 text-blue-500" />
              <div className="flex-1">
                <Label htmlFor={`dept-${dept.id}`} className="font-medium cursor-pointer">
                  {dept.name}
                </Label>
                {dept.description && (
                  <p className="text-xs text-muted-foreground">{dept.description}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      );
    }

    if (activeTab === 'positions') {
      return (
        <div className="space-y-2">
          {positions.map((pos) => (
            <div key={pos.id} className="flex items-center space-x-2 p-2 rounded-lg border hover:bg-accent/50">
              <Checkbox
                id={`pos-${pos.id}`}
                checked={selectedItems.has(pos.id)}
                onCheckedChange={(checked) => {
                  const newSelected = new Set(selectedItems);
                  if (checked) {
                    newSelected.add(pos.id);
                  } else {
                    newSelected.delete(pos.id);
                  }
                  setSelectedItems(newSelected);
                }}
              />
              <Briefcase className="h-4 w-4 text-green-500" />
              <div className="flex-1">
                <Label htmlFor={`pos-${pos.id}`} className="font-medium cursor-pointer">
                  {pos.name}
                </Label>
                <div className="flex items-center gap-2">
                  {pos.departments?.name && (
                    <Badge variant="outline" className="text-xs">
                      {pos.departments.name}
                    </Badge>
                  )}
                  {pos.description && (
                    <p className="text-xs text-muted-foreground">{pos.description}</p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      );
    }

    if (activeTab === 'users') {
      return (
        <div className="space-y-2">
          {users.map((usr) => (
            <div key={usr.user_id} className="flex items-center space-x-2 p-2 rounded-lg border hover:bg-accent/50">
              <Checkbox
                id={`user-${usr.user_id}`}
                checked={selectedItems.has(usr.user_id)}
                onCheckedChange={(checked) => {
                  const newSelected = new Set(selectedItems);
                  if (checked) {
                    newSelected.add(usr.user_id);
                  } else {
                    newSelected.delete(usr.user_id);
                  }
                  setSelectedItems(newSelected);
                }}
              />
              <User className="h-4 w-4 text-purple-500" />
              <div className="flex-1">
                <Label htmlFor={`user-${usr.user_id}`} className="font-medium cursor-pointer">
                  {usr.full_name}
                </Label>
                <div className="flex items-center gap-2">
                  <p className="text-xs text-muted-foreground">{usr.email}</p>
                  {usr.department?.name && (
                    <Badge variant="outline" className="text-xs">
                      {usr.department.name}
                    </Badge>
                  )}
                  {usr.position?.name && (
                    <Badge variant="secondary" className="text-xs">
                      {usr.position.name}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      );
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Definir Permissões - {folderName}
          </DialogTitle>
          <DialogDescription>
            Configure quem pode acessar esta pasta. Se nenhuma permissão for definida, todos os membros da empresa terão acesso.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[60vh]">
          {/* Seleção de Permissões */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium">Selecionar Acesso</h3>
              <div className="flex space-x-1 bg-muted p-1 rounded-lg">
                <Button
                  variant={activeTab === 'departments' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setActiveTab('departments')}
                >
                  <Building2 className="h-4 w-4" />
                </Button>
                <Button
                  variant={activeTab === 'positions' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setActiveTab('positions')}
                >
                  <Briefcase className="h-4 w-4" />
                </Button>
                <Button
                  variant={activeTab === 'users' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setActiveTab('users')}
                >
                  <User className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Label>Nível de Permissão:</Label>
              <Select value={permissionLevel} onValueChange={(value: 'read' | 'write' | 'admin') => setPermissionLevel(value)}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="read">
                    <div className="flex items-center gap-2">
                      <Eye className="h-3 w-3" />
                      Leitura
                    </div>
                  </SelectItem>
                  <SelectItem value="write">
                    <div className="flex items-center gap-2">
                      <Edit className="h-3 w-3" />
                      Escrita
                    </div>
                  </SelectItem>
                  <SelectItem value="admin">
                    <div className="flex items-center gap-2">
                      <Crown className="h-3 w-3" />
                      Admin
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
              <Button
                onClick={handleAddPermissions}
                disabled={selectedItems.size === 0}
                size="sm"
              >
                <Plus className="h-4 w-4 mr-1" />
                Adicionar
              </Button>
            </div>

            <ScrollArea className="h-[350px] border rounded-lg p-3">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                </div>
              ) : (
                renderTabContent()
              )}
            </ScrollArea>
          </div>

          {/* Permissões Selecionadas */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium">Permissões Definidas</h3>
              <Badge variant="outline">{permissions.length} permissões</Badge>
            </div>

            <ScrollArea className="h-[400px] border rounded-lg p-3">
              {permissions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>Nenhuma permissão definida</p>
                  <p className="text-xs">Todos os membros da empresa terão acesso</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {permissions.map((permission) => (
                    <div
                      key={permission.id}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div className="flex items-center space-x-2">
                        {permission.type === 'department' && <Building2 className="h-4 w-4 text-blue-500" />}
                        {permission.type === 'position' && <Briefcase className="h-4 w-4 text-green-500" />}
                        {permission.type === 'user' && <User className="h-4 w-4 text-purple-500" />}
                        
                        <div>
                          <div className="font-medium">{permission.target_name}</div>
                          {permission.department_name && (
                            <div className="text-xs text-muted-foreground">{permission.department_name}</div>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <Badge variant={getPermissionColor(permission.permission_level) as any} className="flex items-center gap-1">
                          {getPermissionIcon(permission.permission_level)}
                          {permission.permission_level}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removePermission(permission.id)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        </div>

        <Separator />

        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            {permissions.length === 0 ? (
              "⚠️ Sem restrições - todos os membros da empresa terão acesso"
            ) : (
              `✅ ${permissions.length} permissão(ões) definida(s)`
            )}
          </div>
          
          <div className="flex space-x-2">
            <Button variant="outline" onClick={onClose} disabled={loading}>
              Cancelar
            </Button>
            <Button onClick={handleConfirm} disabled={loading}>
              {loading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              ) : null}
              Aplicar Permissões
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
