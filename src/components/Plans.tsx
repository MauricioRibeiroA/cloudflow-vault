import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface Plan {
  id: string;
  name: string;
  price_brl: number;
  storage_limit_gb: number;
  download_limit_gb: number;
  max_users: number;
}

interface CompanyUsage {
  company_id: string;
  company_name: string;
  plan_name: string;
  storage_used_gb: number;
  storage_limit_gb: number;
  download_used_gb: number;
  download_limit_gb: number;
  active_users_count: number;
  max_users: number;
}

export default function Plans() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [companyUsage, setCompanyUsage] = useState<CompanyUsage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadPlans();
    loadCompanyUsage();
  }, []);

  const loadPlans = async () => {
    try {
      const { data, error } = await supabase
        .from('plans')
        .select('*')
        .order('price_brl', { ascending: true });

      if (error) throw error;
      setPlans(data || []);
    } catch (err: any) {
      setError(err.message);
      console.error('Erro ao carregar planos:', err);
    }
  };

  const loadCompanyUsage = async () => {
    try {
      // Primeiro, vamos pegar o company_id do usuário atual
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('user_id', user.id)
        .single();

      if (!profile?.company_id) return;

      // Agora vamos chamar a função get_company_usage
      const { data, error } = await supabase.rpc('get_company_usage', {
        company_uuid: profile.company_id
      });

      if (error) throw error;
      setCompanyUsage(data);
    } catch (err: any) {
      console.error('Erro ao carregar uso da empresa:', err);
    } finally {
      setLoading(false);
    }
  };

  const testUploadValidation = async (fileSize: number) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('user_id', user.id)
        .single();

      if (!profile?.company_id) return;

      const { data, error } = await supabase.rpc('can_upload_file', {
        company_uuid: profile.company_id,
        file_size_bytes: fileSize
      });

      if (error) throw error;
      console.log('Teste de upload:', data);
      alert(`Resultado do teste de upload (${fileSize} bytes): ${JSON.stringify(data, null, 2)}`);
    } catch (err: any) {
      console.error('Erro no teste de upload:', err);
      alert(`Erro no teste: ${err.message}`);
    }
  };

  if (loading) {
    return <div className="flex justify-center items-center h-64">
      <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500"></div>
    </div>;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-center mb-8">Planos de Assinatura</h1>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
          Erro: {error}
        </div>
      )}

      {/* Uso Atual da Empresa */}
      {companyUsage && (
        <div className="bg-gray-100 p-6 rounded-lg mb-8">
          <h2 className="text-xl font-semibold mb-4">Uso Atual - {companyUsage.company_name}</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-4 rounded">
              <h3 className="font-semibold text-gray-700">Plano Atual</h3>
              <p className="text-lg font-bold text-blue-600">{companyUsage.plan_name}</p>
            </div>
            <div className="bg-white p-4 rounded">
              <h3 className="font-semibold text-gray-700">Armazenamento</h3>
              <p className="text-lg">
                {companyUsage.storage_used_gb} GB / {companyUsage.storage_limit_gb} GB
              </p>
              <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full" 
                  style={{ width: `${Math.min((companyUsage.storage_used_gb / companyUsage.storage_limit_gb) * 100, 100)}%` }}
                ></div>
              </div>
            </div>
            <div className="bg-white p-4 rounded">
              <h3 className="font-semibold text-gray-700">Download Mensal</h3>
              <p className="text-lg">
                {companyUsage.download_used_gb} GB / {companyUsage.download_limit_gb} GB
              </p>
              <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                <div 
                  className="bg-green-600 h-2 rounded-full" 
                  style={{ width: `${Math.min((companyUsage.download_used_gb / companyUsage.download_limit_gb) * 100, 100)}%` }}
                ></div>
              </div>
            </div>
            <div className="bg-white p-4 rounded">
              <h3 className="font-semibold text-gray-700">Usuários</h3>
              <p className="text-lg">
                {companyUsage.active_users_count} / {companyUsage.max_users}
              </p>
            </div>
          </div>
          
          {/* Botões de Teste */}
          <div className="mt-6">
            <h3 className="font-semibold mb-2">Testar Validações:</h3>
            <div className="space-x-2">
              <button
                onClick={() => testUploadValidation(1024 * 1024)} // 1MB
                className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
              >
                Testar Upload 1MB
              </button>
              <button
                onClick={() => testUploadValidation(1024 * 1024 * 1024)} // 1GB
                className="bg-orange-500 hover:bg-orange-700 text-white font-bold py-2 px-4 rounded"
              >
                Testar Upload 1GB
              </button>
              <button
                onClick={() => testUploadValidation(50 * 1024 * 1024 * 1024)} // 50GB
                className="bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded"
              >
                Testar Upload 50GB
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cards dos Planos */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {plans.map((plan) => (
          <div key={plan.id} className="bg-white rounded-lg shadow-lg p-6 border">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-gray-800 mb-2">{plan.name}</h2>
              <div className="text-4xl font-bold text-blue-600 mb-4">
                R$ {plan.price_brl.toFixed(2)}
                <span className="text-sm text-gray-500">/mês</span>
              </div>
              
              <ul className="text-left space-y-3 mb-6">
                <li className="flex items-center">
                  <svg className="w-5 h-5 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  {plan.storage_limit_gb} GB de armazenamento
                </li>
                <li className="flex items-center">
                  <svg className="w-5 h-5 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  {plan.max_users} usuários
                </li>
                <li className="flex items-center">
                  <svg className="w-5 h-5 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  {plan.download_limit_gb} GB/mês de download
                </li>
              </ul>
              
              <button 
                className={`w-full py-3 px-4 rounded-lg font-bold text-white transition duration-200 ${
                  companyUsage?.plan_name === plan.name 
                    ? 'bg-green-600 hover:bg-green-700' 
                    : 'bg-blue-600 hover:bg-blue-700'
                }`}
                disabled={companyUsage?.plan_name === plan.name}
              >
                {companyUsage?.plan_name === plan.name ? 'Plano Atual' : 'Assinar Agora'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
