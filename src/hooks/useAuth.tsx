import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { getSupabase, isSupabaseConfigured } from '../lib/supabase'
import { pullFromCloud, syncToCloud, type SyncResult } from '../lib/sync'
import type { SyncStatus } from '../types'

interface AuthContextValue {
  configured: boolean
  user: User | null
  session: Session | null
  loading: boolean
  syncStatus: SyncStatus
  syncMessage: string
  signIn: (email: string, password: string) => Promise<string | null>
  signUp: (email: string, password: string) => Promise<string | null>
  signOut: () => Promise<void>
  syncNow: () => Promise<SyncResult>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(isSupabaseConfigured)
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle')
  const [syncMessage, setSyncMessage] = useState('')

  useEffect(() => {
    const supabase = getSupabase()
    if (!supabase) {
      setLoading(false)
      return
    }

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setUser(data.session?.user ?? null)
      setLoading(false)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setUser(nextSession?.user ?? null)
    })

    return () => sub.subscription.unsubscribe()
  }, [])

  const signIn = async (email: string, password: string) => {
    const supabase = getSupabase()
    if (!supabase) return 'Supabase is not configured'
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return error?.message ?? null
  }

  const signUp = async (email: string, password: string) => {
    const supabase = getSupabase()
    if (!supabase) return 'Supabase is not configured'
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) return error.message
    if (data.user?.id) {
      await pullFromCloud(data.user.id)
    }
    return null
  }

  const signOut = async () => {
    const supabase = getSupabase()
    if (!supabase) return
    await supabase.auth.signOut()
  }

  const syncNow = async () => {
    setSyncStatus('syncing')
    setSyncMessage('Syncing…')
    const result = await syncToCloud()
    setSyncStatus(result.ok ? 'success' : 'error')
    setSyncMessage(result.message)
    setTimeout(() => setSyncStatus('idle'), 3000)
    return result
  }

  return (
    <AuthContext.Provider
      value={{
        configured: isSupabaseConfigured,
        user,
        session,
        loading,
        syncStatus,
        syncMessage,
        signIn,
        signUp,
        signOut,
        syncNow,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
