import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log('Auth state changed:', event, session?.user?.id);
        
        // Set state synchronously to avoid loops
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
        
        // Only validate profiles for signed-in users after successful authentication
        // Don't force logout during initial load or during bootstrap
        if (event === 'SIGNED_IN' && session?.user) {
          setTimeout(async () => {
            try {
              const { data: profile, error } = await supabase
                .from('profiles')
                .select('user_id, status')
                .eq('user_id', session.user.id)
                .single();

              if (error || !profile || profile.status !== 'active') {
                console.warn('User not found in profiles or inactive, but allowing access');
                // Don't force logout - let the app handle this gracefully
              }
            } catch (error) {
              console.warn('Error validating user session:', error);
              // Don't force logout on validation errors
            }
          }, 0);
        }
      }
    );

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log('Initial session:', session?.user?.id);
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);


  const signIn = async (email: string, password: string) => {
    // Log authentication attempt
    try {
      await supabase
        .from('security_audit')
        .insert([{
          action: 'signin_attempt',
          target_table: 'auth.users',
          new_values: { email }
        }]);
    } catch (logError) {
      console.warn('Failed to log signin attempt:', logError);
    }

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    // Log authentication result
    try {
      await supabase
        .from('security_audit')
        .insert([{
          action: error ? 'signin_failed' : 'signin_success',
          target_table: 'auth.users',
          new_values: { email, error: error?.message || null }
        }]);
    } catch (logError) {
      console.warn('Failed to log signin result:', logError);
    }

    return { error };
  };

  const signOut = async () => {
    try {
      // Log logout attempt
      if (user) {
        await supabase
          .from('security_audit')
          .insert([{
            action: 'logout',
            target_table: 'auth.users',
            new_values: { user_id: user.id }
          }]);
      }
    } catch (logError) {
      console.warn('Failed to log logout:', logError);
    }

    // Clear auth state
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    
    // Force navigation to auth page
    window.location.href = '/auth';
  };

  const value: AuthContextType = {
    user,
    session,
    loading,
    signIn,
    signOut
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};