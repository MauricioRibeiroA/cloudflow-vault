import { Navigate } from "react-router-dom";
import { useAuth } from "./AuthContext";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredGroups?: string[];
}

export const ProtectedRoute = ({ children, requiredGroups }: ProtectedRouteProps) => {
  const { user, loading } = useAuth();
  const [userGroup, setUserGroup] = useState<string | null>(null);
  const [groupLoading, setGroupLoading] = useState(true);

  useEffect(() => {
    const fetchUserGroup = async () => {
      if (!user) {
        setGroupLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('group_name')
          .eq('user_id', user.id)
          .single();

        if (error) {
          console.error('Error fetching user group:', error);
          setUserGroup(null);
        } else {
          setUserGroup(data?.group_name || null);
        }
      } catch (error) {
        console.error('Error fetching user group:', error);
        setUserGroup(null);
      } finally {
        setGroupLoading(false);
      }
    };

    fetchUserGroup();
  }, [user]);

  if (loading || groupLoading) {
    return (
      <div className="min-h-screen bg-gradient-surface flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // Check if route requires specific groups
  if (requiredGroups && requiredGroups.length > 0) {
    if (!userGroup || !requiredGroups.includes(userGroup)) {
      return <Navigate to="/dashboard" replace />;
    }
  }

  return <>{children}</>;
};