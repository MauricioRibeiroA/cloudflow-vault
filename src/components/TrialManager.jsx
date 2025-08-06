import React, { useState, useEffect } from 'react';
import { supabase } from '../integrations/supabase/client';

const TrialManager = () => {
  const [trialStatus, setTrialStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Função para buscar status do trial
  const fetchTrialStatus = async () => {
    try {
      setLoading(true);
      setError('');

      // Buscar company_id do usuário atual
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setError('Usuário não autenticado');
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('user_id', user.id)
        .single();

      if (!profile?.company_id) {
        setError('Empresa não encontrada');
        return;
      }

      // Chamar função para verificar status do trial
      const { data, error } = await supabase.rpc('check_trial_status', {
        company_uuid: profile.company_id
      });

      if (error) {
        setError(`Erro ao buscar status do trial: ${error.message}`);
        return;
      }

      setTrialStatus(data);

    } catch (err) {
      setError(`Erro: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Função para iniciar trial
  const startTrial = async () => {
    try {
      setLoading(true);
      setError('');
      setSuccess('');

      // Buscar company_id do usuário atual
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setError('Usuário não autenticado');
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('user_id', user.id)
        .single();

      if (!profile?.company_id) {
        setError('Empresa não encontrada');
        return;
      }

      // Chamar função para iniciar trial
      const { data, error } = await supabase.rpc('start_free_trial', {
        company_uuid: profile.company_id
      });

      if (error) {
        setError(`Erro ao iniciar trial: ${error.message}`);
        return;
      }

      if (!data.success) {
        setError(`Erro: ${data.error}`);
        return;
      }

      setSuccess('Trial iniciado com sucesso! 🎉');
      fetchTrialStatus(); // Atualizar status

    } catch (err) {
      setError(`Erro: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Função para verificar se pode executar ação
  const testAction = async (actionType) => {
    try {
      setLoading(true);
      setError('');

      // Buscar company_id do usuário atual
      const { data: { user } } = await supabase.auth.getUser();
      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('user_id', user.id)
        .single();

      // Testar ação
      const { data, error } = await supabase.rpc('can_company_perform_action', {
        company_uuid: profile.company_id,
        action_type: actionType
      });

      if (error) {
        setError(`Erro ao testar ação: ${error.message}`);
        return;
      }

      const message = data.allowed 
        ? `✅ Ação '${actionType}' permitida!` 
        : `❌ Ação '${actionType}' bloqueada: ${data.error}`;
      
      setSuccess(message);

    } catch (err) {
      setError(`Erro: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Carregar status do trial ao montar o componente
  useEffect(() => {
    fetchTrialStatus();
  }, []);

  // Função para formatar data
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString('pt-BR');
  };

  // Função para calcular porcentagem de uso
  const getUsagePercentage = (used, limit) => {
    if (!limit) return 0;
    return Math.round((used / (limit * 1024 * 1024 * 1024)) * 100); // Converter GB para bytes
  };

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Sistema de Trial Gratuito</h1>
        <p className="text-gray-600">Gerencie seu período de teste gratuito de 7 dias</p>
      </div>

      {/* Mensagens de Status */}
      {error && (
        <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}
      
      {success && (
        <div className="mb-4 p-4 bg-green-100 border border-green-400 text-green-700 rounded">
          {success}
        </div>
      )}

      {/* Botões de Controle */}
      <div className="mb-6 flex flex-wrap gap-3">
        <button
          onClick={fetchTrialStatus}
          disabled={loading}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
        >
          {loading ? 'Carregando...' : '🔄 Atualizar Status'}
        </button>

        <button
          onClick={startTrial}
          disabled={loading}
          className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
        >
          🚀 Iniciar Trial Gratuito
        </button>

        <button
          onClick={() => testAction('upload')}
          disabled={loading}
          className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 disabled:opacity-50"
        >
          🧪 Testar Upload
        </button>

        <button
          onClick={() => testAction('create_user')}
          disabled={loading}
          className="px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600 disabled:opacity-50"
        >
          👥 Testar Criar Usuário
        </button>
      </div>

      {/* Status do Trial */}
      {trialStatus && (
        <div className="space-y-6">
          {/* Card Principal do Trial */}
          <div className={`p-6 rounded-lg border-2 ${
            trialStatus.has_trial_active 
              ? 'bg-green-50 border-green-200' 
              : trialStatus.is_expired 
                ? 'bg-red-50 border-red-200'
                : 'bg-gray-50 border-gray-200'
          }`}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">
                {trialStatus.has_trial_active ? '🟢 Trial Ativo' : 
                 trialStatus.is_expired ? '🔴 Trial Expirado' : 
                 '⚪ Trial Não Iniciado'}
              </h2>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                trialStatus.subscription_status === 'trial' ? 'bg-green-100 text-green-800' :
                trialStatus.subscription_status === 'expired' ? 'bg-red-100 text-red-800' :
                'bg-gray-100 text-gray-800'
              }`}>
                {trialStatus.subscription_status?.toUpperCase() || 'INACTIVE'}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600">Plano Atual</p>
                <p className="font-medium">{trialStatus.plan_name || 'Nenhum'}</p>
              </div>

              {trialStatus.has_trial_active && (
                <>
                  <div>
                    <p className="text-sm text-gray-600">Tempo Restante</p>
                    <p className="font-medium">
                      {trialStatus.days_remaining || 0} dias, {trialStatus.hours_remaining || 0} horas
                    </p>
                  </div>

                  <div>
                    <p className="text-sm text-gray-600">Iniciado em</p>
                    <p className="font-medium">{formatDate(trialStatus.trial_started_at)}</p>
                  </div>

                  <div>
                    <p className="text-sm text-gray-600">Expira em</p>
                    <p className="font-medium">{formatDate(trialStatus.trial_ends_at)}</p>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Limites do Plano */}
          {trialStatus.storage_limit_gb && (
            <div className="bg-white p-6 rounded-lg border">
              <h3 className="text-lg font-semibold mb-4">📊 Limites do Plano</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {trialStatus.storage_limit_gb}GB
                  </div>
                  <div className="text-sm text-gray-600">Armazenamento</div>
                </div>

                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {trialStatus.download_limit_gb}GB
                  </div>
                  <div className="text-sm text-gray-600">Download Mensal</div>
                </div>

                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">
                    {trialStatus.max_users}
                  </div>
                  <div className="text-sm text-gray-600">Usuários Máximos</div>
                </div>
              </div>
            </div>
          )}

          {/* Avisos e Próximos Passos */}
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
            <h3 className="font-semibold text-blue-900 mb-2">💡 Informações Importantes</h3>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• O trial gratuito dura 7 dias a partir da ativação</li>
              <li>• Cada empresa pode usar o trial apenas uma vez</li>
              <li>• Durante o trial, você tem acesso completo a todas as funcionalidades</li>
              <li>• Após expirar, será necessário assinar um plano para continuar</li>
              {trialStatus.has_trial_active && (
                <li className="font-medium">• Lembre-se de fazer upgrade antes do fim do trial!</li>
              )}
            </ul>
          </div>
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          <span className="ml-2">Carregando...</span>
        </div>
      )}
    </div>
  );
};

export default TrialManager;
