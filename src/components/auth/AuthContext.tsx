// src/components/auth/AuthContext.tsx
import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from 'react'
import { User, Session } from '@supabase/supabase-js'
import { supabase } from '@/integrations/supabase/client'

interface AuthContextType {
  user: User | null
  session: Session | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: any }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Listen for auth state changes
    const { data } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
      setUser(newSession?.user ?? null)
      setLoading(false)
    })

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)
    })

    return () => {
      data.subscription.unsubscribe()
    }
  }, [])

  const signIn = async (email: string, password: string) => {
    // log attempt
    try {
      await supabase.from('security_audit').insert({
        action: 'signin_attempt',
        target_table: 'auth.users',
        new_values: { email },
      })
    } catch {}

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    // log result
    try {
      await supabase.from('security_audit').insert({
        action: error ? 'signin_failed' : 'signin_success',
        target_table: 'auth.users',
        new_values: { email, error: error?.message || null },
      })
    } catch {}

    return { error }
  }

  const signOut = async () => {
    // log logout
    if (user) {
      try {
        await supabase.from('security_audit').insert({
          action: 'logout',
          target_table: 'auth.users',
          new_values: { user_id: user.id },
        })
      } catch {}
    }

    await supabase.auth.signOut()
    setSession(null)
    setUser(null)
    window.location.href = '/auth'
  }

  return (
    <AuthContext.Provider
      value={{ user, session, loading, signIn, signOut }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
