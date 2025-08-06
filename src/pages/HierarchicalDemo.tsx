import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface Department {
  id: string;
  name: string;
  description: string;
}

interface Position {
  id: string;
  name: string;
  description: string;
  hierarchy_level: number;
}

interface User {
  id: string;
  full_name: string;
  email: string;
  group_name: string;
  role_type: string;
  department_id: string;
  position_id: string;
}

const HierarchicalDemo: React.FC = () => {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  
  // Upload form state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);
  const [selectedPositions, setSelectedPositions] = useState<string[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [accessType, setAccessType] = useState<string>('mixed');
  const [uploadStatus, setUploadStatus] = useState<string>('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // Carregar departamentos
      const { data: depts, error: deptError } = await supabase
        .from('departments')
        .select('*')
        .order('name');
      
      if (deptError) throw deptError;
      setDepartments(depts || []);

      // Carregar cargos
      const { data: pos, error: posError } = await supabase
        .from('positions')
        .select('*')
        .order('hierarchy_level', { ascending: false });
      
      if (posError) throw posError;
      setPositions(pos || []);

      // Carregar usuários
      const { data: usersData, error: usersError } = await supabase
        .from('profiles')
        .select('*')
        .eq('status', 'active')
        .order('full_name');
      
      if (usersError) throw usersError;
      setUsers(usersData || []);

      // Carregar usuário atual
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', user.id)
          .single();
        
        setCurrentUser(profile);
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !currentUser) {
      setUploadStatus('Selecione um arquivo e faça login');
      return;
    }

    try {
      setUploadStatus('Fazendo upload...');
      
      // Simular upload (normalmente seria para Backblaze B2)
      const filePath = `company-${currentUser.company_id}/uploads/${selectedFile.name}`;
      
      // Registrar controle de acesso no banco
      const { data, error } = await supabase.rpc('register_file_upload', {
        file_path_param: filePath,
        file_name_param: selectedFile.name,
        file_size_param: selectedFile.size,
        content_type_param: selectedFile.type,
        uploaded_by_uuid: currentUser.user_id,
        allowed_departments_param: selectedDepartments,
        allowed_positions_param: selectedPositions,
        allowed_users_param: selectedUsers,
        access_type_param: accessType
      });

      if (error) throw error;

      setUploadStatus(`Upload realizado com sucesso! File ID: ${data.file_id}`);
      
      // Limpar formulário
      setSelectedFile(null);
      setSelectedDepartments([]);
      setSelectedPositions([]);
      setSelectedUsers([]);
      setAccessType('mixed');
      
    } catch (error) {
      console.error('Erro no upload:', error);
      setUploadStatus(`Erro: ${error.message}`);
    }
  };

  const handleCreateDefaultDepartments = async () => {
    if (!currentUser?.company_id) return;

    try {
      const { data, error } = await supabase.rpc('create_default_departments_for_company', {
        company_uuid: currentUser.company_id
      });

      if (error) throw error;
      
      setUploadStatus('Departamentos e cargos padrão criados com sucesso!');
      loadData(); // Recarregar dados
    } catch (error) {
      console.error('Erro ao criar departamentos:', error);
      setUploadStatus(`Erro: ${error.message}`);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6 text-center">
        Sistema Hierárquico CloudFlow-Vault
      </h1>

      {/* Status do usuário atual */}
      {currentUser && (
        <div className="bg-blue-50 p-4 rounded-lg mb-6">
          <h2 className="font-semibold mb-2">Usuário Atual</h2>
          <p><strong>Nome:</strong> {currentUser.full_name}</p>
          <p><strong>Email:</strong> {currentUser.email}</p>
          <p><strong>Grupo:</strong> {currentUser.group_name}</p>
          <p><strong>Tipo:</strong> {currentUser.role_type || 'employee'}</p>
          <p><strong>Departamento ID:</strong> {currentUser.department_id || 'Não definido'}</p>
          <p><strong>Cargo ID:</strong> {currentUser.position_id || 'Não definido'}</p>
        </div>
      )}

      {/* Botão para criar departamentos padrão */}
      {currentUser && (currentUser.group_name === 'company_admin' || currentUser.group_name === 'super_admin') && (
        <div className="mb-6">
          <button
            onClick={handleCreateDefaultDepartments}
            className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
          >
            Criar Departamentos e Cargos Padrão
          </button>
        </div>
      )}

      <div className="grid md:grid-cols-3 gap-6 mb-8">
        {/* Departamentos */}
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="font-semibold mb-3">Departamentos ({departments.length})</h3>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {departments.map(dept => (
              <div key={dept.id} className="text-sm border-b pb-1">
                <div className="font-medium">{dept.name}</div>
                <div className="text-gray-600 text-xs">{dept.description}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Cargos */}
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="font-semibold mb-3">Cargos ({positions.length})</h3>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {positions.map(pos => (
              <div key={pos.id} className="text-sm border-b pb-1">
                <div className="font-medium">{pos.name} (Nível {pos.hierarchy_level})</div>
                <div className="text-gray-600 text-xs">{pos.description}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Usuários */}
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="font-semibold mb-3">Usuários ({users.length})</h3>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {users.map(user => (
              <div key={user.id} className="text-sm border-b pb-1">
                <div className="font-medium">{user.full_name}</div>
                <div className="text-gray-600 text-xs">
                  {user.group_name} • {user.email}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Upload com controle de acesso */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="font-semibold mb-4">Upload com Controle de Acesso</h3>
        
        <div className="space-y-4">
          {/* Seleção de arquivo */}
          <div>
            <label className="block text-sm font-medium mb-2">Selecionar Arquivo</label>
            <input
              type="file"
              onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
              className="block w-full text-sm border rounded p-2"
            />
          </div>

          {/* Tipo de acesso */}
          <div>
            <label className="block text-sm font-medium mb-2">Tipo de Acesso</label>
            <select
              value={accessType}
              onChange={(e) => setAccessType(e.target.value)}
              className="block w-full text-sm border rounded p-2"
            >
              <option value="mixed">Misto (departamentos, cargos e usuários específicos)</option>
              <option value="shared">Compartilhado (toda a empresa)</option>
              <option value="department">Apenas departamentos</option>
              <option value="position">Apenas cargos</option>
              <option value="personal">Apenas pessoal</option>
            </select>
          </div>

          {/* Seleção de departamentos */}
          <div>
            <label className="block text-sm font-medium mb-2">Departamentos com Acesso</label>
            <div className="space-y-1 max-h-32 overflow-y-auto border p-2 rounded">
              {departments.map(dept => (
                <label key={dept.id} className="flex items-center text-sm">
                  <input
                    type="checkbox"
                    checked={selectedDepartments.includes(dept.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedDepartments([...selectedDepartments, dept.id]);
                      } else {
                        setSelectedDepartments(selectedDepartments.filter(id => id !== dept.id));
                      }
                    }}
                    className="mr-2"
                  />
                  {dept.name}
                </label>
              ))}
            </div>
          </div>

          {/* Seleção de cargos */}
          <div>
            <label className="block text-sm font-medium mb-2">Cargos com Acesso</label>
            <div className="space-y-1 max-h-32 overflow-y-auto border p-2 rounded">
              {positions.map(pos => (
                <label key={pos.id} className="flex items-center text-sm">
                  <input
                    type="checkbox"
                    checked={selectedPositions.includes(pos.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedPositions([...selectedPositions, pos.id]);
                      } else {
                        setSelectedPositions(selectedPositions.filter(id => id !== pos.id));
                      }
                    }}
                    className="mr-2"
                  />
                  {pos.name} (Nível {pos.hierarchy_level})
                </label>
              ))}
            </div>
          </div>

          {/* Seleção de usuários específicos */}
          <div>
            <label className="block text-sm font-medium mb-2">Usuários Específicos</label>
            <div className="space-y-1 max-h-32 overflow-y-auto border p-2 rounded">
              {users.map(user => (
                <label key={user.id} className="flex items-center text-sm">
                  <input
                    type="checkbox"
                    checked={selectedUsers.includes(user.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedUsers([...selectedUsers, user.id]);
                      } else {
                        setSelectedUsers(selectedUsers.filter(id => id !== user.id));
                      }
                    }}
                    className="mr-2"
                  />
                  {user.full_name} ({user.group_name})
                </label>
              ))}
            </div>
          </div>

          {/* Botão de upload */}
          <button
            onClick={handleUpload}
            disabled={!selectedFile}
            className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 disabled:bg-gray-400"
          >
            Upload com Controle de Acesso
          </button>

          {/* Status */}
          {uploadStatus && (
            <div className={`p-3 rounded ${
              uploadStatus.includes('Erro') 
                ? 'bg-red-50 text-red-800' 
                : 'bg-green-50 text-green-800'
            }`}>
              {uploadStatus}
            </div>
          )}
        </div>
      </div>

      {/* Explicação do sistema */}
      <div className="mt-8 bg-yellow-50 p-6 rounded-lg">
        <h3 className="font-semibold mb-3">Como funciona o Sistema Hierárquico</h3>
        <div className="text-sm space-y-2">
          <p><strong>Super Admin:</strong> Tem acesso total ao sistema, pode gerenciar todas as empresas.</p>
          <p><strong>Company Admin:</strong> Pode gerenciar sua empresa, criar usuários RH e colaboradores, ver todos os arquivos da empresa.</p>
          <p><strong>RH Manager:</strong> Pode criar e deletar colaboradores, gerenciar cargos/setores, acessar arquivos dos setores/cargos que gerencia.</p>
          <p><strong>Employee:</strong> Acesso restrito aos arquivos de sua empresa, cargo e setor; pode fazer CRUD nos arquivos acessíveis.</p>
          
          <div className="mt-4">
            <strong>Controle de Acesso por Upload:</strong>
            <ul className="list-disc ml-4 mt-2 space-y-1">
              <li>Ao fazer upload, o usuário especifica quais departamentos, cargos e usuários podem acessar</li>
              <li>Arquivos são isolados por empresa (prefix: company-{id})</li>
              <li>Company Admin sempre tem acesso a todos os arquivos da empresa</li>
              <li>Usuários só veem arquivos que têm permissão baseado em seu cargo/setor</li>
              <li>Logs auditam todas as ações para segurança</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HierarchicalDemo;
