import { useState } from 'react'
import { Cloud, Eye, EyeOff, KeyRound, LogIn, Mail } from 'lucide-react'
import { FieldLabel, PrimaryButton, TextInput } from './FormFields'
import { useAuth } from '../hooks/useAuth'

type AuthMode = 'signin' | 'signup' | 'reset' | 'newpassword'

export function LoginGate() {
  const {
    signIn,
    signUp,
    resetPassword,
    updatePassword,
    passwordRecovery,
    clearPasswordRecovery,
    signOut,
  } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [mode, setMode] = useState<AuthMode>(passwordRecovery ? 'newpassword' : 'signin')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [busy, setBusy] = useState(false)

  const activeMode = passwordRecovery ? 'newpassword' : mode

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setInfo('')
    setBusy(true)
    try {
      if (activeMode === 'reset') {
        const err = await resetPassword(email)
        if (err) setError(err)
        else {
          setInfo('Check your email for a password reset link. It may take a minute to arrive.')
          setMode('signin')
        }
        return
      }

      if (activeMode === 'newpassword') {
        if (password.length < 6) {
          setError('Password must be at least 6 characters')
          return
        }
        if (password !== confirmPassword) {
          setError('Passwords do not match')
          return
        }
        const err = await updatePassword(password)
        if (err) setError(err)
        else setInfo('Password updated. Opening your books…')
        return
      }

      const err =
        activeMode === 'signin' ? await signIn(email, password) : await signUp(email, password)
      if (err) setError(err)
    } finally {
      setBusy(false)
    }
  }

  const title =
    activeMode === 'reset'
      ? 'Reset password'
      : activeMode === 'newpassword'
        ? 'Choose a new password'
        : activeMode === 'signup'
          ? 'Create account'
          : 'Sign in'

  const subtitle =
    activeMode === 'reset'
      ? 'Enter your email and we’ll send a reset link.'
      : activeMode === 'newpassword'
        ? 'Enter a new password for your account.'
        : 'Sign in to access your books. Data is stored only while you are logged in.'

  return (
    <div className="min-h-dvh bg-slate-950 flex flex-col items-center justify-center px-4 py-8">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-brand-950 border border-brand-800/50 text-brand-400 mb-4">
            <Cloud size={28} />
          </div>
          <h1 className="text-2xl font-bold text-white">Junk Of Urs Bookkeeper</h1>
          <p className="text-sm text-slate-400 mt-2 leading-relaxed">{subtitle}</p>
        </div>

        <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5 space-y-4">
          <h2 className="text-base font-semibold text-white">{title}</h2>

          {activeMode !== 'newpassword' && (
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
          )}

          {activeMode !== 'reset' && (
            <div>
              <FieldLabel>{activeMode === 'newpassword' ? 'New password' : 'Password'}</FieldLabel>
              <div className="relative">
                <TextInput
                  type={showPassword ? 'text' : 'password'}
                  autoComplete={
                    activeMode === 'signin'
                      ? 'current-password'
                      : 'new-password'
                  }
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={6}
                  required
                  className="pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 p-1"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
          )}

          {activeMode === 'newpassword' && (
            <div>
              <FieldLabel>Confirm password</FieldLabel>
              <TextInput
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                minLength={6}
                required
              />
            </div>
          )}

          {error && (
            <p className="text-xs text-red-400 bg-red-950/30 border border-red-900/30 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          {info && (
            <p className="text-xs text-brand-300 bg-brand-950/30 border border-brand-900/30 rounded-lg px-3 py-2">
              {info}
            </p>
          )}

          <PrimaryButton type="submit" disabled={busy}>
            <span className="flex items-center justify-center gap-2">
              {activeMode === 'reset' ? (
                <Mail size={16} />
              ) : activeMode === 'newpassword' ? (
                <KeyRound size={16} />
              ) : (
                <LogIn size={16} />
              )}
              {busy
                ? 'Please wait…'
                : activeMode === 'reset'
                  ? 'Send reset link'
                  : activeMode === 'newpassword'
                    ? 'Update password'
                    : activeMode === 'signin'
                      ? 'Sign in'
                      : 'Create account'}
            </span>
          </PrimaryButton>

          {activeMode === 'signin' && (
            <button
              type="button"
              onClick={() => {
                setError('')
                setInfo('')
                setMode('reset')
              }}
              className="w-full text-xs text-slate-500 hover:text-slate-300 py-1"
            >
              Forgot password?
            </button>
          )}

          {activeMode === 'reset' && (
            <button
              type="button"
              onClick={() => {
                setError('')
                setInfo('')
                setMode('signin')
              }}
              className="w-full text-xs text-slate-500 hover:text-slate-300 py-1"
            >
              Back to sign in
            </button>
          )}

          {activeMode === 'newpassword' && (
            <button
              type="button"
              onClick={() => {
                clearPasswordRecovery()
                void signOut()
              }}
              className="w-full text-xs text-slate-500 hover:text-slate-300 py-1"
            >
              Cancel and sign out
            </button>
          )}

          {(activeMode === 'signin' || activeMode === 'signup') && (
            <button
              type="button"
              onClick={() => {
                setError('')
                setInfo('')
                setMode(activeMode === 'signin' ? 'signup' : 'signin')
              }}
              className="w-full text-xs text-slate-500 hover:text-slate-300 py-1"
            >
              {activeMode === 'signin' ? 'Need an account? Sign up' : 'Already have an account? Sign in'}
            </button>
          )}
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
