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

export default function Plans() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadPlans();
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
    } finally {
      setLoading(false);
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
              
              <button className="w-full py-3 px-4 rounded-lg font-bold text-white bg-blue-600 hover:bg-blue-700 transition duration-200">
                Assinar Agora
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
