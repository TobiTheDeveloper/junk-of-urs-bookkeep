import { useState } from 'react'
import { Cloud, CloudOff, Loader2, LogIn, LogOut, RefreshCw } from 'lucide-react'
import { FieldLabel, GhostButton, PrimaryButton, TextInput } from './FormFields'
import { SettingsSection } from './SettingsSection'
import { useAuth } from '../hooks/useAuth'

export function SupabaseAuthPanel() {
  const { configured, user, loading, syncStatus, syncMessage, signIn, signUp, signOut, syncNow } =
    useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  if (!configured) {
    return (
      <SettingsSection
        icon={CloudOff}
        title="Cloud sync"
        description="Supabase not configured on this deployment"
        variant="muted"
      >
        <p className="text-xs text-slate-500 leading-relaxed">
          Add <code className="text-slate-400">VITE_SUPABASE_URL</code> and{' '}
          <code className="text-slate-400">VITE_SUPABASE_ANON_KEY</code> in Vercel environment
          variables, then redeploy.
        </p>
      </SettingsSection>
    )
  }

  if (loading) {
    return (
      <SettingsSection icon={Cloud} title="Cloud sync" description="Checking account…" variant="accent">
        <div className="flex items-center gap-2 text-slate-400 text-sm">
          <Loader2 size={16} className="animate-spin" />
          Connecting…
        </div>
      </SettingsSection>
    )
  }

  if (user) {
    return (
      <SettingsSection
        icon={Cloud}
        title="Cloud sync active"
        description={user.email ?? 'Signed in'}
        variant="accent"
      >
        <div className="flex gap-2">
          <GhostButton
            type="button"
            onClick={() => syncNow()}
            disabled={syncStatus === 'syncing'}
            className="flex-1 flex items-center justify-center gap-2"
          >
            {syncStatus === 'syncing' ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <RefreshCw size={16} />
            )}
            Sync now
          </GhostButton>
          <GhostButton type="button" onClick={signOut} className="flex items-center gap-2 px-3">
            <LogOut size={16} />
            Out
          </GhostButton>
        </div>
        {syncMessage && (
          <p
            className={`mt-3 text-xs rounded-lg px-3 py-2 ${
              syncStatus === 'error'
                ? 'text-red-300 bg-red-950/30 border border-red-900/30'
                : 'text-brand-300 bg-brand-950/30 border border-brand-900/30'
            }`}
          >
            {syncMessage}
          </p>
        )}
      </SettingsSection>
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      const err =
        mode === 'signin' ? await signIn(email, password) : await signUp(email, password)
      if (err) setError(err)
      else if (mode === 'signin') await syncNow()
    } finally {
      setBusy(false)
    }
  }

  return (
    <SettingsSection
      icon={Cloud}
      title="Cloud sync"
      description="Back up and sync across devices · works offline without sign-in"
    >
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <FieldLabel>Email</FieldLabel>
          <TextInput
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div>
          <FieldLabel>Password</FieldLabel>
          <TextInput
            type="password"
            autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={6}
            required
          />
        </div>

        {error && (
          <p className="text-xs text-red-400 bg-red-950/30 border border-red-900/30 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <PrimaryButton type="submit" disabled={busy}>
          <span className="flex items-center justify-center gap-2">
            <LogIn size={16} />
            {busy ? 'Please wait…' : mode === 'signin' ? 'Sign in & sync' : 'Create account'}
          </span>
        </PrimaryButton>

        <button
          type="button"
          onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
          className="w-full text-xs text-slate-500 hover:text-slate-300 py-1"
        >
          {mode === 'signin' ? 'Need an account? Sign up' : 'Already have an account? Sign in'}
        </button>
      </form>
    </SettingsSection>
  )
}
