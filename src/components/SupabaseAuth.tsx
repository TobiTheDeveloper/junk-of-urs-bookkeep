import { useState } from 'react'
import { Cloud, CloudOff, Loader2, LogIn, LogOut, RefreshCw } from 'lucide-react'
import { FieldLabel, GhostButton, PrimaryButton, TextInput } from './FormFields'
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
      <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
        <div className="flex items-start gap-3">
          <CloudOff size={20} className="text-slate-500 shrink-0 mt-0.5" />
          <div>
            <h2 className="text-sm font-semibold text-slate-300">Cloud Sync (Supabase)</h2>
            <p className="text-xs text-slate-500 mt-1">
              Add <code className="text-slate-400">VITE_SUPABASE_URL</code> and{' '}
              <code className="text-slate-400">VITE_SUPABASE_ANON_KEY</code> to a{' '}
              <code className="text-slate-400">.env</code> file, run the SQL migration in{' '}
              <code className="text-slate-400">supabase/migrations/</code>, then restart the app.
            </p>
          </div>
        </div>
      </section>
    )
  }

  if (loading) {
    return (
      <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4 flex items-center gap-2 text-slate-400">
        <Loader2 size={16} className="animate-spin" />
        Checking cloud account…
      </section>
    )
  }

  if (user) {
    return (
      <section className="rounded-2xl border border-brand-900/40 bg-brand-950/20 p-4 space-y-3">
        <div className="flex items-start gap-3">
          <Cloud size={20} className="text-brand-400 shrink-0 mt-0.5" />
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold text-brand-200">Cloud Sync Active</h2>
            <p className="text-xs text-brand-100/60 mt-0.5 truncate">{user.email}</p>
          </div>
        </div>

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
            Sync Now
          </GhostButton>
          <GhostButton type="button" onClick={signOut} className="flex items-center gap-2">
            <LogOut size={16} />
            Sign Out
          </GhostButton>
        </div>

        {syncMessage && (
          <p
            className={`text-xs ${
              syncStatus === 'error' ? 'text-red-400' : 'text-brand-300'
            }`}
          >
            {syncMessage}
          </p>
        )}
      </section>
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
    <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
      <div className="flex items-start gap-3 mb-4">
        <Cloud size={20} className="text-slate-400 shrink-0 mt-0.5" />
        <div>
          <h2 className="text-sm font-semibold text-slate-300">Cloud Sync</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Sign in to back up and sync across devices. Local data still works offline.
          </p>
        </div>
      </div>

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

        {error && <p className="text-xs text-red-400">{error}</p>}

        <PrimaryButton type="submit" disabled={busy}>
          <span className="flex items-center justify-center gap-2">
            <LogIn size={16} />
            {busy ? 'Please wait…' : mode === 'signin' ? 'Sign In & Sync' : 'Create Account'}
          </span>
        </PrimaryButton>

        <button
          type="button"
          onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
          className="w-full text-xs text-slate-500 hover:text-slate-300"
        >
          {mode === 'signin'
            ? 'Need an account? Sign up'
            : 'Already have an account? Sign in'}
        </button>
      </form>
    </section>
  )
}
