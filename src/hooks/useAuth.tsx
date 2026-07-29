import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { setAuthenticatedUserId } from '../lib/authGuard'
import { clearSessionData, initUserSession } from '../lib/session'
import { getSupabase, isSupabaseConfigured } from '../lib/supabase'
import { syncToCloud, type SyncResult } from '../lib/sync'
import type { SyncStatus } from '../types'

interface AuthContextValue {
  configured: boolean
  user: User | null
  session: Session | null
  loading: boolean
  dataReady: boolean
  sessionError: string | null
  passwordRecovery: boolean
  syncStatus: SyncStatus
  syncMessage: string
  signIn: (email: string, password: string) => Promise<string | null>
  signUp: (email: string, password: string) => Promise<string | null>
  resetPassword: (email: string) => Promise<string | null>
  updatePassword: (password: string) => Promise<string | null>
  clearPasswordRecovery: () => void
  signOut: () => Promise<void>
  syncNow: () => Promise<SyncResult>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(isSupabaseConfigured)
  const [dataReady, setDataReady] = useState(!isSupabaseConfigured)
  const [sessionError, setSessionError] = useState<string | null>(null)
  const [passwordRecovery, setPasswordRecovery] = useState(false)
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle')
  const [syncMessage, setSyncMessage] = useState('')

  useEffect(() => {
    const supabase = getSupabase()
    if (!supabase) {
      setLoading(false)
      setDataReady(true)
      return
    }

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setUser(data.session?.user ?? null)
      setLoading(false)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (event === 'PASSWORD_RECOVERY') {
        setPasswordRecovery(true)
      }
      setSession(nextSession)
      setUser(nextSession?.user ?? null)
    })

    return () => sub.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (loading) return

    if (!user) {
      setAuthenticatedUserId(null)
      setSessionError(null)
      setPasswordRecovery(false)
      setDataReady(true)
      clearSessionData().catch(console.error)
      return
    }

    if (passwordRecovery) {
      setAuthenticatedUserId(user.id)
      setDataReady(true)
      return
    }

    let cancelled = false
    setAuthenticatedUserId(user.id)
    setDataReady(false)
    setSessionError(null)

    initUserSession(user.id)
      .then(() => {
        if (!cancelled) setDataReady(true)
      })
      .catch((err) => {
        console.error('Session init failed:', err)
        if (!cancelled) {
          setSessionError(
            err instanceof Error ? err.message : 'Could not load your books. Try signing in again.',
          )
          setDataReady(true)
        }
      })

    return () => {
      cancelled = true
    }
  }, [user, loading, passwordRecovery])

  const signIn = async (email: string, password: string) => {
    const supabase = getSupabase()
    if (!supabase) return 'Supabase is not configured'
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return error?.message ?? null
  }

  const signUp = async (email: string, password: string) => {
    const supabase = getSupabase()
    if (!supabase) return 'Supabase is not configured'
    const { error } = await supabase.auth.signUp({ email, password })
    return error?.message ?? null
  }

  const resetPassword = async (email: string) => {
    const supabase = getSupabase()
    if (!supabase) return 'Supabase is not configured'
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/`,
    })
    return error?.message ?? null
  }

  const updatePassword = async (password: string) => {
    const supabase = getSupabase()
    if (!supabase) return 'Supabase is not configured'
    const { error } = await supabase.auth.updateUser({ password })
    if (error) return error.message
    setPasswordRecovery(false)
    return null
  }

  const clearPasswordRecovery = () => setPasswordRecovery(false)

  const signOut = async () => {
    const supabase = getSupabase()
    if (!supabase) return
    setAuthenticatedUserId(null)
    setPasswordRecovery(false)
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
        dataReady,
        sessionError,
        passwordRecovery,
        syncStatus,
        syncMessage,
        signIn,
        signUp,
        resetPassword,
        updatePassword,
        clearPasswordRecovery,
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
