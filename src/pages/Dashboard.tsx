import { useState, useEffect } from 'react';
import { useAuth } from '@/components/auth/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import SuperAdminDashboard from '@/components/SuperAdminDashboard';
import CompanyDashboard from './CompanyDashboard';

interface Profile {
  id: string;
  full_name: string;
  email: string;
  group_name: string;
  status: string;
  company_id: string;
}

const Dashboard = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchProfile();
    }
  }, [user]);

  const fetchProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user?.id)
        .single();

      if (error) throw error;
      setProfile(data);
    } catch (error: any) {
      console.error('Error fetching profile:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Roteamento inteligente baseado no perfil do usuário
  if (profile?.group_name === 'super_admin') {
    return <SuperAdminDashboard />;
  }
  
  // Para todos os outros usuários (company_admin, hr, user), usar o dashboard da empresa
  return <CompanyDashboard />;
};

export default Dashboard;