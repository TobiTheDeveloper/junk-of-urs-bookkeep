import { useState } from 'react'
import { Cloud, LogIn } from 'lucide-react'
import { FieldLabel, PrimaryButton, TextInput } from './FormFields'
import { useAuth } from '../hooks/useAuth'

export function LoginGate() {
  const { signIn, signUp } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      const err = mode === 'signin' ? await signIn(email, password) : await signUp(email, password)
      if (err) setError(err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-dvh bg-slate-950 flex flex-col items-center justify-center px-4 py-8">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-brand-950 border border-brand-800/50 text-brand-400 mb-4">
            <Cloud size={28} />
          </div>
          <h1 className="text-2xl font-bold text-white">Junk Of Urs Bookkeeper</h1>
          <p className="text-sm text-slate-400 mt-2 leading-relaxed">
            Sign in to access your books. Data is stored only while you are logged in.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5 space-y-4">
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
              {busy ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'}
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
      </div>
    </div>
  )
}

export function ConfigureSupabaseGate() {
  return (
    <div className="min-h-dvh bg-slate-950 flex flex-col items-center justify-center px-4 py-8">
      <div className="w-full max-w-sm text-center">
        <h1 className="text-xl font-bold text-white">Cloud sign-in required</h1>
        <p className="text-sm text-slate-400 mt-3 leading-relaxed">
          Add <code className="text-slate-300">VITE_SUPABASE_URL</code> and{' '}
          <code className="text-slate-300">VITE_SUPABASE_ANON_KEY</code> to your environment, then
          redeploy.
        </p>
      </div>
    </div>
  )
}
